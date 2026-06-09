import sys
import os
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, Itinerary, TripCollaborator

def dump():
    sys.stdout.reconfigure(encoding='utf-8')
    db = SessionLocal()
    try:
        print("=== ITINERARIES ===")
        itineraries = db.query(Itinerary).all()
        for it in itineraries:
            print(f"ID={it.id}: user_id={it.user_id}, destination={it.destination}, start_city={it.start_city}")
            
        print("\n=== COLLABORATORS ===")
        collabs = db.query(TripCollaborator).all()
        for c in collabs:
            print(f"ID={c.id}: trip_id={c.trip_id}, user_id={c.user_id}, role={c.role}")
            
        print("\n=== POOJA DETAILS ===")
        pooja = db.query(User).filter(User.username == "Pooja").first()
        if pooja:
            print(f"Pooja: id={pooja.id}, email={pooja.email}")
        else:
            print("Pooja user not found!")
            
    finally:
        db.close()

if __name__ == "__main__":
    dump()
