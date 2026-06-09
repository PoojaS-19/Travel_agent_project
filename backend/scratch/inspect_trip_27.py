import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User, Itinerary, TripCollaborator
from app.models.collaboration import TripExpense

def inspect():
    db = SessionLocal()
    try:
        # Get demo_leader details
        leader = db.query(User).filter(User.email == "demoleader@example.com").first()
        if leader:
            print(f"Leader found: id={leader.id}, username={leader.username}, email={leader.email}")
        else:
            print("Leader demoleader@example.com not found!")

        # Get Trip 27 details
        trip = db.query(Itinerary).filter(Itinerary.id == 27).first()
        if trip:
            print(f"Trip found: id={trip.id}, destination={trip.destination}, user_id={trip.user_id}")
            print("Daily Plans:")
            print(trip.daily_plans)
        else:
            print("Trip 27 not found!")

        # Get collaborators
        collabs = db.query(TripCollaborator).filter(TripCollaborator.trip_id == 27).all()
        print("\nCollaborators:")
        for c in collabs:
            u = db.query(User).filter(User.id == c.user_id).first()
            username = u.username if u else "Unknown"
            print(f"  Collaborator ID={c.id}: user_id={c.user_id} ({username}), role={c.role}")

        # Get expenses
        expenses = db.query(TripExpense).filter(TripExpense.trip_id == 27).all()
        print("\nExpenses:")
        for e in expenses:
            u = db.query(User).filter(User.id == e.user_id).first()
            username = u.username if u else "Unknown"
            print(f"  Expense ID={e.id}: paid_by={username}, place={e.place_name}, amount={e.amount}, desc={e.description}")
            
    finally:
        db.close()

if __name__ == "__main__":
    inspect()
