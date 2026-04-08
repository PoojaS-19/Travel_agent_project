from fastapi import APIRouter
from app.services.amadeus import search_flights
from app.utils.mock_data import get_mock_flights

router = APIRouter()

@router.get("/flights")
def get_flights(source: str, destination: str, departure: str, return_date: str):
    """
    Search for flights. Returns real data if available, otherwise mock data.
    """
    print(f"Searching flights: {source} -> {destination} on {departure}")
    
    # Try real API first
    flights = search_flights(source, destination, departure, return_date)
    
    if not flights:
        print("Amadeus API returned no results. Returning MOCK data.")
        return get_mock_flights(departure, source, destination)
        
    return flights
