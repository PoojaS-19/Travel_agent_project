import sys
import os
import json
from decimal import Decimal
import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, Itinerary, TripCollaborator
from app.models.collaboration import CollaboratorRole, TripExpense
from app.services.collaboration_service import CollaborationService

class DateTimeEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, (datetime.date, datetime.datetime)):
            return o.isoformat()
        return super().default(o)

def setup():
    db = SessionLocal()
    collab_service = CollaborationService(db)
    try:
        trip_id = 16
        
        # 1. Find trip and mark as complete (all activities in daily_plans marked as "completed")
        trip = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
        if not trip:
            print("Trip 16 not found!")
            return
            
        print(f"Updating trip {trip.id} '{trip.destination}' daily plans to complete...")
        plans = trip.daily_plans
        if plans:
            for day in plans:
                for act in day.get("activities", []):
                    act["status"] = "completed"
            trip.daily_plans = plans
            db.add(trip)
            db.flush()
            print("All activities marked as completed.")
        
        # 2. Add followers: Chinmay (2), Nageshri (17), columbus (22)
        followers_to_add = [
            {"user_id": 2, "username": "Chinmay"},
            {"user_id": 17, "username": "Nageshri"},
            {"user_id": 22, "username": "columbus"}
        ]
        
        for f in followers_to_add:
            collab = db.query(TripCollaborator).filter_by(trip_id=trip_id, user_id=f["user_id"]).first()
            if not collab:
                collab = TripCollaborator(
                    trip_id=trip_id,
                    user_id=f["user_id"],
                    role=CollaboratorRole.FOLLOWER
                )
                db.add(collab)
                print(f"Added {f['username']} as FOLLOWER.")
            else:
                collab.role = CollaboratorRole.FOLLOWER
                db.add(collab)
                print(f"{f['username']} was already a collaborator, set role to FOLLOWER.")
        db.flush()

        # 3. Add expenses:
        db.query(TripExpense).filter_by(trip_id=trip_id).delete()
        db.flush()
        
        expenses_to_log = [
            {"user_id": 1, "place_name": "Local Bus (PMPML)", "amount": Decimal("160.00"), "description": "Bus tickets to Sinhagad foothills"},
            {"user_id": 2, "place_name": "Lunch at Fort shacks", "amount": Decimal("600.00"), "description": "Pithla Bhakri for group"},
            {"user_id": 17, "place_name": "Return State Bus", "amount": Decimal("1000.00"), "description": "State transport tickets to Alibag"},
            {"user_id": 22, "place_name": "Sinhagad Fort Ruins", "amount": Decimal("80.00"), "description": "Entry tickets for group"}
        ]
        
        for exp in expenses_to_log:
            db_exp = TripExpense(
                trip_id=trip_id,
                user_id=exp["user_id"],
                place_name=exp["place_name"],
                amount=exp["amount"],
                description=exp["description"]
            )
            db.add(db_exp)
            print(f"Logged expense: {exp['place_name']} = Rs {exp['amount']} paid by user_id={exp['user_id']}")
        
        db.commit()
        print("\nDatabase transactions committed successfully!")
        
        # 4. Compute splits
        splits_result = collab_service.get_expense_splits(trip_id, 1)
        print("\n--- RESULTS JSON ---")
        print(json.dumps(splits_result, indent=2, cls=DateTimeEncoder))
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    setup()
