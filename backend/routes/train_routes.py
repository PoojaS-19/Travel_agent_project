from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session, aliased
from typing import Optional
import json
import os
from datetime import datetime

from app.database import get_db
from app.models import Train, TrainType, TrainStop
from app.routers.auth import get_current_user_id

router = APIRouter(prefix="/trains", tags=["Trains"])

# Legacy JSON path for data migration
DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "all_trains.json")

async def migrate_trains_from_json(db: Session):
    """One-time migration to load trains and stops from JSON into database"""
    try:
        # Check if stops are already migrated to avoid redundant work
        stops_count = db.query(TrainStop).count()
        if stops_count > 0:
            print(f"Trains and stops already migrated ({stops_count} stops present). Skipping migration.")
            return

        if os.path.exists(DATA_PATH):
            print("Starting train and stops migration from JSON...")
            
            # Clear old trains so we don't have duplicate trains without stops
            db.query(Train).delete()
            db.commit()

            with open(DATA_PATH, 'r', encoding='utf-8') as f:
                trains_data = json.load(f)
                
                print(f"Found {len(trains_data)} trains in JSON. Beginning migration...")
                
                for idx, train_data in enumerate(trains_data):
                    try:
                        dep_str = train_data.get("departure", "00:00")
                        arr_str = train_data.get("arrival", "00:00")
                        
                        if dep_str in ["Source", "Destination", ""]:
                            dep_str = "00:00"
                        if arr_str in ["Source", "Destination", ""]:
                            arr_str = "00:00"
                            
                        if ":" not in dep_str:
                            dep_str = "00:00"
                        if ":" not in arr_str:
                            arr_str = "00:00"
                            
                        departure_time = datetime.strptime(dep_str, "%H:%M").time()
                        arrival_time = datetime.strptime(arr_str, "%H:%M").time()
                        
                        train = Train(
                            train_number=train_data.get("train_no", "N/A"),
                            name=train_data.get("name", "N/A"),
                            source=train_data.get("source", ""),
                            destination=train_data.get("destination", ""),
                            departure=departure_time,
                            arrival=arrival_time,
                            duration=train_data.get("duration", "N/A"),
                            type=train_data.get("type", "Passenger"),
                            running_days=json.dumps(train_data.get("runningDays", {}))
                        )
                        db.add(train)
                        db.flush()  # Generates train.id
                        
                        # Add route stops
                        stops_data = train_data.get("route", [])
                        for stop_item in stops_data:
                            stop = TrainStop(
                                train_id=train.id,
                                station_code=stop_item.get("station_code", "").upper(),
                                station_name=stop_item.get("station_name", "").upper(),
                                sequence=stop_item.get("sequence", 1),
                                arrival=stop_item.get("arrival", ""),
                                departure=stop_item.get("departure", ""),
                                day=stop_item.get("day", 1),
                                distance=stop_item.get("distance", "")
                            )
                            db.add(stop)
                            
                        if idx % 500 == 0 and idx > 0:
                            db.commit()
                            print(f"Migrated {idx} / {len(trains_data)} trains...")
                            
                    except Exception as e:
                        print(f"Error preparing train {train_data.get('name')}: {e}")
                        db.rollback()
                
                db.commit()
                print("Trains and stops migration completed successfully!")
        else:
            print(f"Warning: Migration data file not found at {DATA_PATH}")
    except Exception as e:
        print(f"Error migrating train data: {e}")
        db.rollback()

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

def calculate_dynamic_duration(dep_time_str, arr_time_str, dep_day, arr_day):
    try:
        # Handle source / destination tags
        if dep_time_str in ["Source", ""]:
            dep_time_str = "00:00"
        if arr_time_str in ["Destination", ""]:
            arr_time_str = "00:00"
            
        dep_hours, dep_mins = map(int, dep_time_str.split(':'))
        arr_hours, arr_mins = map(int, arr_time_str.split(':'))
        
        dep_total_mins = dep_hours * 60 + dep_mins
        arr_total_mins = arr_hours * 60 + arr_mins
        
        day_diff = int(arr_day) - int(dep_day)
        
        total_duration_mins = (day_diff * 24 * 60) - dep_total_mins + arr_total_mins
        if total_duration_mins < 0:
            total_duration_mins += 24 * 60  # Account for minor daily rollovers
            
        hours = total_duration_mins // 60
        mins = total_duration_mins % 60
        return f"{hours}h {mins}m", total_duration_mins
    except:
        return "N/A", 999999

