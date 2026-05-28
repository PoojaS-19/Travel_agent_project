from fastapi import FastAPI, Depends
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from amadeus import Client, ResponseError
from dotenv import load_dotenv
import os
import google.generativeai as genai
import requests
from pydantic import BaseModel
from datetime import datetime, timedelta
import math
from math import radians, sin, cos, sqrt, atan2
from sqlalchemy.orm import Session
from typing import Optional

# Database imports
from app.database import engine, get_db, Base
from app.models.schemas import ItineraryUpdate
from app.models import Flight, Train, Itinerary, SearchHistory, SearchType, TripCollaborator
from app.services.database_service import FlightService, TrainService, ItineraryService, SearchHistoryService
from app.services.recommendation_service import RecommendationService

# Load .env once
load_dotenv()

print("Database Connection: MySQL configured")

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup (after server initializes)
@app.on_event("startup")
async def startup_event():
    """Create database tables on startup"""
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created/verified successfully")
        
        # Check and add column is_verified if not exists
        from sqlalchemy import text
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SHOW COLUMNS FROM users LIKE 'is_verified'")).fetchone()
                if not result:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE"))
                    conn.commit()
                    print("Dynamic migration: Added 'is_verified' column to 'users' table")
        except Exception as alt_err:
            print(f"Warning: Could not check/add 'is_verified' column to 'users' table: {alt_err}")
            
    except Exception as e:
        print(f"Warning: Could not create database tables: {e}")

def calculate_distance(lat1, lon1, lat2, lon2):
    return round(
        math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2) * 111,
        2
    )

def get_nearest_hospital(lat, lon):
    return {
        "name": "City Care Hospital",
        "lat": lat + 0.01,
        "lon": lon + 0.01,
        "distance": calculate_distance(lat, lon, lat + 0.01, lon + 0.01)
    }

def get_rest_hotel():
    return "Comfort Rest Inn"


def get_user_interest_hint(db: Session, user_id: int) -> str:
    """Build a short recommendation hint from the user's recent saved itineraries."""
    if not user_id:
        return ""

    recent_itineraries = ItineraryService.get_user_itineraries(db, user_id, limit=5)
    if not recent_itineraries:
        return ""

    seen = []
    for itinerary in recent_itineraries:
        if itinerary.destination and itinerary.destination not in seen:
            seen.append(itinerary.destination)
    if not seen:
        return ""

    return "The user has previously shown interest in trips to " + ", ".join(seen[:3]) + "."


def serialize_itinerary(itinerary: Itinerary) -> dict:
    """Convert an itinerary model to an API response dict."""
    return {
        "id": itinerary.id,
        "start_city": itinerary.start_city,
        "destination": itinerary.destination,
        "itinerary_text": itinerary.itinerary_text,
        "daily_plans": itinerary.daily_plans,
        "language": itinerary.language,
        "created_at": itinerary.created_at.isoformat(),
    }


def serialize_itinerary_with_access(itinerary: Itinerary, user_id: int, role: str = None) -> dict:
    data = serialize_itinerary(itinerary)
    access_role = role or ("owner" if itinerary.user_id == user_id else "viewer")
    data.update({
        "owner_user_id": itinerary.user_id,
        "collaboration_role": access_role,
        "is_shared": itinerary.user_id != user_id,
        "can_edit": itinerary.user_id == user_id,
    })
    return data


# ------------------ CONFIGURE GEMINI ------------------
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Correct model name
gemini_model = genai.GenerativeModel("gemini-flash-latest")

