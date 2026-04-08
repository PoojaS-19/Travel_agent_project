import os
import requests
from math import radians, sin, cos, sqrt, atan2
from dotenv import load_dotenv

load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Haversine formula to calculate distance between two points.
    """
    R = 6371  # Earth radius in km
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return round(R * c, 2)

def get_places(query: str, limit: int = 5):
    url = (
        f"https://maps.googleapis.com/maps/api/place/textsearch/json?"
        f"query={query}&key={GOOGLE_API_KEY}"
    )
    r = requests.get(url).json()
    if r.get("status") == "OK":
        return r.get("results", [])[:limit]
    return []

def get_nearby_places(lat, lon, place_type, radius=5000, limit=5):
    url = (
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={lat},{lon}&radius={radius}&type={place_type}"
        f"&key={GOOGLE_API_KEY}"
    )
    r = requests.get(url).json()
    if r.get("status") == "OK":
        return r.get("results", [])[:limit]
    return []

def get_place_photos(place_name: str, limit: int = 3):
    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={place_name}&key={GOOGLE_API_KEY}"
    r = requests.get(url).json()
    photos = []
    if r.get("status") == "OK" and r.get("results"):
        for result in r["results"][:3]:
            for photo in result.get("photos", []):
                photos.append(photo["photo_reference"])
                if len(photos) >= limit:
                    break
            if len(photos) >= limit:
                break
    return photos
