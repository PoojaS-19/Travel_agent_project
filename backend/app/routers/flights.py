from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
import os

from app.database import get_db
from app.models import Flight
from app.services.database_service import FlightService
from app.routers.auth import get_current_user_id
from app.services.amadeus import amadeus

router = APIRouter(prefix="/flights", tags=["Flights"])

@router.get("")
def get_flights(
    source: str,
    destination: str,
    departure: str,
    return_date: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """
    Search for flights - tries database caching first, then Amadeus API, then generates mock data.
    """
    print(f"Searching flights: {source} -> {destination} on {departure}")
    
    # 1. Check if flights already exist in database cache
    existing_flights = db.query(Flight).filter(
        Flight.source == source,
        Flight.destination == destination
    ).all()
    
    if existing_flights:
        print("Returning flights from database cache")
        return [{
            "id": f.id,
            "airline": f.airline,
            "price": float(f.price),
            "departure": f.departure.isoformat(),
            "arrival": f.arrival.isoformat()
        } for f in existing_flights[:5]]
    
    # 2. Try real Amadeus API
    try:
        if not os.getenv("AMADEUS_API_KEY") or not os.getenv("AMADEUS_API_SECRET"):
            raise Exception("Amadeus API keys missing in configurations")

        response = amadeus.shopping.flight_offers_search.get(
            originLocationCode=source,
            destinationLocationCode=destination,
            departureDate=departure,
            returnDate=return_date,
            adults=1,
            currencyCode="INR"
        )

        flights = []
        for f in response.data[:3]:
            # Convert ISO dates
            dep_str = f["itineraries"][0]["segments"][0]["departure"]["at"].replace("Z", "+00:00")
            arr_str = f["itineraries"][0]["segments"][0]["arrival"]["at"].replace("Z", "+00:00")
            dep_dt = datetime.fromisoformat(dep_str)
            arr_dt = datetime.fromisoformat(arr_str)
            
            flight_db = FlightService.create_flight(
                db=db,
                airline=f["validatingAirlineCodes"][0],
                price=float(f["price"]["grandTotal"]),
                departure=dep_dt,
                arrival=arr_dt,
                source=source,
                destination=destination,
                api_response=f
            )
            
            flights.append({
                "id": flight_db.id,
                "airline": flight_db.airline,
                "price": float(flight_db.price),
                "departure": flight_db.departure.isoformat(),
                "arrival": flight_db.arrival.isoformat()
            })

        return flights

    except Exception as e:
        print(f"Amadeus API search failed: {e}. Falling back to MOCK data generation.")
        
        # 3. Fallback to realistic mock data generation
        try:
            base_date = datetime.strptime(departure, "%Y-%m-%d")
        except Exception:
            base_date = datetime.now()

        mock_flights = []
        airlines = ["AI", "6E", "UK", "SG"]
        
        for _ in range(5):
            dep_hour = random.randint(6, 22)
            dep_min = random.choice([0, 15, 30, 45])
            duration_hours = random.randint(1, 4)
            
            dep_dt = base_date.replace(hour=dep_hour, minute=dep_min)
            arr_dt = dep_dt + timedelta(hours=duration_hours, minutes=random.randint(0, 59))
            price = random.randint(3000, 15000)

            # Save generated mock flight to database
            flight_db = FlightService.create_flight(
                db=db,
                airline=random.choice(airlines),
                price=float(price),
                departure=dep_dt,
                arrival=arr_dt,
                source=source,
                destination=destination
            )

            mock_flights.append({
                "id": flight_db.id,
                "airline": flight_db.airline,
                "price": float(flight_db.price),
                "departure": flight_db.departure.isoformat(),
                "arrival": flight_db.arrival.isoformat()
            })
            
        return mock_flights