# ------------------ CONFIGURE AMADEUS ------------------
amadeus = Client(
    client_id=os.getenv("AMADEUS_API_KEY"),
    client_secret=os.getenv("AMADEUS_API_SECRET")
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")


@app.get("/")
def home():
    return {"message": "Backend working!"}

# Include routers
from app.routes.train_routes import router as train_router
from app.routers.auth import router as auth_router, get_optional_user_id, get_current_user_id
from app.routers.hotels import router as hotels_router
from app.routers.reviews import router as reviews_router
from app.routers.collaboration import router as collaboration_router, websocket_trip_endpoint

app.include_router(auth_router)
app.include_router(train_router, prefix="/api")
app.include_router(hotels_router, prefix="/api")
app.include_router(reviews_router, prefix="/api")
app.include_router(collaboration_router)
app.add_api_websocket_route("/ws/trips/{trip_id}", websocket_trip_endpoint)


# ----------------------------- FLIGHTS -----------------------------
@app.get("/flights")
def get_flights(source: str, destination: str, departure: str, return_date: str, db: Session = Depends(get_db)):
    """
    Search for flights - tries database first, then Amadeus API, then generates mock data
    """
    print(f"Searching flights: {source} -> {destination} on {departure}")
    
    # Check if flights already in database
    existing_flights = db.query(Flight).filter(
        Flight.source == source,
        Flight.destination == destination
    ).all()
    
    if existing_flights:
        return [{
            "id": f.id,
            "airline": f.airline,
            "price": float(f.price),
            "departure": f.departure.isoformat(),
            "arrival": f.arrival.isoformat()
        } for f in existing_flights[:5]]
    
    try:
        # Try real API
        if not os.getenv("AMADEUS_API_KEY") or not os.getenv("AMADEUS_API_SECRET"):
            raise Exception("Amadeus keys missing")

        response = amadeus.shopping.flight_offers_search.get(
            originLocationCode=source,
            destinationLocationCode=destination,
            departureDate=departure,
            returnDate=return_date,
            adults=1,
            currencyCode="INR"
        )

        flights = []
        for f in response.data[:3]:
            # Save to database
            dep_dt = datetime.fromisoformat(f["itineraries"][0]["segments"][0]["departure"]["at"].replace("Z", "+00:00"))
            arr_dt = datetime.fromisoformat(f["itineraries"][0]["segments"][0]["arrival"]["at"].replace("Z", "+00:00"))
            
            flight_db = FlightService.create_flight(
                db=db,
                airline=f["validatingAirlineCodes"][0],
                price=float(f["price"]["grandTotal"]),
                departure=dep_dt,
                arrival=arr_dt,
                source=source,
                destination=destination,
                api_response=f
            )
            
            flights.append({
                "id": flight_db.id,
                "airline": flight_db.airline,
                "price": float(flight_db.price),
                "departure": flight_db.departure.isoformat(),
                "arrival": flight_db.arrival.isoformat()
            })

        return flights

    except Exception as e:
        print(f"Amadeus API failed: {e}. Returning MOCK data.")
        import random

        try:
            base_date = datetime.strptime(departure, "%Y-%m-%d")
        except:
            base_date = datetime.now()

        mock_flights = []
        airlines = ["AI", "6E", "UK", "SG"]
        
        for _ in range(5):
            dep_hour = random.randint(6, 22)
            dep_min = random.choice([0, 15, 30, 45])
            duration_hours = random.randint(1, 4)
            
            dep_dt = base_date.replace(hour=dep_hour, minute=dep_min)
            arr_dt = dep_dt + timedelta(hours=duration_hours, minutes=random.randint(0, 59))
            price = random.randint(3000, 15000)

            # Save mock flight to database
            flight_db = FlightService.create_flight(
                db=db,
                airline=random.choice(airlines),
                price=float(price),
                departure=dep_dt,
                arrival=arr_dt,
                source=source,
                destination=destination
            )

            mock_flights.append({
                "id": flight_db.id,
                "airline": flight_db.airline,
                "price": float(flight_db.price),
                "departure": flight_db.departure.isoformat(),
                "arrival": flight_db.arrival.isoformat()
            })
            
        return mock_flights


# ----------------------------- HOTELS -----------------------------
@app.get("/hotels")
def get_hotels(city: str):
    if not city or not city.strip():
        return {"error": "City query is required"}

    url = (
        f"https://maps.googleapis.com/maps/api/place/textsearch/json?"
        f"query=best+hotels+in+{city}&key={GOOGLE_API_KEY}"
    )
    r = requests.get(url).json()
    status = r.get("status")

    if status != "OK":
        return {
            "error": r.get("error_message", f"Google Places API returned {status}")
        }

    return r.get("results", [])[:5]


# ----------------------------- RESTAURANTS -----------------------------
@app.get("/restaurants")
def get_restaurants(city: str):
    url = (
        f"https://maps.googleapis.com/maps/api/place/textsearch/json?"
        f"query=restaurants+in+{city}&key={GOOGLE_API_KEY}"
    )
    r = requests.get(url).json()
    return r.get("results", [])[:5]


# ----------------------------- PLACE IMAGE -----------------------------
@app.get("/place-image")
def get_place_image(place: str, index: int = 0):
    """Fetch a single place photo by index (0, 1, 2...). Uses Google Places photo_reference."""
    if not place:
        return {"error": "Place required"}
    
    # 1. Search for the place to get photo_references
    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={place}&key={GOOGLE_API_KEY}"
    r = requests.get(url).json()
    
    # Collect photos from the first result
    photos = []
    if r.get("status") == "OK" and r.get("results"):
        for result in r["results"][:3]:  # Check up to 3 results for photos
            for photo in result.get("photos", []):
                photos.append(photo["photo_reference"])
                if len(photos) >= 3:
                    break
            if len(photos) >= 3:
                break
    
    if photos and index < len(photos):
        photo_ref = photos[index]
        # Fetch the actual photo at a larger width for full view
        img_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={photo_ref}&key={GOOGLE_API_KEY}"
        img_resp = requests.get(img_url, stream=True)
        return StreamingResponse(img_resp.iter_content(chunk_size=1024), media_type=img_resp.headers.get("Content-Type", "image/jpeg"))
    
    # Fallback if no photo found
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="No image found")


