from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from amadeus import Client, ResponseError
from dotenv import load_dotenv
import os
import google.generativeai as genai
import requests
from pydantic import BaseModel
from pydantic import BaseModel
from datetime import datetime, timedelta
import math

from math import radians, sin, cos, sqrt, atan2

class IncidentRequest(BaseModel):
    lat: float
    lon: float



def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)*2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)*2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return round(R * c, 2)


# Load .env once
load_dotenv()

# Debug print (keep for testing)
print("GOOGLE:", os.getenv("GOOGLE_API_KEY"))
print("GEMINI:", os.getenv("GEMINI_API_KEY"))
print("AMADEUS KEY:", os.getenv("AMADEUS_API_KEY"))
print("AMADEUS SECRET:", os.getenv("AMADEUS_API_SECRET"))

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



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


# ----------------------------- FLIGHTS -----------------------------
@app.get("/flights")
def get_flights(source: str, destination: str, departure: str, return_date: str):
    print(f"Searching flights: {source} -> {destination} on {departure}")
    try:
        # Try real API first
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
            flights.append({
                "airline": f["validatingAirlineCodes"][0],
                "price": f["price"]["grandTotal"],
                "departure": f["itineraries"][0]["segments"][0]["departure"]["at"],
                "arrival": f["itineraries"][0]["segments"][0]["arrival"]["at"]
            })

        return flights

    except Exception as e:
        print(f"Amadeus API failed or not configured: {e}. Returning MOCK data.")
        # Fallback to realistic mock data
        import random
        from datetime import datetime, timedelta

        # Parse the requested departure date to make mock times realistic
        try:
            base_date = datetime.strptime(departure, "%Y-%m-%d")
        except:
            base_date = datetime.now()

        mock_flights = []
        airlines = ["AI", "6E", "UK", "SG"] # Air India, Indigo, Vistara, SpiceJet
        
        for _ in range(5):
            # Randomize time
            dep_hour = random.randint(6, 22)
            dep_min = random.choice([0, 15, 30, 45])
            duration_hours = random.randint(1, 4)
            
            dep_dt = base_date.replace(hour=dep_hour, minute=dep_min)
            arr_dt = dep_dt + timedelta(hours=duration_hours, minutes=random.randint(0, 59))
            
            # Random price
            price = random.randint(3000, 15000)

            mock_flights.append({
                "airline": random.choice(airlines),
                "price": f"{price}.00",
                "departure": dep_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                "arrival": arr_dt.strftime("%Y-%m-%dT%H:%M:%S")
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

    url = (
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={lat},{lon}&rankby=distance&type=hospital"
        f"&key={GOOGLE_API_KEY}"
    )

    res = requests.get(url).json()

    if not res.get("results"):
        return {"error": "No hospital found nearby"}

    h = res["results"][0]

    return {
        "name": h["name"],
        "address": h.get("vicinity", ""),
        "distance": calculate_distance(
            lat, lon,
            h["geometry"]["location"]["lat"],
            h["geometry"]["location"]["lng"]
        )
    }




# ----------------------------- ITINERARY (GEMINI) -----------------------------
from datetime import datetime, timedelta

@app.post("/itinerary")
async def generate_itinerary(details: dict):
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
        
        if language == "Hindi":
          lang_name = "Hindi"
        elif language == "Marathi":
          lang_name = "Marathi"
        else:
          lang_name = "English"



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


If Starting City is different from Destination, include travel from Starting City to Destination on DAY 1 with realistic travel time and cost.


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
          "place_name": "Name of place",
          "category": "Attraction",
          "lat": 12.345,
          "lon": 45.678,
          "description": "2-3 sentences describing the activity.",
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
            return data # Returns dict with itinerary_text and daily_plans
        except Exception as e:
            print("Failed to parse JSON:", e)
            print("Raw content:", generated_content)
            # Fallback for plain text if model failed JSON
            return {"itinerary_text": generated_content, "daily_plans": []}

    except Exception as e:
        print("ERROR generating itinerary:", e)
        return {"error": str(e)}

    
# ----------------------------- chatbot (GEMINI) - SMART VERSION -----------------------------
@app.post("/chatbot")
async def travel_chatbot(data: dict):
    lat = data.get("lat")
    lon = data.get("lon")

    try:
        user_question = data.get("question", "")
        language = data.get("language", "English")
        history = data.get("history", [])  # conversation history

        # Build conversation context from history
        history_text = ""
        if history:
            recent = history[-10:]  # last 10 messages
            for msg in recent:
                role = "User" if msg.get("sender") == "user" else "Myra"
                history_text += f"{role}: {msg.get('text', '')}\n"

        prompt = f"""
You are an intelligent travel assistant named Myra. You are as smart and conversational as ChatGPT or Gemini.

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
               "place_name": "Name of place",
               "category": "Attraction",
               "lat": 12.345,
               "lon": 45.678,
               "description": "2-3 sentences describing the activity.",
               "cost": "₹200"
             }}
           ]
         }}
       ]
     }}
   }}

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
            return parsed
        except Exception:
            # Fallback: return as plain chat
            return {"response_type": "chat", "reply": raw}

    except Exception as e:
        return {"error": str(e)}


# ----------------------------- chatbot STREAM (SSE) -----------------------------
@app.post("/chatbot-stream")
async def travel_chatbot_stream(data: dict):
    """Streaming version of chatbot using Server-Sent Events."""
    lat = data.get("lat")
    lon = data.get("lon")
    user_question = data.get("question", "")
    language = data.get("language", "English")
    history = data.get("history", [])

    # Build conversation context from history
    history_text = ""
    if history:
        recent = history[-10:]
        for msg in recent:
            role = "User" if msg.get("sender") == "user" else "Myra"
            history_text += f"{role}: {msg.get('text', '')}\n"

    prompt = f"""
You are an intelligent travel assistant named Myra. You are as smart and conversational as ChatGPT or Gemini.

IMPORTANT LANGUAGE RULE:
Respond ONLY in {language}. Do NOT mix languages.

User's Location: Lat: {lat}, Lon: {lon}

Conversation History:
{history_text}

User's Latest Message: {user_question}

INSTRUCTIONS:
First, on its own line, output EXACTLY one of these tags: [PLAN], [INFO], or [CHAT]
- [PLAN] if the user wants you to create/make/plan a trip or itinerary
- [INFO] if the user wants information or recommendations
- [CHAT] for casual conversation

Then respond naturally.

If the tag is [PLAN], after your brief summary, output a line containing only "---JSON_START---", then output valid JSON in this exact format, then output a line containing only "---JSON_END---":
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
          "place_name": "Place Name",
          "category": "Attraction",
          "lat": 12.345,
          "lon": 45.678,
          "description": "2-3 sentences.",
          "cost": "₹200"
        }}
      ]
    }}
  ]
}}

