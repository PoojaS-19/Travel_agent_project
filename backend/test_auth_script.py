import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("--- 1. Testing Unverified User Signup Re-registration ---")
    
    # Payload for signup
    signup_data = {
        "username": "testuser_temp",
        "email": "testuser_temp@example.com",
        "password": "Password123!"
    }
    
    # First signup
    res1 = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
    print("First signup response status:", res1.status_code)
    if res1.status_code != 201:
        print("First signup failed:", res1.json())
        sys.exit(1)
        
    # Second signup with same email/username (should delete unverified and succeed)
    res2 = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
    print("Second signup (unverified email) response status:", res2.status_code)
    if res2.status_code != 201:
        print("Second signup failed:", res2.json())
        sys.exit(1)
    
    print("Unverified user re-registration test: PASSED")
    
    print("\n--- 2. Testing Verified User Registration Block ---")
    # Fetch verification code from memory or mock it since we are in memory-based verification code.
    # Wait, we don't know the verification code unless we read it or it was printed in stdout,
    # but wait, can we find it in the memory dict?
    # In auth_service.py: email_verification_codes = {}
    # Let's query the database to verify the user directly or use the mock verification code if possible?
    # Wait, the verification code is printed in the logs or in backend process memory.
    # Let's write a quick script that verifies the user directly in the database!
    import sqlite3
    conn = sqlite3.connect("travel_planner.db")
    c = conn.cursor()
    # Mark user as verified directly in database
    c.execute("UPDATE users SET is_verified = 1 WHERE email = 'testuser_temp@example.com'")
    conn.commit()
    conn.close()
    print("Marked testuser_temp@example.com as verified in SQLite database.")
    
    # Try signing up again (should fail now that they are verified)
    res3 = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
    print("Signup after verification response status:", res3.status_code)
    if res3.status_code == 400 and "already registered" in res3.json().get("detail", "").lower():
        print("Verified user registration block test: PASSED")
    else:
        print("Verified user registration block test failed:", res3.status_code, res3.json())
        sys.exit(1)

    print("\n--- 3. Testing Forgot Password OTP Email Flow ---")
    forgot_data = {
        "email": "testuser_temp@example.com"
    }
    res4 = requests.post(f"{BASE_URL}/auth/forgot-password", json=forgot_data)
    print("Forgot password response status:", res4.status_code)
    print("Forgot password response body:", res4.json())
    if res4.status_code == 200:
        print("Forgot password test: PASSED")
    else:
        print("Forgot password test failed:", res4.json())
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
