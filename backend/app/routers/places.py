from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import requests
import os

from app.database import get_db
from app.routers.auth import get_current_user_id
from app.services.google_maps import (
    get_places,
    get_nearby_places,
    get_place_photos,
    calculate_distance,
    GOOGLE_API_KEY
)

router = APIRouter(tags=["Places & Map Services"])

@router.get("/hotels")
def get_hotels(city: str, user_id: int = Depends(get_current_user_id)):
    """
    Search for top hotels in a city using Google Places Text Search.
    """
    if not city or not city.strip():
        raise HTTPException(status_code=400, detail="City query is required")
    
    results = get_places(f"best hotels in {city}")
    return results

@router.get("/restaurants")
def get_restaurants(city: str, user_id: int = Depends(get_current_user_id)):
    """
    Search for restaurants in a city using Google Places Text Search.
    """
    if not city or not city.strip():
        raise HTTPException(status_code=400, detail="City query is required")
    
    results = get_places(f"restaurants in {city}")
    return results

@router.get("/place-image")
def get_place_image(place: str, index: int = 0, user_id: int = Depends(get_current_user_id)):
    """
    Fetch a single place photo by index using Google Places photo reference.
    Streams back the image directly to the client.
    """
    if not place:
        raise HTTPException(status_code=400, detail="Place query is required")
    
    photos = get_place_photos(place)
    
    if photos and index < len(photos):
        photo_ref = photos[index]
        img_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={photo_ref}&key={GOOGLE_API_KEY}"
        img_resp = requests.get(img_url, stream=True)
        return StreamingResponse(img_resp.iter_content(chunk_size=1024), media_type=img_resp.headers.get("Content-Type", "image/jpeg"))
    
    raise HTTPException(status_code=404, detail="No image found for the specified place")

@router.get("/place-image-count")
def get_place_image_count(place: str, user_id: int = Depends(get_current_user_id)):
    """
    Returns the count of available photos for a place (max 3).
    """
    if not place:
        return {"count": 0}
    
    photos = get_place_photos(place)
    return {"count": len(photos)}

@router.post("/nearby")
def nearby_places(data: dict, user_id: int = Depends(get_current_user_id)):
    """
    Find nearby tourist attractions, lodging, restaurants, and hospitals.
    """
    lat = data.get("lat")
    lon = data.get("lon")

    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="Location coordinate lat/lon not available")

    place_types = {
        "places": "tourist_attraction",
        "hotels": "lodging",
        "restaurants": "restaurant",
        "hospitals": "hospital"
    }

    results = {}

    for key, place_type in place_types.items():
        res = get_nearby_places(lat, lon, place_type, radius=5000, limit=5)
        results[key] = []

        for p in res:
            plat = p["geometry"]["location"]["lat"]
            plon = p["geometry"]["location"]["lng"]

            results[key].append({
                "name": p["name"],
                "address": p.get("vicinity", ""),
                "distance": calculate_distance(lat, lon, plat, plon)
            })

    return results

@router.post("/emergency")
def emergency(data: dict, user_id: int = Depends(get_current_user_id)):
    """
    Fetch and rank nearest general and private hospitals.
    """
    lat = data.get("lat")
    lon = data.get("lon")

    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="Location coordinates lat/lon are required")

    # Use Google Nearby search with custom types and keywords
    general_hospitals = get_nearby_places(lat, lon, "hospital", radius=10000, limit=10)
    
    # We will search explicitly for private hospitals
    url_private = (
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={lat},{lon}&radius=10000&type=hospital&keyword=private"
        f"&key={GOOGLE_API_KEY}"
    )
    try:
        res_private = requests.get(url_private).json()
        private_hospitals = res_private.get("results", [])[:10]
    except Exception:
        private_hospitals = []

    all_results = general_hospitals + private_hospitals

    if not all_results:
        return {"hospitals": []}

    # Deduplicate by place_id
    seen_place_ids = set()
    unique_hospitals = []
    
    for h in all_results:
        place_id = h.get("place_id", h["name"])
        if place_id not in seen_place_ids:
            seen_place_ids.add(place_id)
            
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

    # Sort hospitals by proximity distance
    unique_hospitals.sort(key=lambda x: x["distance"])

    return {"hospitals": unique_hospitals[:3]}
