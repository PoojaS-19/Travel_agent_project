import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import User
from app.services.auth_service import AuthService

def debug():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == "demo_leader@example.com").first()
        if user:
            print("User found!")
            print(f"  ID: {user.id}")
            print(f"  Username: {user.username}")
            print(f"  Email: {user.email}")
            print(f"  Is Verified: {user.is_verified}")
            print(f"  Password Hash: {user.password_hash}")
            
            # Verify the password manually using AuthService
            res = AuthService.verify_password("password123!", user.password_hash)
            print(f"  Password 'password123!' is verified: {res}")
            
            # Re-hash and save just in case
            if not res:
                print("Re-hashing password to 'password123!'...")
                user.password_hash = AuthService.hash_password("password123!")
                db.add(user)
                db.commit()
                print("Re-hashed password committed successfully.")
                
                # Check verification again
                new_verify = AuthService.verify_password("password123!", user.password_hash)
                print(f"  Verification check after re-hash: {new_verify}")
        else:
            print("User 'demo_leader@example.com' not found in database!")
    except Exception as ex:
        print("Error:", ex)
    finally:
        db.close()

if __name__ == "__main__":
    debug()
