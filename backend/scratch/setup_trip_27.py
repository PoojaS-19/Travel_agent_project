import sys
import os
from decimal import Decimal

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, Itinerary, TripCollaborator
from app.models.collaboration import TripExpense
from app.services.auth_service import AuthService

def setup():
    db = SessionLocal()
    try:
        # 1. Update user 73 credentials
        leader = db.query(User).filter(User.id == 73).first()
        if leader:
            print(f"Updating leader ID 73: username={leader.username}")
            leader.email = "demoleader@example.com"
            leader.password_hash = AuthService.hash_password("password123!")
            db.add(leader)
            print("Leader credentials updated successfully.")
        else:
            print("Leader ID 73 not found!")

        # 2. Update user 74 credentials just in case
        buddy = db.query(User).filter(User.id == 74).first()
        if buddy:
            print(f"Updating buddy ID 74: username={buddy.username}")
            buddy.password_hash = AuthService.hash_password("password123!")
            db.add(buddy)
            print("Buddy credentials updated successfully.")

        # 3. Mark all activities in Trip 27 as completed
        trip = db.query(Itinerary).filter(Itinerary.id == 27).first()
        if trip:
            print(f"Updating trip {trip.id} ({trip.destination}) daily plans to complete...")
            plans = trip.daily_plans
            if plans:
                for day in plans:
                    for act in day.get("activities", []):
                        act["status"] = "completed"
                trip.daily_plans = plans
                db.add(trip)
                print("All activities marked as completed.")
            else:
                print("Trip has no daily plans!")
        else:
            print("Trip 27 not found!")

        # 4. Clear any existing expenses for trip 27 to avoid duplicates
        db.query(TripExpense).filter(TripExpense.trip_id == 27).delete()
        print("Cleared old expenses for trip 27.")

        # 5. Log new expenses for trip 27
        expenses = [
            {"place": "Eiffel Tower", "amount": Decimal("1500.00"), "desc": "Tickets for group", "user_id": 73},
            {"place": "Louvre Museum", "amount": Decimal("1200.00"), "desc": "Entry pass", "user_id": 74},
            {"place": "Seine River Cruise", "amount": Decimal("800.00"), "desc": "Evening boat ride", "user_id": 73},
            {"place": "Dinner", "amount": Decimal("1000.00"), "desc": "Local cuisine", "user_id": 74},
        ]

        for e in expenses:
            exp = TripExpense(
                trip_id=27,
                user_id=e["user_id"],
                place_name=e["place"],
                amount=e["amount"],
                description=e["desc"]
            )
            db.add(exp)
            print(f"Logged expense: {e['place']} = Rs {e['amount']} paid by user_id={e['user_id']}")

        db.commit()
        print("Database transaction committed successfully!")

    except Exception as ex:
        db.rollback()
        print(f"Error occurred: {ex}")
    finally:
        db.close()

if __name__ == "__main__":
    setup()