@app.get("/place-image-count")
def get_place_image_count(place: str):
    """Returns how many photos are available for a place (max 3)."""
    if not place:
        return {"count": 0}
    
    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={place}&key={GOOGLE_API_KEY}"
    r = requests.get(url).json()
    
    count = 0
    if r.get("status") == "OK" and r.get("results"):
        for result in r["results"][:3]:
            count += len(result.get("photos", []))
            if count >= 3:
                count = 3
                break
    
    return {"count": min(count, 3)}


#------------------------------Nearby Places -----------------------------
@app.post("/nearby")
def nearby_places(data: dict):
    lat = data.get("lat")
    lon = data.get("lon")

    if not lat or not lon:
        return {"error": "Location not available"}

    place_types = {
        "places": "tourist_attraction",
        "hotels": "lodging",
        "restaurants": "restaurant",
        "hospitals": "hospital"
    }

    results = {}

    for key, place_type in place_types.items():
        url = (
            "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            f"?location={lat},{lon}&radius=5000&type={place_type}"
            f"&key={GOOGLE_API_KEY}"
        )

        res = requests.get(url).json()
        results[key] = []

        for p in res.get("results", [])[:5]:
            plat = p["geometry"]["location"]["lat"]
            plon = p["geometry"]["location"]["lng"]

            results[key].append({
                "name": p["name"],
                "address": p.get("vicinity", ""),
                "distance": calculate_distance(lat, lon, plat, plon)
            })

    return results
#------------------------------Emergency------------------------------
@app.post("/emergency")
def emergency(data: dict):
    lat = data.get("lat")
    lon = data.get("lon")

    if not lat or not lon:
        return {"error": "Location not available"}

    # 1. Fetch general hospitals
    url_general = (
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={lat},{lon}&rankby=distance&type=hospital"
        f"&key={GOOGLE_API_KEY}"
    )
    res_general = requests.get(url_general).json()

    # 2. Fetch explicitly private hospitals using keyword
    url_private = (
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={lat},{lon}&rankby=distance&type=hospital&keyword=private"
        f"&key={GOOGLE_API_KEY}"
    )
    res_private = requests.get(url_private).json()

    # Combine results
    all_results = res_general.get("results", []) + res_private.get("results", [])

    if not all_results:
        return {"error": "No hospital found nearby"}

    # Deduplicate by place_id
    seen_place_ids = set()
    unique_hospitals = []
    
    for h in all_results:
        place_id = h.get("place_id", h["name"])
        if place_id not in seen_place_ids:
            seen_place_ids.add(place_id)
            
            # Calculate distance
            dist = calculate_distance(
                lat, lon,
                h["geometry"]["location"]["lat"],
                h["geometry"]["location"]["lng"]
            )
            
            unique_hospitals.append({
                "name": h["name"],
                "address": h.get("vicinity", ""),
                "distance": dist
            })

    # Sort by distance
    unique_hospitals.sort(key=lambda x: x["distance"])

    # Return top 3
    return {"hospitals": unique_hospitals[:3]}




# ----------------------------- ITINERARY (GEMINI) -----------------------------
from datetime import datetime, timedelta

