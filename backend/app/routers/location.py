from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.routers.auth import get_current_user_id
from app.models.location import LiveLocation, LocationHistory, SOSAlert
from app.models.models import User
import math

router = APIRouter(prefix="/api/location", tags=["Live Location"])

@router.get("/{trip_id}")
def get_trip_locations(trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    locations = db.query(LiveLocation).filter(LiveLocation.trip_id == trip_id).all()
    result = []
    for loc in locations:
        user = db.query(User).filter(User.id == loc.user_id).first()
        result.append({
            "user_id": loc.user_id,
            "trip_id": loc.trip_id,
            "name": user.username if user else "Unknown",
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "timestamp": loc.timestamp.isoformat() if loc.timestamp else None
        })
    return result

@router.get("/history/{trip_id}/{member_id}")
def get_location_history(trip_id: int, member_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    history = db.query(LocationHistory).filter(
        LocationHistory.trip_id == trip_id,
        LocationHistory.user_id == member_id
    ).order_by(LocationHistory.timestamp.asc()).all()
    
    return [
        {
            "latitude": h.latitude,
            "longitude": h.longitude,
            "timestamp": h.timestamp.isoformat() if h.timestamp else None
        } for h in history
    ]

@router.delete("/{trip_id}")
def delete_trip_locations(trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    db.query(LiveLocation).filter(LiveLocation.trip_id == trip_id).delete()
    db.query(LocationHistory).filter(LocationHistory.trip_id == trip_id).delete()
    db.query(SOSAlert).filter(SOSAlert.trip_id == trip_id).delete()
    db.commit()
    return {"message": "All location data for trip deleted."}

# Mock ETA Calculation to avoid exposing backend key. 
# In reality, this would use google maps python client.
@router.get("/eta/{trip_id}")
def get_eta(trip_id: int, lat: float, lng: float, destLat: float, destLng: float, db: Session = Depends(get_db)):
    # Haversine distance in km
    R = 6371
    dLat = math.radians(destLat - lat)
    dLon = math.radians(destLng - lng)
    a = math.sin(dLat/2) * math.sin(dLat/2) + \
        math.cos(math.radians(lat)) * math.cos(math.radians(destLat)) * \
        math.sin(dLon/2) * math.sin(dLon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance_km = R * c
    
    # Assume 40 km/h average speed in city
    duration_hours = distance_km / 40.0
    duration_mins = max(1, int(duration_hours * 60))
    
    return {
        "distance": {"text": f"{distance_km:.1f} km", "value": int(distance_km * 1000)},
        "duration": {"text": f"{duration_mins} mins", "value": duration_mins * 60}
    }