For "category", use: "Food", "Attraction", "Travel", "Relax", "Shopping", or "History".
Include 6-9 activities per day. Use real coordinates. Include realistic costs.

If the tag is [INFO] or [CHAT], just respond as a helpful travel assistant. Use bullet points (•) for lists.
Do NOT use Markdown headings or code blocks.
Be warm, friendly, and specific. Remember conversation context.
If the question is not travel-related, politely refuse.
"""

    async def event_generator():
        try:
            response = gemini_model.generate_content(prompt, stream=True)
            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    # SSE format: data: <text>\n\n
                    import json as _json
                    yield f"data: {_json.dumps({'text': chunk.text})}\n\n"
            yield f"data: {_json.dumps({'done': True})}\n\n"
        except Exception as e:
            import json as _json
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

import sqlite3
import uuid
import random
import json
from typing import List, Optional
from fastapi import HTTPException
from pydantic import BaseModel

# Read provider env vars (if you already loaded .env earlier these will be present)
TRAIN_API_URL = os.getenv("TRAIN_API_URL")  # e.g. "https://provider.example.com"
TRAIN_API_KEY = os.getenv("TRAIN_API_KEY")

DB_PATH = "demo_bookings.db"

# --- DB init (safe to call multiple times) ---
def _init_demo_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS demo_bookings (
          id TEXT PRIMARY KEY,
          pnr TEXT,
          train_no TEXT,
          train_name TEXT,
          from_code TEXT,
          to_code TEXT,
          date TEXT,
          class_type TEXT,
          passengers TEXT,
          contact TEXT,
          status TEXT,
          created_at TEXT
        )
        """
    )
    conn.commit()
    conn.close()