@app.post("/itinerary")
async def generate_itinerary(
    details: dict,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    """
    Expects JSON body like:
    { "start_city": "Mumbai",  #optional if not provided assume 'current location'
      "destination": "Goa",
      "days": 3,
      "theme": "beach",
      "preferences": "budget, local food, relaxed pace",
      "start_date": "2025-04-10"   # optional, ISO YYYY-MM-DD
    }
    """
    try:
        # Basic validation / defaults
        start_city = details.get("start_city", "your current location")

        destination = details.get("destination", "Unknown destination")
        days = int(details.get("days", 1))
        theme = details.get("theme", "General")
        preferences = details.get("preferences", "")
        start_date = details.get("start_date")  # optional
        language = details.get("language", "English")

        if not preferences and user_id:
            preferences = get_user_interest_hint(db, user_id)
        
        if language == "Hindi":
          lang_name = "Hindi"
        elif language == "Marathi":
          lang_name = "Marathi"
        else:
          lang_name = "English"

        if preferences:
            preferences = preferences.strip()

        # If a start_date is provided, try parse it; otherwise do not include explicit date in day title
        start_date_obj = None
        if start_date:
            try:
                start_date_obj = datetime.fromisoformat(start_date)
            except Exception:
                start_date_obj = None  # silently ignore bad format; we won't include dates if invalid

        # Strict prompt template - forces time based lines and exact sections
        # NOTE: Keep this strict formatting. Gemini should follow it.
        prompt_header = f"""
Generate a detailed, time-based travel itinerary for the user below.

Respond completely in {lang_name}.
Do NOT mix languages.

Starting City: {start_city}
Destination: {destination}
Preferences: {preferences or 'No special preferences provided'}

If Starting City is different from Destination, include travel from Starting City to Destination on DAY 1 with realistic travel time and cost.

CRITICAL REQUIREMENT: You MUST include meal times (Breakfast, Lunch, Dinner) under the "Food" category and hotel check-ins under the "Relax" category.
For meals and hotel accommodations, DO NOT suggest a single direct place. Instead, provide 3 to 4 distinct options in the 'description' field based on different budgets, tastes, or facilities (e.g., "Option 1 (Budget): X... Option 2 (Luxury): Y..."). Set the 'place_name' to "Dining Options" or "Accommodation Options" respectively.

IMPORTANT – Output MUST be valid JSON only. Do not wrap in markdown code blocks.
The JSON structure must be exactly:
{{
  "itinerary_text": "Keep this short summary...",
  "daily_plans": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {{
          "time": "09:00 AM",
          "place_name": "Name of place, or 'Dining Options', or 'Accommodation Options'",
          "category": "Attraction",
          "lat": 12.345,
          "lon": 45.678,
          "description": "Detailed 4-6 sentence paragraph explaining the history, appeal, and what to do/see. Make it engaging. For food/hotel, list 3-4 options.",
          "alternatives": ["Alternative Nearby Place 1", "Alternative Nearby Place 2"],
          "cost": "₹200"
        }}
      ]
    }}
  ]
}}

For "category", use one of: "Food", "Attraction", "Travel", "Relax", "Shopping", "History".

For "itinerary_text", just provide a very brief 2-3 sentence summary of the whole trip. WE WILL RELY ON `daily_plans` for the UI.

Ensure `daily_plans` covers the full day from morning to night.
Include specific times (e.g. "10:00 AM").
Include real coordinates for `lat`/`lon`.

For "itinerary_text", follow these rules exactly:
1) For each day produce a title line: "DAY X: <Short Day Title> (YYYY-MM-DD)" if a valid start_date was provided; otherwise "DAY X".
2) Every bullet must use the bullet glyph "•" and contain a start time or start–end time in 24-hour or 12-hour with AM/PM.
   Examples:
     • 09:00 – 10:00: Breakfast at a local shack (₹150–₹300).
     • 9:00 AM – 10:30 AM: Train to X (1h travel)
     • 21:00: Return to hotel.
3) Use this exact sections order (all uppercase section titles, single-line): DAY 1, DAY 2 ... FOOD, RESTAURANTS, HOTELS, TRANSPORT, BUDGET, PHOTO SPOTS, SAFETY, MAPS
4) NO markdown headings (#), no codeblocks, no YAML, no tables — plain text ONLY.
5) Keep each DAY to 6–9 bullets (include travel times in parentheses where applicable).
6) Provide local tips, typical costs (approx), and travel time estimates for transfers.
7) Use the same bullet format as the example below.

EXAMPLE TEXT STYLE (for itinerary_text field):
DAY 1: BEACH ARRIVAL (2025-04-11)
• 09:00 – 10:00: Arrive & check-in at Hotel (allow 30 min to luggage drop).
• 10:00 – 13:00: Relax on Calangute Beach (sunbathe, swim).
• 13:00 – 14:00: Lunch at beachside restaurant (₹300–₹500).
• 14:00 – 15:00: Rent a scooter (expect ~₹300–₹500/day).
• 15:00 – 18:00: Explore Baga Beach (short ride, ~15 min).
• 18:00 – 19:00: Sunset at Baga Beach.
• 19:00 – 21:00: Dinner at local restaurant (₹300–₹700).
• 21:00: Return to hotel.

Now generate the JSON for the user's inputs.
"""

        # If start_date_obj provided, expand each day header with real date in prompt (so Gemini uses dates)
        # We'll build an explicit "DAY X" list in the prompt to make dates obvious to the model.
        day_headers = []
        for i in range(days):
            day_num = i + 1
            if start_date_obj:
                day_date = (start_date_obj + timedelta(days=i)).date().isoformat()
                day_headers.append(f"DAY {day_num}: (date: {day_date})")
            else:
                day_headers.append(f"DAY {day_num}")

        # Append the explicit days to prompt so model knows how many days/dates to produce
        prompt_days = "The trip days (for your reference):\n" + "\n".join(day_headers) + "\n\nNow produce the JSON:\n\n"

        final_prompt = prompt_header + prompt_days

        # Call Gemini
        response = gemini_model.generate_content(final_prompt)

        # Response object from google generative ai SDK often contains .text or .candidates
        generated_content = ""
        if hasattr(response, "text") and response.text:
            generated_content = response.text
        else:
            # fallback: try to get first candidate
            try:
                # Some SDK responses return dict-like content
                if isinstance(response, dict) and "candidates" in response and len(response["candidates"]) > 0:
                    generated_content = response["candidates"][0].get("content", "")
                else:
                    # str(response) as last resort
                    generated_content = str(response)
            except Exception:
                generated_content = str(response)

        # Parse JSON
        import json
        try:
            # simple cleanup if model wrapped in ```json ... ```
            clean_content = generated_content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.startswith("```"):
                clean_content = clean_content[3:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
            
            data = json.loads(clean_content)

            # Persist itinerary for authenticated users
            if user_id and isinstance(data, dict) and data.get("itinerary_text") and data.get("daily_plans"):
                try:
                    ItineraryService.create_itinerary(
                        db=db,
                        user_id=user_id,
                        start_city=start_city,
                        destination=destination,
                        itinerary_text=data.get("itinerary_text", ""),
                        daily_plans=data.get("daily_plans", []),
                        language=language,
                    )
                except Exception as save_error:
                    print("Failed to save itinerary:", save_error)

            return data # Returns dict with itinerary_text and daily_plans
        except Exception as e:
            print("Failed to parse JSON:", e)
            print("Raw content:", generated_content)
            # Fallback for plain text if model failed JSON
            return {"itinerary_text": generated_content, "daily_plans": []}

    except Exception as e:
        print("ERROR generating itinerary:", e)
        return {"error": str(e)}


# ----------------------------- GET SAVED ITINERARIES -----------------------------
@app.get("/itineraries")
async def get_saved_itineraries(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """
    Get all saved itineraries for the authenticated user
    """
    try:
        owned_itineraries = ItineraryService.get_user_itineraries(db, user_id)
        shared_rows = (
            db.query(Itinerary, TripCollaborator.role)
            .join(TripCollaborator, TripCollaborator.trip_id == Itinerary.id)
            .filter(
                TripCollaborator.user_id == user_id,
                Itinerary.user_id != user_id,
            )
            .order_by(TripCollaborator.joined_at.desc())
            .all()
        )
        itineraries = [
            serialize_itinerary_with_access(itinerary, user_id, "owner")
            for itinerary in owned_itineraries
        ]
        itineraries.extend(
            serialize_itinerary_with_access(
                itinerary,
                user_id,
                role.value if hasattr(role, "value") else str(role),
            )
            for itinerary, role in shared_rows
        )
        return {
            "itineraries": itineraries
        }
    except Exception as e:
        print("ERROR fetching itineraries:", e)
        return {"error": str(e)}


@app.get("/itineraries/{itinerary_id}")
async def get_saved_itinerary(
    itinerary_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Get a single saved itinerary for the authenticated user."""
    itinerary = ItineraryService.get_user_itinerary(db, user_id, itinerary_id)
    access_role = "owner"
    if not itinerary:
        collaborator = db.query(TripCollaborator).filter(
            TripCollaborator.trip_id == itinerary_id,
            TripCollaborator.user_id == user_id,
        ).first()
        if collaborator:
            itinerary = db.query(Itinerary).filter(Itinerary.id == itinerary_id).first()
            access_role = collaborator.role.value if hasattr(collaborator.role, "value") else str(collaborator.role)
    if not itinerary:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return serialize_itinerary_with_access(itinerary, user_id, access_role)


@app.put("/itineraries/{itinerary_id}")
async def update_saved_itinerary(
    itinerary_id: int,
    payload: ItineraryUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Update a saved itinerary owned by the authenticated user."""
    itinerary = ItineraryService.get_user_itinerary(db, user_id, itinerary_id)
    if not itinerary:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Itinerary not found")

    if hasattr(payload, "model_dump"):
        updates = payload.model_dump(exclude_unset=True)
    else:
        updates = payload.dict(exclude_unset=True)
    if not updates:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No changes provided")

    updated = ItineraryService.update_itinerary(db, itinerary, updates)
    return serialize_itinerary(updated)


@app.delete("/itineraries/{itinerary_id}")
async def delete_saved_itinerary(
    itinerary_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Delete a saved itinerary owned by the authenticated user."""
    itinerary = ItineraryService.get_user_itinerary(db, user_id, itinerary_id)
    if not itinerary:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Itinerary not found")

    ItineraryService.delete_itinerary(db, itinerary)
    return {"message": "Itinerary deleted successfully"}


@app.get("/recommendations")
async def get_recommendations(
    language: str = "English",
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    """Get personalized itinerary recommendations based on user history. Falls back to generic suggestions for anonymous or new users."""
    try:
        recommendations = RecommendationService.get_personalized_recommendations(db, user_id, language)
        return {"recommendations": recommendations}
    except Exception as e:
        print("ERROR fetching recommendations:", e)
        return {"error": str(e), "recommendations": RecommendationService.generic_recommendations(language)}


# ----------------------------- chatbot (GEMINI) - SMART VERSION -----------------------------
@app.post("/chatbot")
async def travel_chatbot(
    data: dict,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    lat = data.get("lat")
    lon = data.get("lon")

    try:
        user_question = data.get("question", "")
        language = data.get("language", "English")
        history = data.get("history", [])  # conversation history
        previous_interest_hint = get_user_interest_hint(db, user_id) if user_id else ""

        # Build conversation context from history
        history_text = ""
        if history:
            recent = history[-10:]  # last 10 messages
            for msg in recent:
                role = "User" if msg.get("sender") == "user" else "Myra"
                history_text += f"{role}: {msg.get('text', '')}\n"

        hint_section = ""
        if previous_interest_hint:
            hint_section = f"\nUser Interest Hint: {previous_interest_hint}\n"

        prompt = f"""
You are an intelligent travel assistant named Myra. You are as smart and conversational as ChatGPT or Gemini.

{hint_section}
IMPORTANT LANGUAGE RULE:
Respond ONLY in {language}. Do NOT mix languages.

User's Location:
Lat: {lat}
Lon: {lon}
(Use this for context-aware answers but do not show coordinates unless asked.)

Conversation History:
{history_text}

User's Latest Message: {user_question}

INSTRUCTIONS — Read carefully:

1) INTENT DETECTION:
   - If the user mentions an accident, emergency, medical issue, or urgently needs police/hospital help, set response_type to "emergency".
   - If the user asks to CREATE/MAKE/PLAN a trip, itinerary, or travel plan (e.g., "plan a 3-day trip to Goa", "make me an itinerary for Paris"), set response_type to "plan".
   - If the user asks for INFORMATION, recommendations, tips, facts about a place/food/culture/hotel, set response_type to "info".
   - If the user is having casual conversation, greetings, follow-ups, or anything else travel-related, set response_type to "chat".
   - If the question is NOT related to travel, geography, culture, food, or local services — politely refuse.

2) OUTPUT FORMAT — Always respond with valid JSON only (no markdown code blocks):

   For response_type "chat" or "info":
   {{
     "response_type": "chat" or "info",
     "reply": "Your conversational reply here. Use bullet points (•) for lists. Keep it helpful and friendly."
   }}

   For response_type "emergency":
   {{
     "response_type": "emergency",
     "reply": "Please stay calm. Your safety is our priority.",
     "emergency_data": {{
       "emergency_type": "Medical or Police",
       "recommended_action": "Find help nearby.",
       "numbers": ["108 (Ambulance)", "100 (Police)"]
     }}
   }}

   For response_type "plan":
   {{
     "response_type": "plan",
     "reply": "Brief 2-3 sentence summary of the plan.",
     "plan_data": {{
       "destination": "City Name",
       "days": 3,
       "daily_plans": [
         {{
           "day": 1,
           "date": "YYYY-MM-DD",
           "activities": [
             {{
               "time": "09:00 AM",
               "place_name": "Name of place, or 'Dining Options', or 'Accommodation Options'",
               "category": "Attraction",
               "lat": 12.345,
               "lon": 45.678,
               "description": "For typical places, 2-3 sentences. For eating or hotels, provide 3-4 options here based on budget/taste.",
               "cost": "₹200"
             }}
           ]
         }}
       ]
     }}
   }}

   CRITICAL MAPPING RULE: Include meals (category: "Food") and hotels! For meals and hotels, provide 3 to 4 distinct options in the 'description' (e.g. Option 1 Budget, Option 2 Luxury). Set 'place_name' to "Dining Options" or "Accommodation Options".

   For "category", use one of: "Food", "Attraction", "Travel", "Relax", "Shopping", "History".
   Include 6-9 activities per day covering morning to night.
   Use real coordinates for lat/lon.
   Include realistic costs.

3) PERSONALITY:
   - Be warm, helpful, knowledgeable.
   - Remember context from conversation history.
   - If the user previously mentioned preferences, remember them.
   - Give specific actionable recommendations, not generic advice.
   - Do NOT use Markdown headings (#) or code blocks.

Now respond to the user's latest message as JSON:
"""

        response = gemini_model.generate_content(prompt)
        raw = response.text.strip()

        # Parse JSON response
        import json
        try:
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            parsed = json.loads(raw.strip())

            # Save plan replies for authenticated users
            if user_id and isinstance(parsed, dict):
                plan_payload = parsed.get("plan_data") if isinstance(parsed.get("plan_data"), dict) else parsed
                if plan_payload and plan_payload.get("destination") and plan_payload.get("daily_plans"):
                    try:
                        ItineraryService.create_itinerary(
                            db=db,
                            user_id=user_id,
                            start_city=plan_payload.get("start_city", "your current location"),
                            destination=plan_payload.get("destination"),
                            itinerary_text=parsed.get("reply", ""),
                            daily_plans=plan_payload.get("daily_plans", []),
                            language=language,
                        )
                    except Exception as save_error:
                        print("Failed to save chatbot itinerary:", save_error)

            return parsed
        except Exception:
            # Fallback: return as plain chat
            return {"response_type": "chat", "reply": raw}

    except Exception as e:
        return {"error": str(e)}


# ----------------------------- chatbot STREAM (SSE) -----------------------------
@app.post("/chatbot-stream")
async def travel_chatbot_stream(
    data: dict,
    db: Session = Depends(get_db),
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    """Streaming version of chatbot using Server-Sent Events."""
    lat = data.get("lat")
    lon = data.get("lon")
    user_question = data.get("question", "")
    language = data.get("language", "English")
    history = data.get("history", [])
    previous_interest_hint = get_user_interest_hint(db, user_id) if user_id else ""

    # Build conversation context from history
    history_text = ""
    if history:
        recent = history[-10:]
        for msg in recent:
            role = "User" if msg.get("sender") == "user" else "Myra"
            history_text += f"{role}: {msg.get('text', '')}\n"

    interest_section = ""
    if previous_interest_hint:
        interest_section = f"User Interest Hint: {previous_interest_hint}\n\n"

    prompt = f"""
You are an intelligent travel assistant named Myra. You are as smart and conversational as ChatGPT or Gemini.

{interest_section}IMPORTANT LANGUAGE RULE:
Respond ONLY in {language}. Do NOT mix languages.

User's Location: Lat: {lat}, Lon: {lon}

Conversation History:
{history_text}

User's Latest Message: {user_question}

INSTRUCTIONS:
First, on its own line, output EXACTLY one of these tags: [EMERGENCY], [PLAN], [OPTIONS], [INFO], or [CHAT]
- [EMERGENCY] if the user mentions an accident, emergency, medical issue, or urgently needs police/hospital help.
- [PLAN] if the user explicitly selected one of your previously given options OR provided enough detail that you are 100% sure what to build.
- [OPTIONS] if the user wants to plan a trip, BUT hasn't decided on a specific destination mapping AND you already know their basic preferences (Starting City, Budget, Travel type, Transport, Interests).
- [CHAT] for casual conversation, OR IF the user wants to plan a trip but you DO NOT yet know their Starting City, Budget, Travel type, Transport, and Interests. In this case, ask friendly follow-up questions to gather these details.
IMPORTANT: DO NOT assume their Starting City from the "User's Location Lat/Lon" above. Always ask them for their starting city if they haven't explicitly mentioned one. Use their Lat/Lon only for "Near Me" info.
- [INFO] if the user wants information or recommendations.

If the tag is [OPTIONS], output a brief message, then on a new line "---OPTIONS_START---", then output valid JSON as a flat list, then "---OPTIONS_END---".
Example:
[
  {{"id": 1, "title": "Beach Trip (Alibag + Kashid)", "description": "Relaxing coastal drive.", "duration": "5 Days"}},
  {{"id": 2, "title": "Hill Station (Lonavala)", "description": "Chill in the mountains.", "duration": "5 Days"}},
  {{"id": 3, "title": "Mixed Trip", "description": "A bit of everything.", "duration": "5 Days"}}
]

If the tag is [PLAN], after your brief summary, output a line containing only "---JSON_START---", then output valid JSON in this exact format, then "---JSON_END---":
{{
  "destination": "City Name",
  "days": 3,
  "daily_plans": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {{
          "time": "09:00 AM",
          "place_name": "Place Name, Dining Options, or Accommodation Options",
          "category": "Attraction",
          "lat": 12.345,
          "lon": 45.678,
          "description": "Detailed 4-6 sentence paragraph explaining the history, appeal, and what to do/see. Make it engaging. For food/hotel, list 3-4 options.",
          "alternatives": ["Alternative Nearby Place 1", "Alternative Nearby Place 2"],
          "cost": "₹200"
        }}
      ]
    }}
  ]
}}

