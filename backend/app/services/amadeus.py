import os
from amadeus import Client
from dotenv import load_dotenv

load_dotenv()

amadeus = Client(
    client_id=os.getenv("AMADEUS_API_KEY"),
    client_secret=os.getenv("AMADEUS_API_SECRET")
)

def search_flights(source, destination, departure_date, return_date, adults=1, limit=3):
    """
    Search flight offers using Amadeus API.
    """
    try:
        response = amadeus.shopping.flight_offers_search.get(
            originLocationCode=source,
            destinationLocationCode=destination,
            departureDate=departure_date,
            returnDate=return_date,
            adults=adults,
            currencyCode="INR"
        )
        flights = []
        for f in response.data[:limit]:
            flights.append({
                "airline": f["validatingAirlineCodes"][0],
                "price": f["price"]["grandTotal"],
                "departure": f["itineraries"][0]["segments"][0]["departure"]["at"],
                "arrival": f["itineraries"][0]["segments"][0]["arrival"]["at"]
            })
        return flights
    except Exception as e:
        print(f"Amadeus API error: {e}")
        return []