_init_demo_db()


# --- Helpers ---
def _generate_mock_pnr():
    # pseudo-random 10-digit string (looks like typical PNR length)
    return str(random.randint(10*9, 10*10 - 1))


def _call_provider_trains_between(from_code: str, to_code: str, date: str):
    """
    Call configured provider to fetch trains between stations.
    If TRAIN_API_URL/API key missing or provider fails, returns a safe fallback sample.
    Adjust this function to match your chosen provider's exact API schema.
    """
    if not TRAIN_API_URL or not TRAIN_API_KEY:
        return {
            "trains": [
                {
                    "train_no": "12951",
                    "train_name": "Rajdhani Express",
                    "departure": "17:00",
                    "arrival": "08:35",
                    "duration": "15h 35m",
                    "from": from_code,
                    "to": to_code,
                    "price": "₹2,450"
                },
                {
                    "train_no": "12009",
                    "train_name": "Shatabdi Express",
                    "departure": "06:20",
                    "arrival": "12:50",
                    "duration": "6h 30m",
                    "from": from_code,
                    "to": to_code,
                    "price": "₹1,200"
                },
                {
                    "train_no": "12293",
                    "train_name": "Duronto Express",
                    "departure": "11:00",
                    "arrival": "06:00",
                    "duration": "19h 00m",
                    "from": from_code,
                    "to": to_code,
                    "price": "₹2,100"
                },
                {
                    "train_no": "12137",
                    "train_name": "Punjab Mail",
                    "departure": "19:35",
                    "arrival": "21:10",
                    "duration": "25h 35m",
                    "from": from_code,
                    "to": to_code,
                    "price": "₹800"
                },
                 {
                    "train_no": "22436",
                    "train_name": "Vande Bharat",
                    "departure": "15:00",
                    "arrival": "23:00",
                    "duration": "8h 00m",
                    "from": from_code,
                    "to": to_code,
                    "price": "₹1,850"
                }
            ]
        }

    # Default example request — replace path/headers with provider docs if using RapidAPI/other
    try:
        url = f"{TRAIN_API_URL}/trains-between"
        headers = {"x-api-key": TRAIN_API_KEY}
        params = {"from": from_code, "to": to_code, "date": date}
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        # safe fallback so demo doesn't break
        return {
            "error": "provider_error",
            "message": str(e),
            "trains": [
                {
                    "train_no": "10101",
                    "train_name": "Sample Express",
                    "departure": "09:00",
                    "arrival": "13:00",
                    "duration": "4h",
                    "from": from_code,
                    "to": to_code,
                }
            ],
        }


def _call_provider_schedule(train_no: str):
    if not TRAIN_API_URL or not TRAIN_API_KEY:
        return {
            "train_no": train_no,
            "route": [
                {"station": "SRC", "arr": "--", "dep": "09:00"},
                {"station": "MID", "arr": "10:30", "dep": "10:35"},
                {"station": "DST", "arr": "13:00", "dep": "--"},
            ],
        }
    try:
        url = f"{TRAIN_API_URL}/train-schedule"
        headers = {"x-api-key": TRAIN_API_KEY}
        params = {"train": train_no}
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": "provider_error", "message": str(e)}


# --- Pydantic model for demo booking request ---
class DemoBookRequest(BaseModel):
    train_no: str
    train_name: Optional[str] = ""
    from_code: str
    to_code: str
    date: str
    class_type: Optional[str] = "SL"
    passengers: List[dict]  # e.g. [{ "name": "Alice", "age": 29 }]
    contact: Optional[dict] = None  # e.g. { "name": "Alice", "phone": "...", "email": "..." }


# -------------------- ROUTES --------------------