If the tag is [EMERGENCY], output an empathetic message, then on a new line "---EMERGENCY_START---", then output valid JSON in this exact format, then "---EMERGENCY_END---":
{{
  "emergency_type": "Medical or Police",
  "recommended_action": "Seek immediate assistance.",
  "numbers": ["108 (Ambulance)", "100 (Police)"]
}}

CRITICAL REQUIREMENT: For "Food" (meals) and hotel accommodations, DO NOT give a single place. Instead, list 3-4 distinct options in the 'description' and set 'place_name' to "Dining Options" or "Accommodation Options".

For "category", use: "Food", "Attraction", "Travel", "Relax", "Shopping", or "History".
Include 6-9 activities per day. Use real coordinates. Include realistic costs.

If the tag is [INFO] or [CHAT], just respond as a helpful travel assistant. Use bullet points (•) for lists.
Do NOT use Markdown headings or code blocks.
Be warm, friendly, and specific. Remember conversation context.
If the question is not travel-related, politely refuse.
"""

    async def event_generator():
        full_text = ""
        import json as _json
        try:
            response = gemini_model.generate_content(prompt, stream=True)
            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    full_text += chunk.text
                    # SSE format: data: <text>\n\n
                    yield f"data: {_json.dumps({'text': chunk.text})}\n\n"

            # Persist any streamed plan for authenticated users
            if user_id and "---JSON_START---" in full_text and "---JSON_END---" in full_text:
                try:
                    json_text = full_text.split("---JSON_START---", 1)[1].split("---JSON_END---", 1)[0].strip()
                    import json as _json2
                    plan_data = _json2.loads(json_text)
                    if isinstance(plan_data, dict) and plan_data.get("destination") and plan_data.get("daily_plans"):
                        ItineraryService.create_itinerary(
                            db=db,
                            user_id=user_id,
                            start_city=plan_data.get("start_city", "your current location"),
                            destination=plan_data.get("destination"),
                            itinerary_text=plan_data.get("reply", ""),
                            daily_plans=plan_data.get("daily_plans", []),
                            language=language,
                        )
                except Exception as save_error:
                    print("Failed to save streamed chatbot itinerary:", save_error)

            yield f"data: {_json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {_json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )



class IncidentRequest(BaseModel):
    lat: float
    lon: float
    destination: Optional[str] = "your destination"


@app.post("/incident-itinerary")
def incident_itinerary(req: IncidentRequest):
    now = datetime.now()
    hospital = nearest_hospital(req.lat, req.lon)
    if not hospital:
        hospital = {"name": "Nearest Hospital", "distance": "unknown"}

    itinerary_text = f"""
