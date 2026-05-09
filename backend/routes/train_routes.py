from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import json
import os
from datetime import datetime

from app.database import get_db
from app.models import Train, TrainType
from app.services.database_service import TrainService

router = APIRouter(prefix="/trains", tags=["Trains"])

# Legacy JSON path for data migration
DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "all_trains.json")

async def migrate_trains_from_json(db: Session):
    """One-time migration to load trains from JSON into database"""
    if os.path.exists(DATA_PATH):
        try:
            with open(DATA_PATH, 'r', encoding='utf-8') as f:
                trains_data = json.load(f)
                for train_data in trains_data:
                    # Check if train already exists
                    existing = db.query(Train).filter(
                        Train.train_number == train_data.get("train_no")
                    ).first()
                    
                    if not existing:
                        try:
                            train = Train(
                                train_number=train_data.get("train_no", "N/A"),
                                name=train_data.get("name", "N/A"),
                                source=train_data.get("source", ""),
                                destination=train_data.get("destination", ""),
                                departure=datetime.strptime(train_data.get("departure", "00:00"), "%H:%M").time(),
                                arrival=datetime.strptime(train_data.get("arrival", "00:00"), "%H:%M").time(),
                                duration=train_data.get("duration", "N/A"),
                                type=train_data.get("type", "Passenger"),
                                running_days=train_data.get("runningDays", {})
                            )
                            db.add(train)
                        except Exception as e:
                            print(f"Error migrating train {train_data.get('name')}: {e}")
                
                db.commit()
                print("Trains migration completed")
        except Exception as e:
            print(f"Error loading train data from JSON: {e}")

@router.on_event("startup")
async def startup_event():
    """Run migration on startup"""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        await migrate_trains_from_json(db)
    finally:
        db.close()

def get_day_of_week(date_str):
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
        return days[dt.weekday()]
    except:
        return None

@router.get("/")
def search_trains(
    source: str = Query(..., description="Source station name"),
    destination: str = Query(..., description="Destination station name"),
    type: Optional[str] = Query(None, description="Train type (Express, Passenger, Superfast)"),
    sort: Optional[str] = Query(None, description="Sort by 'departure' or 'duration'"),
    date: Optional[str] = Query(None, description="Date of journey (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Search trains from database using source, destination, type, and date filters
    """
    source_lower = source.lower()
    dest_lower = destination.lower()
    
    # Query trains from database
    query = db.query(Train).filter(
        Train.source.ilike(f"%{source}%"),
        Train.destination.ilike(f"%{destination}%")
    )
    
    # Filter by type if provided
    if type:
        query = query.filter(Train.type.ilike(f"%{type}%"))
    
    results = query.all()
    
    # Filter by running day if date provided
    if date:
        target_day = get_day_of_week(date)
        filtered_results = []
        for train in results:
            if train.running_days and isinstance(train.running_days, dict):
                if train.running_days.get(target_day, False):
                    filtered_results.append(train)
            else:
                # If no running days specified, include the train
                filtered_results.append(train)
        results = filtered_results
    
    # Sort results
    if sort == "departure":
        results.sort(key=lambda x: x.departure if x.departure else "99:99")
    elif sort == "duration":
        def duration_to_mins(duration_str):
            if not duration_str or duration_str == "N/A":
                return 999999
            try:
                parts = duration_str.split('h')
                hours = int(parts[0].strip())
                mins = int(parts[1].replace('m', '').strip())
                return hours * 60 + mins
            except:
                return 999999
        results.sort(key=lambda x: duration_to_mins(x.duration))
    
    # Format response
    trains_list = [{
        "id": train.id,
        "train_number": train.train_number,
        "name": train.name,
        "source": train.source,
        "destination": train.destination,
        "departure": train.departure.strftime("%H:%M") if train.departure else "N/A",
        "arrival": train.arrival.strftime("%H:%M") if train.arrival else "N/A",
        "duration": train.duration,
        "type": train.type,
        "running_days": train.running_days
    } for train in results[:20]]
    
    return {"trains": trains_list, "count": len(trains_list)}

    
