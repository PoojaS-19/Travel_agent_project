from fastapi import APIRouter, Query
import random
from datetime import datetime, timedelta

router = APIRouter(prefix="/buses", tags=["Buses"])

@router.get("/")
def get_buses(source: str, destination: str, date: str):
    # Mock real-time bus data since there is no public open API for buses
    operators = ["Neeta Travels", "VRL Travels", "Zingbus", "IntrCity SmartBus", "Orange Travels", "Kallada Travels", "SRS Travels", "Sharma Transports"]
    bus_types = ["A/C Sleeper (2+1)", "Volvo Multi-Axle I-Shift", "Non A/C Seater (2+2)", "Scania Multi-Axle", "BharatBenz A/C Sleeper", "AC Semi-Sleeper"]
    
    buses = []
    num_buses = random.randint(5, 15)
    
    try:
        base_date = datetime.strptime(date, "%Y-%m-%d")
    except:
        base_date = datetime.now()
        
    for i in range(num_buses):
        dep_hour = random.randint(5, 23)
        dep_minute = random.choice([0, 15, 30, 45])
        duration_hours = random.randint(4, 16)
        duration_mins = random.choice([0, 15, 30, 45])
        
        dep_time = base_date.replace(hour=dep_hour, minute=dep_minute)
        arr_time = dep_time + timedelta(hours=duration_hours, minutes=duration_mins)
        
        buses.append({
            "id": f"BUS-{random.randint(1000, 9999)}",
            "name": random.choice(operators),
            "type": random.choice(bus_types),
            "departure": dep_time.isoformat(),
            "arrival": arr_time.isoformat(),
            "duration": f"{duration_hours}h {duration_mins}m",
            "price": random.randint(450, 2800),
            "seats_available": random.randint(1, 35)
        })
    
    # Sort by departure time
    buses.sort(key=lambda x: x["departure"])
    return buses
