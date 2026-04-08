import random
from datetime import datetime, timedelta

def get_mock_flights(departure_date: str, source: str, destination: str, limit: int = 5):
    """
    Generates realistic-looking mock flight data.
    """
    try:
        base_date = datetime.strptime(departure_date, "%Y-%m-%d")
    except:
        base_date = datetime.now()

    mock_flights = []
    airlines = ["AI", "6E", "UK", "SG"]  # Air India, Indigo, Vistara, SpiceJet
    
    for _ in range(limit):
        dep_hour = random.randint(6, 22)
        dep_min = random.choice([0, 15, 30, 45])
        duration_hours = random.randint(1, 4)
        
        dep_dt = base_date.replace(hour=dep_hour, minute=dep_min)
        arr_dt = dep_dt + timedelta(hours=duration_hours, minutes=random.randint(0, 59))
        
        price = random.randint(3000, 15000)

        mock_flights.append({
            "airline": random.choice(airlines),
            "price": f"{price}.00",
            "departure": dep_dt.strftime("%Y-%m-%dT%H:%M:%S"),
            "arrival": arr_dt.strftime("%Y-%m-%dT%H:%M:%S")
        })
    return mock_flights

def get_mock_trains(from_code: str, to_code: str):
    """
    Generates realistic-looking mock train data.
    """
    return [
        {
            "train_no": "12951",
            "train_name": "Rajdhani Express",
            "departure": "17:00",
            "arrival": "08:35",
            "duration": "15h 35m",
            "from": from_code,
            "to": to_code,
            "price": "₹2,450"
        },
        {
            "train_no": "12009",
            "train_name": "Shatabdi Express",
            "departure": "06:20",
            "arrival": "12:50",
            "duration": "6h 30m",
            "from": from_code,
            "to": to_code,
            "price": "₹1,200"
        }
    ]