@app.get("/trains")
def trains_endpoint(from_code: str, to_code: str, date: str):
    """
    Return train list (real provider when configured, fallback otherwise).
    Query params: from_code, to_code, date
    """
    data = _call_provider_trains_between(from_code, to_code, date)
    return data


@app.get("/train/{train_no}/schedule")
def train_schedule_endpoint(train_no: str):
    """
    Return schedule/route for a train (provider or fallback).
    """
    data = _call_provider_schedule(train_no)
    return data

REMAINING_PLACES = [
    {
        "name": "Goa",
        "lat": 15.2993,
        "lon": 74.1240,
        "days": 2,
        "spots": [
            "Baga Beach",
            "Fort Aguada",
            "Dudhsagar Falls"
        ]
    },
    {
        "name": "Gokarna",
        "lat": 14.5479,
        "lon": 74.3188,
        "days": 1,
        "spots": [
            "Om Beach",
            "Kudle Beach"
        ]
    }
]


def nearest_hospital(lat, lon):
    return {
        "name": "City Care Hospital",
        "lat": lat + 0.01,
        "lon": lon + 0.01,
        "distance": round(1.2, 2)
    }


@app.post("/demo-book")
def demo_book_endpoint(payload: DemoBookRequest):
    """
    Create a demo booking (fake) and save to SQLite. Returns booking details incl. mock PNR.
    """
    pnr = _generate_mock_pnr()
    booking_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()

    # Save booking
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        INSERT INTO demo_bookings (id, pnr, train_no, train_name, from_code, to_code, date, class_type, passengers, contact, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            booking_id,
            pnr,
            payload.train_no,
            payload.train_name or "",
            payload.from_code,
            payload.to_code,
            payload.date,
            payload.class_type,
            json.dumps(payload.passengers),
            json.dumps(payload.contact) if payload.contact else "{}",
            "CONFIRMED_DEMO",
            created_at,
        ),
    )
    conn.commit()
    conn.close()

    return {
        "success": True,
        "message": "Demo booking created (NOT a real reservation).",
        "booking": {
            "id": booking_id,
            "pnr": pnr,
            "train_no": payload.train_no,
            "train_name": payload.train_name or "",
            "from_code": payload.from_code,
            "to_code": payload.to_code,
            "date": payload.date,
            "class_type": payload.class_type,
            "passengers": payload.passengers,
            "contact": payload.contact,
            "status": "CONFIRMED_DEMO",
            "created_at": created_at,
        },
    }


@app.get("/demo-book/{pnr}")
def get_demo_booking_endpoint(pnr: str):
    """
    Retrieve demo booking details by mock PNR.
    """
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, pnr, train_no, train_name, from_code, to_code, date, class_type, passengers, contact, status, created_at FROM demo_bookings WHERE pnr = ?", (pnr,))
    row = c.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="PNR not found")
    id_, pnr, train_no, train_name, from_code, to_code, date, class_type, passengers, contact, status, created_at = row
    return {
        "id": id_,
        "pnr": pnr,
        "train_no": train_no,
        "train_name": train_name,
        "from_code": from_code,
        "to_code": to_code,
        "date": date,
        "class_type": class_type,
        "passengers": json.loads(passengers) if passengers else [],
        "contact": json.loads(contact) if contact else {},
        "status": status,
        "created_at": created_at,
    }


class IncidentRequest(BaseModel):
    lat: float
    lon: float


@app.post("/incident-itinerary")
def incident_itinerary(req: IncidentRequest):
    now = datetime.now()
    hospital = nearest_hospital(req.lat, req.lon)

    plan = f"""
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
"""

    next_day = now + timedelta(days=1)

    plan += f"""

📅 NEXT DAY – CONTINUE JOURNEY
⏰ {next_day.strftime('%I:%M %p')}
Starting from accident location
"""

    # 🔁 LOOP REMAINING PLACES
    for place in REMAINING_PLACES:
        plan += f"""

📍 Destination: {place['name']}
🕒 Stay: {place['days']} day(s)
"""

        for spot in place["spots"]:
            plan += f"• Visit {spot}\n"

    plan += """

✅ Old itinerary cancelled
✅ New itinerary generated for remaining places
"""

    return {"plan": plan.strip()}
