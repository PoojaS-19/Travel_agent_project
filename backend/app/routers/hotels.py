from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import requests
from app.services.google_maps import get_places, get_place_photos, GOOGLE_API_KEY

router = APIRouter()

@router.get("/hotels")
def get_hotels(city: str):
    if not city or not city.strip():
        raise HTTPException(status_code=400, detail="City query is required")
    
    results = get_places(f"best hotels in {city}")
    if not results:
        return []
    return results

@router.get("/restaurants")
def get_restaurants(city: str):
    if not city or not city.strip():
        raise HTTPException(status_code=400, detail="City query is required")
    
    results = get_places(f"restaurants in {city}")
    return results

@router.get("/place-image")
def get_place_image(place: str, index: int = 0):
    """Fetch a single place photo by index."""
    if not place:
        raise HTTPException(status_code=400, detail="Place required")
    
    photos = get_place_photos(place)
    
    if photos and index < len(photos):
        photo_ref = photos[index]
        img_url = f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={photo_ref}&key={GOOGLE_API_KEY}"
        img_resp = requests.get(img_url, stream=True)
        return StreamingResponse(img_resp.iter_content(chunk_size=1024), media_type=img_resp.headers.get("Content-Type", "image/jpeg"))
    
    raise HTTPException(status_code=404, detail="No image found")

@router.get("/place-image-count")
def get_place_image_count(place: str):
    """Returns how many photos are available for a place (max 3)."""
    if not place:
        return {"count": 0}
    
    photos = get_place_photos(place)
    return {"count": len(photos)}
