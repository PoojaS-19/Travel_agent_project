from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session, aliased
from typing import Optional
import json
import os
from datetime import datetime

from app.database import get_db
from app.models import Train, TrainType, TrainStop

router = APIRouter(prefix="/trains", tags=["Trains"])

# Legacy JSON path for data migration
DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "data", "all_trains.json")

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
                            running_days=train_data.get("runningDays", {})
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

def resolve_fuzzy_station(query: str, db: Session) -> Optional[tuple[str, str]]:
    """
    Given a query, find the single best matching station (name, code) using exact
    substring check first, falling back to a vowel-insensitive wildcard search ranked by similarity.
    """
    if not query:
        return None
        
    query_clean = query.strip().upper()
    if len(query_clean) < 2:
        return None
        
    # 1. Try exact match (equality)
    exact_match = db.query(TrainStop.station_name, TrainStop.station_code).\
        filter(
            (TrainStop.station_name.ilike(query_clean)) | 
            (TrainStop.station_code.ilike(query_clean))
        ).\
        first()
    if exact_match:
        return exact_match.station_name, exact_match.station_code

    # 2. Try prefix match (starts with query)
    prefix_match = db.query(TrainStop.station_name, TrainStop.station_code).\
        filter(
            (TrainStop.station_name.ilike(f"{query_clean}%")) | 
            (TrainStop.station_code.ilike(f"{query_clean}%"))
        ).\
        first()
    if prefix_match:
        return prefix_match.station_name, prefix_match.station_code

    # 3. Find all matches containing the query as substring, rank them
    import difflib
    results = db.query(TrainStop.station_name, TrainStop.station_code).\
        filter(
            (TrainStop.station_name.ilike(f"%{query_clean}%")) | 
            (TrainStop.station_code.ilike(f"%{query_clean}%"))
        ).\
        distinct().\
        limit(100).\
        all()
        
    if results:
        best_match = None
        best_score = -1.0
        for r in results:
            name_score = difflib.SequenceMatcher(None, query_clean, r.station_name.upper()).ratio()
            code_score = difflib.SequenceMatcher(None, query_clean, r.station_code.upper()).ratio()
            score = max(name_score, code_score)
            
            # Boost if name starts with query
            if r.station_name.upper().startswith(query_clean):
                score += 0.3
            # Boost if exact word match
            words = r.station_name.upper().replace("-", " ").replace("(", " ").replace(")", " ").split()
            if query_clean in words:
                score += 0.2
                
            if score > best_score:
                best_score = score
                best_match = (r.station_name, r.station_code)
        if best_match:
            return best_match

    # 4. Fallback to vowel-insensitive fuzzy wildcard
    vowels = "aeiouy"
    chars = []
    for char in query_clean.lower():
        if char in vowels:
            if not chars or chars[-1] != '%':
                chars.append('%')
        else:
            chars.append(char)
    pattern = "%" + "%".join(chars) + "%"
    while "%%" in pattern:
        pattern = pattern.replace("%%", "%")
        
    results = db.query(TrainStop.station_name, TrainStop.station_code).\
        filter(
            (TrainStop.station_name.ilike(pattern)) | 
            (TrainStop.station_code.ilike(pattern))
        ).\
        distinct().\
        limit(100).\
        all()
        
    if not results:
        return None
        
    best_match = None
    best_score = -1.0
    for r in results:
        name_score = difflib.SequenceMatcher(None, query_clean, r.station_name.upper()).ratio()
        code_score = difflib.SequenceMatcher(None, query_clean, r.station_code.upper()).ratio()
        score = max(name_score, code_score)
        
        if r.station_name.upper().startswith(query_clean[0]):
            score += 0.2
            
        if score > best_score:
            best_score = score
            best_match = (r.station_name, r.station_code)
            
    return best_match

@router.get("/stations")
def search_stations(
    query: str = Query(..., min_length=2, description="Search term for station name or code"),
    db: Session = Depends(get_db)
):
    """
    Search distinct stations by name or code for autocomplete suggestions
    """
    # 1. Try exact search
    results = db.query(TrainStop.station_name, TrainStop.station_code).\
        filter(
            (TrainStop.station_name.ilike(f"%{query}%")) | 
            (TrainStop.station_code.ilike(f"%{query}%"))
        ).\
        distinct().\
        limit(15).\
        all()
        
    results_list = list(results)

    # 2. If results are empty or fewer than 5, try fuzzy fallback
    if len(results_list) < 5:
        import difflib
        vowels = "aeiouy"
        chars = []
        for char in query.lower():
            if char in vowels:
                if not chars or chars[-1] != '%':
                    chars.append('%')
            else:
                chars.append(char)
        pattern = "%" + "%".join(chars) + "%"
        while "%%" in pattern:
            pattern = pattern.replace("%%", "%")
            
        fuzzy_results = db.query(TrainStop.station_name, TrainStop.station_code).\
            filter(
                (TrainStop.station_name.ilike(pattern)) | 
                (TrainStop.station_code.ilike(pattern))
            ).\
            distinct().\
            limit(150).\
            all()
            
        # Rank the fuzzy results
        ranked_results = []
        existing_codes = {r.station_code.upper() for r in results_list}
        
        for r in fuzzy_results:
            if r.station_code.upper() in existing_codes:
                continue
            name_score = difflib.SequenceMatcher(None, query.upper(), r.station_name.upper()).ratio()
            code_score = difflib.SequenceMatcher(None, query.upper(), r.station_code.upper()).ratio()
            score = max(name_score, code_score)
            
            # Boost if name starts with the same letter
            if r.station_name and r.station_name.upper().startswith(query[0].upper()):
                score += 0.2
                
            ranked_results.append((r, score))
            
        ranked_results.sort(key=lambda x: x[1], reverse=True)
        
        # Add top fuzzy matches to fill up to 15 suggestions
        for r, score in ranked_results:
            if len(results_list) >= 15:
                break
            results_list.append(r)
            
    stations_list = [
        {
            "name": r.station_name.title(),
            "code": r.station_code.upper()
        } for r in results_list
    ]
    return {"stations": stations_list}