🚨 ACCIDENT OCCURRED – ITINERARY REPLANNED

📍 Accident Location
Latitude: {req.lat}
Longitude: {req.lon}

⏰ {now.strftime('%I:%M %p')}
🚑 Go to nearest hospital
🏥 {hospital['name']}
📏 Distance: {hospital['distance']} km

🛌 {(now + timedelta(hours=2)).strftime('%I:%M %p')}
Rest & observation

😴 Night – Full rest

📅 NEXT DAY – CONTINUE JOURNEY
"""
    prompt = f"""
Generate a brief 1-2 day travel itinerary for {req.destination} focusing on light, relaxing activities suitable for someone recovering from a minor accident. 
Do not include intense physical activities. 
IMPORTANT – Output MUST be valid JSON only. Do not wrap in markdown code blocks.
The JSON structure must be exactly:
{{
  "itinerary_text": "Keep this short summary...",
  "daily_plans": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {{
          "time": "09:00 AM",
          "place_name": "Name of place, or 'Dining Options', or 'Accommodation Options'",
          "category": "Relax",
          "lat": 12.345,
          "lon": 45.678,
          "description": "Detailed 4-6 sentence paragraph explaining the history, appeal, and what to do/see. Make it engaging. For food/hotel, list 3-4 options.",
          "alternatives": ["Alternative Nearby Place 1"],
          "cost": "₹200"
        }}
      ]
    }}
  ]
}}
"""
    try:
        response = gemini_model.generate_content(prompt)
        raw = response.text.strip()
        import json
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
            
        parsed = json.loads(raw.strip())
        parsed["itinerary_text"] = itinerary_text + "\n" + parsed.get("itinerary_text", "")
        return parsed
    except Exception as e:
        return {
            "itinerary_text": itinerary_text + f"\n📍 Continue your relaxing journey in {req.destination}.",
            "daily_plans": []
        }

# ----------------------------- BUSES -----------------------------
@app.get("/buses")
def get_buses(source: str, destination: str, date: str):
    print(f"Searching buses: {source} -> {destination} on {date}")
    import random
    from datetime import datetime, timedelta

    try:
        base_date = datetime.strptime(date, "%Y-%m-%d")
    except:
        base_date = datetime.now()

    mock_buses = []
    operators = ["VRL Travels", "Orange Travels", "SRS Travels", "Kallada Travels", "Neeta Travels"]
    
    for _ in range(5):
        dep_hour = random.randint(18, 23)
        dep_min = random.choice([0, 15, 30, 45])
        duration_hours = random.randint(6, 14)
        
        dep_dt = base_date.replace(hour=dep_hour, minute=dep_min)
        arr_dt = dep_dt + timedelta(hours=duration_hours, minutes=random.randint(0, 59))
        
        price = random.randint(800, 2500)
        seats = random.randint(4, 20)

        mock_buses.append({
            "name": random.choice(operators),
            "departure": dep_dt.strftime("%Y-%m-%dT%H:%M:%S"),
            "arrival": arr_dt.strftime("%Y-%m-%dT%H:%M:%S"),
            "duration": f"{duration_hours}h {random.randint(0, 59)}m",
            "price": price,
            "seats_available": seats
        })
        
    return mock_buses
