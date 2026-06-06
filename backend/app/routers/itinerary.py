from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import json
import os
import google.generativeai as genai

from app.database import get_db
from app.models.schemas import ItineraryUpdate
from app.models import Itinerary, TripCollaborator
from app.services.database_service import ItineraryService
from app.services.recommendation_service import RecommendationService
from app.routers.auth import get_current_user_id
from app.services.google_maps import calculate_distance
from pydantic import BaseModel

router = APIRouter(tags=["Itinerary & AI Chatbot"])

# Initialize Gemini generative model
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel("gemini-flash-latest")

# --- Helpers ---

def get_nearest_hospital(lat, lon):
    """Generates a mock nearest hospital for emergency replanning."""
    return {
        "name": "City Care Hospital",
        "lat": lat + 0.01,
        "lon": lon + 0.01,
        "distance": calculate_distance(lat, lon, lat + 0.01, lon + 0.01)
    }

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
    
    # Serialize collaborators/members
    members = []
    try:
        # Access collaborators relationship
        for c in itinerary.collaborators:
            members.append({
                "username": c.user.username if c.user else "Unknown User",
                "email": c.user.email if c.user else "unknown@example.com",
                "role": c.role.value if hasattr(c.role, "value") else str(c.role)
            })
    except Exception as e:
        print("Error serializing collaborators in itinerary:", e)

    data.update({
        "owner_user_id": itinerary.user_id,
        "collaboration_role": access_role,
        "is_shared": itinerary.user_id != user_id,
        "can_edit": itinerary.user_id == user_id,
        "members": members,
    })
    return data


# --- Schemas ---

class IncidentRequest(BaseModel):
    lat: float
    lon: float
    destination: Optional[str] = "your destination"

# --- Endpoints ---

