import json
import os
from datetime import datetime, timedelta

def calculate_duration(dep_time, arr_time, dep_day, arr_day):
    try:
        dep_hours, dep_mins = map(int, dep_time.split(':'))
        arr_hours, arr_mins = map(int, arr_time.split(':'))
        
        dep_total_mins = dep_hours * 60 + dep_mins
        arr_total_mins = arr_hours * 60 + arr_mins
        
        day_diff = int(arr_day) - int(dep_day)
        
        total_duration_mins = (day_diff * 24 * 60) - dep_total_mins + arr_total_mins
        
        hours = total_duration_mins // 60
        mins = total_duration_mins % 60
        return f"{hours}h {mins}m"
    except Exception:
        return "N/A"

def process_file(filepath, train_type):
    if not os.path.exists(filepath):
        print(f"Warning: File {filepath} not found.")
        return []
        
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    normalized_data = []
    
    for train in data:
        try:
            route_info = train.get("trainRoute", [])
            if not route_info:
                continue
                
            source_station = route_info[0]
            dest_station = route_info[-1]
            
            source_name = source_station.get("stationName", "").split(" - ")[0]
            dest_name = dest_station.get("stationName", "").split(" - ")[0]
            
            departure = source_station.get("departs", "")
            arrival = dest_station.get("arrives", "")
            
            if departure == "Source" or departure == "":
                 departure = source_station.get("arrives", "") if source_station.get("arrives", "") != "Source" else "00:00"
                 
            if arrival == "Destination" or arrival == "":
                 arrival = dest_station.get("departs", "") if dest_station.get("departs", "") != "Destination" else "00:00"
            
            duration = calculate_duration(
                departure, 
                arrival, 
                source_station.get("day", "1"), 
                dest_station.get("day", "1")
            )
            
            normalized_data.append({
                "train_no": train.get("trainNumber", ""),
                "name": train.get("trainName", ""),
                "source": source_name,
                "destination": dest_name,
                "departure": departure,
                "arrival": arrival,
                "duration": duration,
                "type": train_type,
                "runningDays": train.get("runningDays", {})
            })
        except Exception as e:
            # Skip trains that cause errors during parsing
            continue
            
    return normalized_data

def main():
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    
    files = [
        ("EXP-TRAINS.json", "Express"),
        ("PASS-TRAINS.json", "Passenger"),
        ("SF-TRAINS.json", "Superfast")
    ]
    
    all_trains = []
    
    for filename, train_type in files:
        filepath = os.path.join(data_dir, filename)
        trains = process_file(filepath, train_type)
        all_trains.extend(trains)
        print(f"Processed {len(trains)} from {filename}")
        
    output_path = os.path.join(data_dir, "all_trains.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_trains, f, indent=4)
        
    print(f"Successfully saved {len(all_trains)} total trains to {output_path}")

if __name__ == "__main__":
    main()
