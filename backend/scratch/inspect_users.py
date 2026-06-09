import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User

def inspect():
    db = SessionLocal()
    try:
        for uid in [73, 74]:
            u = db.query(User).filter(User.id == uid).first()
            if u:
                print(f"User ID={uid}: username={u.username}, email={u.email}, is_verified={u.is_verified}")
            else:
                print(f"User ID={uid} not found!")
    finally:
        db.close()

if __name__ == "__main__":
    inspect()