@router.post("/itinerary")
async def generate_itinerary(
    details: dict,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """
    Generate a detailed, time-based travel itinerary using Gemini.
    Saves the generated itinerary in the database for the authenticated user.
    """
    try:
        start_city = details.get("start_city", "your current location")
        destination = details.get("destination", "Unknown destination")
        days = int(details.get("days", 1))
        theme = details.get("theme", "General")
        preferences = details.get("preferences", "")
        start_date = details.get("start_date")
        language = details.get("language", "English")

        if not preferences and user_id:
            preferences = get_user_interest_hint(db, user_id)
        
        lang_name = "Hindi" if language == "Hindi" else ("Marathi" if language == "Marathi" else "English")

        if preferences:
            preferences = preferences.strip()

        start_date_obj = None
        if start_date:
            try:
                start_date_obj = datetime.fromisoformat(start_date)
            except Exception:
                start_date_obj = None

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

        day_headers = []
        for i in range(days):
            day_num = i + 1
            if start_date_obj:
                day_date = (start_date_obj + timedelta(days=i)).date().isoformat()
                day_headers.append(f"DAY {day_num}: (date: {day_date})")
            else:
                day_headers.append(f"DAY {day_num}")

        prompt_days = "The trip days (for your reference):\n" + "\n".join(day_headers) + "\n\nNow produce the JSON:\n\n"
        final_prompt = prompt_header + prompt_days

        response = gemini_model.generate_content(final_prompt)

        generated_content = ""
        if hasattr(response, "text") and response.text:
            generated_content = response.text
        else:
            try:
                if isinstance(response, dict) and "candidates" in response and len(response["candidates"]) > 0:
                    generated_content = response["candidates"][0].get("content", "")
                else:
                    generated_content = str(response)
            except Exception:
                generated_content = str(response)

        try:
            clean_content = generated_content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.startswith("```"):
                clean_content = clean_content[3:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
            
            data = json.loads(clean_content)

            itinerary_id = None
            if user_id and isinstance(data, dict) and data.get("itinerary_text") and data.get("daily_plans"):
                try:
                    itinerary_db = ItineraryService.create_itinerary(
                        db=db,
                        user_id=user_id,
                        start_city=start_city,
                        destination=destination,
                        itinerary_text=data.get("itinerary_text", ""),
                        daily_plans=data.get("daily_plans", []),
                        language=language,
                    )
                    itinerary_id = itinerary_db.id
                except Exception as save_error:
                    print("Failed to save itinerary:", save_error)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to save generated itinerary to database: {str(save_error)}"
                    )

            if itinerary_id:
                data["id"] = itinerary_id
            return data
        except Exception as e:
            print("Failed to parse JSON:", e)
            print("Raw content:", generated_content)
            return {"itinerary_text": generated_content, "daily_plans": []}

    except Exception as e:
        print("ERROR generating itinerary:", e)
        return {"error": str(e)}

@router.get("/itineraries")
async def get_saved_itineraries(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """
    Get all saved itineraries for the authenticated user (owned and shared ones).
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
        return {"itineraries": itineraries}
    except Exception as e:
        print("ERROR fetching itineraries:", e)
        return {"error": str(e)}

@router.get("/itineraries/{itinerary_id}")
async def get_saved_itinerary(
    itinerary_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Get a single saved itinerary details."""
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
        raise HTTPException(status_code=404, detail="Itinerary not found")
    return serialize_itinerary_with_access(itinerary, user_id, access_role)

@router.put("/itineraries/{itinerary_id}")
async def update_saved_itinerary(
    itinerary_id: int,
    payload: ItineraryUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Update an existing saved itinerary."""
    itinerary = ItineraryService.get_user_itinerary(db, user_id, itinerary_id)
    if not itinerary:
        raise HTTPException(status_code=404, detail="Itinerary not found")

    updates = payload.model_dump(exclude_unset=True) if hasattr(payload, "model_dump") else payload.dict(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")

    updated = ItineraryService.update_itinerary(db, itinerary, updates)
    return serialize_itinerary(updated)

@router.delete("/itineraries/{itinerary_id}")
async def delete_saved_itinerary(
    itinerary_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Delete a saved itinerary."""
    itinerary = ItineraryService.get_user_itinerary(db, user_id, itinerary_id)
    if not itinerary:
        raise HTTPException(status_code=404, detail="Itinerary not found")

    ItineraryService.delete_itinerary(db, itinerary)
    return {"message": "Itinerary deleted successfully"}

@router.get("/recommendations")
async def get_recommendations(
    language: str = "English",
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Get personalized itinerary suggestions based on user history."""
    try:
        recommendations = RecommendationService.get_personalized_recommendations(db, user_id, language)
        return {"recommendations": recommendations}
    except Exception as e:
        print("ERROR fetching recommendations:", e)
        return {"error": str(e), "recommendations": RecommendationService.generic_recommendations(language)}

@router.post("/chatbot")
async def travel_chatbot(
    data: dict,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Conversational AI travel assistant (Myra) endpoint."""
    lat = data.get("lat")
    lon = data.get("lon")

    try:
        user_question = data.get("question", "")
        language = data.get("language", "English")
        history = data.get("history", [])
        previous_interest_hint = get_user_interest_hint(db, user_id) if user_id else ""

        history_text = ""
        if history:
            recent = history[-10:]
            for msg in recent:
                role = "User" if msg.get("sender") == "user" else "Myra"
                history_text += f"{role}: {msg.get('text', '')}\n"

        hint_section = f"\nUser Interest Hint: {previous_interest_hint}\n" if previous_interest_hint else ""

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
   - Do NOT use Markdown headings or code blocks.

Now respond to the user's latest message as JSON:
"""

        response = gemini_model.generate_content(prompt)
        raw = response.text.strip()

        try:
            if raw.startswith("```json"):
                raw = raw[7:]
            if raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            parsed = json.loads(raw.strip())

            # Save generated plan
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
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to save chatbot itinerary to database: {str(save_error)}"
                        )

            return parsed
        except Exception:
            return {"response_type": "chat", "reply": raw}

    except Exception as e:
        return {"error": str(e)}

@router.post("/chatbot-stream")
async def travel_chatbot_stream(
    data: dict,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Streaming travel assistant chatbot using Server-Sent Events (SSE)."""
    lat = data.get("lat")
    lon = data.get("lon")
    user_question = data.get("question", "")
    language = data.get("language", "English")
    history = data.get("history", [])
    previous_interest_hint = get_user_interest_hint(db, user_id) if user_id else ""

    history_text = ""
    if history:
        recent = history[-10:]
        for msg in recent:
            role = "User" if msg.get("sender") == "user" else "Myra"
            history_text += f"{role}: {msg.get('text', '')}\n"

    interest_section = f"User Interest Hint: {previous_interest_hint}\n\n" if previous_interest_hint else ""

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
        try:
            response = gemini_model.generate_content(prompt, stream=True)
            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    full_text += chunk.text
                    yield f"data: {json.dumps({'text': chunk.text})}\n\n"

            # Parse and save streamed itinerary plan
            if user_id and "---JSON_START---" in full_text and "---JSON_END---" in full_text:
                try:
                    json_text = full_text.split("---JSON_START---", 1)[1].split("---JSON_END---", 1)[0].strip()
                    plan_data = json.loads(json_text)
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
                    yield f"data: {json.dumps({'error': f'Failed to save streamed chatbot itinerary: {str(save_error)}'})}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/incident-itinerary")
def incident_itinerary(req: IncidentRequest, user_id: int = Depends(get_current_user_id)):
    """
    Replans the travel itinerary dynamically in case of an accident/emergency location coordinates.
    Correctly resolves the nearest hospital using the local helper.
    """
    now = datetime.now()
    hospital = get_nearest_hospital(req.lat, req.lon)
    
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
        
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
            
        parsed = json.loads(raw.strip())
        parsed["itinerary_text"] = itinerary_text + "\n" + parsed.get("itinerary_text", "")
        return parsed
    except Exception:
        return {
            "itinerary_text": itinerary_text + f"\n📍 Continue your relaxing journey in {req.destination}.",
            "daily_plans": []
        }
