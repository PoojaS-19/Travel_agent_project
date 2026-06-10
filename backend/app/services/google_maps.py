import os
import requests
import polyline
from math import radians, sin, cos, sqrt, atan2
from dotenv import load_dotenv
import socket
import urllib3.util.connection as urllib3_conn

# Force IPv4 for urllib3/requests to fix TLS handshake timeouts on broken IPv6 routes
def allowed_gai_family():
    return socket.AF_INET
urllib3_conn.allowed_gai_family = allowed_gai_family

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
    try:
        r = requests.get(url, timeout=10).json()
        if r.get("status") == "OK":
            return r.get("results", [])[:limit]
    except Exception as e:
        print(f"Google Maps get_places error: {e}")
    return []

def get_nearby_places(lat, lon, place_type, radius=5000, limit=5):
    url = (
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        f"?location={lat},{lon}&radius={radius}&type={place_type}"
        f"&key={GOOGLE_API_KEY}"
    )
    try:
        r = requests.get(url, timeout=10).json()
        if r.get("status") == "OK":
            return r.get("results", [])[:limit]
    except Exception as e:
        print(f"Google Maps get_nearby_places error: {e}")
    return []

def get_place_photos(place_name: str, limit: int = 3):
    url = f"https://maps.googleapis.com/maps/api/place/textsearch/json?query={place_name}&key={GOOGLE_API_KEY}"
    photos = []
    try:
        r = requests.get(url, timeout=10).json()
        if r.get("status") == "OK" and r.get("results"):
            for result in r["results"][:3]:
                for photo in result.get("photos", []):
                    photos.append(photo["photo_reference"])
                    if len(photos) >= limit:
                        break
                if len(photos) >= limit:
                    break
    except Exception as e:
        print(f"Google Maps get_place_photos error: {e}")
    return photos

def get_directions(origin: str, destination: str, strategy: str = "Fastest Route"):
    """Fetch driving directions and return decoded polyline, distance, and duration."""
    url = f"https://maps.googleapis.com/maps/api/directions/json?origin={origin}&destination={destination}&key={GOOGLE_API_KEY}&alternatives=true"
    
    if strategy == "Toll-Free Route":
        url += "&avoid=tolls"
    if strategy == "Scenic Route":
        url += "&avoid=highways"
        
    try:
        r = requests.get(url, timeout=10).json()
        if r.get("status") == "OK" and r.get("routes"):
            routes = r["routes"]
            
            # Select best route based on strategy
            best_route = routes[0]
            if strategy == "Fuel Efficient Route" and len(routes) > 1:
                # Pick shortest distance route
                best_route = min(routes, key=lambda rt: rt["legs"][0]["distance"]["value"])
                
            points = polyline.decode(best_route["overview_polyline"]["points"])
            legs = best_route["legs"][0]
            distance = legs["distance"]["text"]
            duration = legs["duration"]["text"]
            
            return {
                "polyline": points,
                "distance": distance,
                "duration": duration,
                "start_location": legs["start_location"],
                "end_location": legs["end_location"],
                "summary": best_route.get("summary", "Standard Route")
            }
    except Exception as e:
        print(f"Google Maps get_directions error: {e}")
    return None
