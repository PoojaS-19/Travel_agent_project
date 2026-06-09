import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User

def update():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == 73).first()
        if user:
            print(f"Current email: {user.email}")
            user.email = "demo_leader@example.com"
            db.add(user)
            db.commit()
            print(f"Updated email to: {user.email}")
        else:
            print("User ID 73 not found!")
    except Exception as ex:
        db.rollback()
        print("Error:", ex)
    finally:
        db.close()

if __name__ == "__main__":
    update()
