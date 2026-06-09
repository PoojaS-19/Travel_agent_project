import sys
import os
import json

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, Itinerary, TripCollaborator

def inspect():
    # Force output to handle utf-8
    sys.stdout.reconfigure(encoding='utf-8')
    
    db = SessionLocal()
    try:
        pooja = db.query(User).filter(User.username == "Pooja").first()
        if pooja:
            print(f"Found Pooja: id={pooja.id}, username={pooja.username}")
            
            # Find trip
            trips = db.query(Itinerary).filter(Itinerary.user_id == pooja.id).all()
            print(f"Pooja has {len(trips)} trips:")
            for t in trips:
                print(f"  ID={t.id}: destination={t.destination}, start_city={t.start_city}")
                if "pune" in str(t.destination).lower() or "sinhagad" in str(t.destination).lower():
                    print("    Matching trip!")
                    print(f"    Daily plans length: {len(t.daily_plans) if t.daily_plans else 0}")
                    print(f"    Daily plans: {json.dumps(t.daily_plans, indent=2)}")
                    
                    # Collaborators
                    collabs = db.query(TripCollaborator).filter(TripCollaborator.trip_id == t.id).all()
                    print(f"    Collaborators count: {len(collabs)}")
                    for c in collabs:
                        c_user = db.query(User).filter(User.id == c.user_id).first()
                        username = c_user.username if c_user else f"#{c.user_id}"
                        print(f"      - {username} (role={c.role})")
        else:
            print("Pooja not found.")
            
    finally:
        db.close()

if __name__ == "__main__":
    inspect()