@router.get("/")
def search_trains(
    source: str = Query(..., description="Source station name or code"),
    destination: str = Query(..., description="Destination station name or code"),
    type: Optional[str] = Query(None, description="Train type (Express, Passenger, Superfast)"),
    sort: Optional[str] = Query(None, description="Sort by 'departure' or 'duration'"),
    date: Optional[str] = Query(None, description="Date of journey (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    Search trains from RapidAPI real-time data with database fallback
    """
    import requests
    import random
    from datetime import datetime, timedelta

    # 1. Resolve source and destination to their best station codes/names
    resolved_src = resolve_fuzzy_station(source, db)
    resolved_dest = resolve_fuzzy_station(destination, db)
    
    if not resolved_src or not resolved_dest:
        src_name, src_code = source.title(), source.upper()
        dest_name, dest_code = destination.title(), destination.upper()
    else:
        src_name, src_code = resolved_src
        dest_name, dest_code = resolved_dest

    TRAIN_API_KEY = os.getenv("TRAIN_API_KEY")
    TRAIN_API_URL = os.getenv("TRAIN_API_URL", "https://irctc-insight.p.rapidapi.com")

    # If we have resolved codes, try hitting RapidAPI
    if TRAIN_API_KEY:
        try:
            headers = {
                "x-rapidapi-key": TRAIN_API_KEY,
                "x-rapidapi-host": "irctc-insight.p.rapidapi.com"
            }
            url = f"{TRAIN_API_URL}/trainBetweenStations"
            querystring = {"fromStnCode": src_code, "toStnCode": dest_code, "date": date}
            response = requests.get(url, headers=headers, params=querystring, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "data" in data:
                    api_trains = []
                    for t in data["data"]:
                        api_trains.append({
                            "id": f"API-{t.get('trainNo', random.randint(1000, 9999))}",
                            "train_number": t.get("trainNo", "N/A"),
                            "name": t.get("trainName", "Unknown Express").title(),
                            "source": f"{t.get('fromStnName', src_name)} ({t.get('fromStnCode', src_code).upper()})",
                            "destination": f"{t.get('toStnName', dest_name)} ({t.get('toStnCode', dest_code).upper()})",
                            "departure": t.get("departureTime", "00:00"),
                            "arrival": t.get("arrivalTime", "00:00"),
                            "duration": t.get("duration", "N/A"),
                            "type": "Express",
                            "running_days": {},
                            "live_status": random.choice(["On Time", "Delayed 15m", "Delayed 5m"])
                        })
                    if len(api_trains) > 0:
                        if sort == "departure":
                            api_trains.sort(key=lambda x: x["departure"])
                        return {"trains": api_trains[:30], "count": len(api_trains), "source": "rapidapi"}
        except Exception as e:
            print(f"RapidAPI Fetch Failed: {e}")
            pass

    # Database Fallback Logic
    # Query trains going through both stops where source comes before destination
    src_stop = aliased(TrainStop)
    dest_stop = aliased(TrainStop)
    
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
            src_stop.station_code == src_code,
            dest_stop.station_code == dest_code,
            src_stop.sequence < dest_stop.sequence
        )
        
    if type:
        query = query.filter(Train.type.ilike(f"%{type}%"))
        
    results = query.all()
    
    # Format results
    trains_list = []
    for row in results:
        train, src_dep, dest_arr, s_name, d_name, s_code, d_code, src_day, dest_day = row
        duration_str, duration_mins = calculate_dynamic_duration(
            src_dep, dest_arr, src_day, dest_day
        )
        
        try:
            dep_time = datetime.strptime(src_dep if src_dep not in ["Source", ""] else "00:00", "%H:%M").time()
        except:
            dep_time = datetime.strptime("00:00", "%H:%M").time()
            
        trains_list.append({
            "id": train.id,
            "train_number": train.train_number,
            "name": train.name,
            "source": f"{s_name.title()} ({s_code.upper()})",
            "destination": f"{d_name.title()} ({d_code.upper()})",
            "departure": src_dep if src_dep not in ["Source", ""] else "00:00",
            "arrival": dest_arr if dest_arr not in ["Destination", ""] else "00:00",
            "duration": duration_str,
            "duration_mins": duration_mins,
            "type": train.type,
            "running_days": train.running_days,
            "dep_time_obj": dep_time
        })
        
    if date:
        target_day = get_day_of_week(date)
        if target_day:
            trains_list = [
                t for t in trains_list 
                if t["running_days"] and isinstance(t["running_days"], dict) and t["running_days"].get(target_day, False)
            ]
            
    if sort == "departure":
        trains_list.sort(key=lambda x: x["dep_time_obj"])
    elif sort == "duration":
        trains_list.sort(key=lambda x: x["duration_mins"])
    for t in trains_list:
        t.pop("dep_time_obj", None)
        t.pop("duration_mins", None)
        
    if len(trains_list) == 0:
        return {
            "trains": [],
            "count": 0,
            "message": f"Train not found. There is no direct train between {src_name} ({src_code}) and {dest_name} ({dest_code})."
        }
        
    return {"trains": trains_list[:30], "count": len(trains_list[:30])}
