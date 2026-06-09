import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.collaboration import TripExpense

def check():
    db = SessionLocal()
    try:
        count = db.query(TripExpense).filter(TripExpense.trip_id == 27).count()
        print(f"Number of expenses for Trip 27: {count}")
        expenses = db.query(TripExpense).filter(TripExpense.trip_id == 27).all()
        for e in expenses:
            print(f"  Expense: place={e.place_name}, amount={e.amount}, user={e.user_id}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