@router.get("/stations")
def search_stations(
    query: str = Query(..., min_length=2, description="Search term for station name or code"),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """
    Search distinct stations by name or code for autocomplete suggestions
    """
    results = db.query(TrainStop.station_name, TrainStop.station_code).\
        filter(
            (TrainStop.station_name.ilike(f"%{query}%")) | 
            (TrainStop.station_code.ilike(f"%{query}%"))
        ).\
        distinct().\
        limit(15).\
        all()
        
    stations_list = [
        {
            "name": r.station_name.title(),
            "code": r.station_code.upper()
        } for r in results
    ]
    return {"stations": stations_list}

@router.get("/")
def search_trains(
    source: str = Query(..., description="Source station name or code"),
    destination: str = Query(..., description="Destination station name or code"),
    type: Optional[str] = Query(None, description="Train type (Express, Passenger, Superfast)"),
    sort: Optional[str] = Query(None, description="Sort by 'departure' or 'duration'"),
    date: Optional[str] = Query(None, description="Date of journey (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """
    Search trains from database where source and destination are intermediate stops in sequence
    """
    # Create aliases to query source and destination stops
    src_stop = aliased(TrainStop)
    dest_stop = aliased(TrainStop)
    
    # Query trains going through both stops where source comes before destination
    query = db.query(
        Train, 
        src_stop.departure.label("src_departure"),
        dest_stop.arrival.label("dest_arrival"),
        src_stop.station_name.label("src_name"),
        dest_stop.station_name.label("dest_name"),
        src_stop.station_code.label("src_code"),
        dest_stop.station_code.label("dest_code"),
        src_stop.day.label("src_day"),
        dest_stop.day.label("dest_day")
    ).\
        join(src_stop, Train.id == src_stop.train_id).\
        join(dest_stop, Train.id == dest_stop.train_id).\
        filter(
            (src_stop.station_name.ilike(f"%{source}%")) | (src_stop.station_code.ilike(f"{source}")),
            (dest_stop.station_name.ilike(f"%{destination}%")) | (dest_stop.station_code.ilike(f"{destination}")),
            src_stop.sequence < dest_stop.sequence
        )
        
    # Filter by type if provided
    if type:
        query = query.filter(Train.type.ilike(f"%{type}%"))
        
    results = query.all()
    
    # Format results
    trains_list = []
    for row in results:
        train, src_dep, dest_arr, src_name, dest_name, src_code, dest_code, src_day, dest_day = row
        
        # Calculate dynamic duration and sort value
        duration_str, duration_mins = calculate_dynamic_duration(
            src_dep, dest_arr, src_day, dest_day
        )
        
        # Parse departure time to time object or fallback for sorting
        try:
            dep_time = datetime.strptime(src_dep if src_dep not in ["Source", ""] else "00:00", "%H:%M").time()
        except:
            dep_time = datetime.strptime("00:00", "%H:%M").time()
            
        trains_list.append({
            "id": train.id,
            "train_number": train.train_number,
            "name": train.name,
            "source": f"{src_name.title()} ({src_code.upper()})",
            "destination": f"{dest_name.title()} ({dest_code.upper()})",
            "departure": src_dep if src_dep not in ["Source", ""] else "00:00",
            "arrival": dest_arr if dest_arr not in ["Destination", ""] else "00:00",
            "duration": duration_str,
            "duration_mins": duration_mins,
            "type": train.type,
            "running_days": json.loads(train.running_days) if isinstance(train.running_days, str) else train.running_days,
            "dep_time_obj": dep_time
        })
        
    # Filter by running day if date provided
    if date:
        target_day = get_day_of_week(date)
        if target_day:
            trains_list = [
                t for t in trains_list 
                if t["running_days"] and isinstance(t["running_days"], dict) and t["running_days"].get(target_day, False)
            ]
            
    # Sort results
    if sort == "departure":
        trains_list.sort(key=lambda x: x["dep_time_obj"])
    elif sort == "duration":
        trains_list.sort(key=lambda x: x["duration_mins"])
        
    # Clean up temporary fields before responding
    for t in trains_list:
        t.pop("dep_time_obj", None)
        t.pop("duration_mins", None)
        
    return {"trains": trains_list[:30], "count": len(trains_list[:30])}
