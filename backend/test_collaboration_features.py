import requests
import sys
import sqlite3
import json

BASE_URL = "http://127.0.0.1:8000"

def get_db_connection():
    return sqlite3.connect("travel_planner.db")

def setup_users():
    print("--- 1. Creating and verifying test users ---")
    
    # Leader signup
    leader_signup = {
        "username": "test_leader",
        "email": "test_leader@example.com",
        "password": "Password123!"
    }
    res = requests.post(f"{BASE_URL}/auth/signup", json=leader_signup)
    print("Leader signup status:", res.status_code)
    
    # Buddy signup
    buddy_signup = {
        "username": "test_buddy",
        "email": "test_buddy@example.com",
        "password": "Password123!"
    }
    res2 = requests.post(f"{BASE_URL}/auth/signup", json=buddy_signup)
    print("Buddy signup status:", res2.status_code)

    # Force verify users in DB
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE users SET is_verified = 1 WHERE email IN ('test_leader@example.com', 'test_buddy@example.com')")
    
    # Get user IDs
    c.execute("SELECT id, email FROM users WHERE email IN ('test_leader@example.com', 'test_buddy@example.com')")
    users = c.fetchall()
    print("Verified users in database:", users)
    conn.commit()
    conn.close()
    
    leader_id = [u[0] for u in users if u[1] == "test_leader@example.com"][0]
    buddy_id = [u[0] for u in users if u[1] == "test_buddy@example.com"][0]
    return leader_id, buddy_id

def login_user(email, password):
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        print(f"Login failed for {email}:", res.json())
        sys.exit(1)
    data = res.json()
    return data["access_token"]

def create_itinerary(leader_id):
    print("\n--- 2. Setting up trip itinerary with coordinates ---")
    daily_plans_mock = [
        {
            "day": 1,
            "activities": [
                {
                    "place_name": "Gateway of India",
                    "time": "09:00 AM",
                    "category": "Attraction",
                    "lat": 18.9220,
                    "lon": 72.8347,
                    "description": "Historical monument in Mumbai.",
                    "cost": "₹0"
                },
                {
                    "place_name": "Taj Mahal Palace Hotel",
                    "time": "11:00 AM",
                    "category": "Relax",
                    "lat": 18.9218,
                    "lon": 72.8333,
                    "description": "Historic luxury hotel in Mumbai.",
                    "cost": "₹500"
                }
            ]
        }
    ]
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO itineraries (user_id, start_city, destination, itinerary_text, daily_plans, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (leader_id, "Mumbai", "Mumbai", "Test Itinerary Summary", json.dumps(daily_plans_mock), "English", "2026-05-30 00:00:00")
    )
    itinerary_id = c.lastrowid
    conn.commit()
    conn.close()
    print(f"Created itinerary ID {itinerary_id} for leader user ID {leader_id}")
    return itinerary_id

def test_otp_invitation(leader_token, itinerary_id):
    print("\n--- 3. Inviting buddy and accepting via OTP code ---")
    
    headers = {"Authorization": f"Bearer {leader_token}"}
    payload = {
        "emails": ["test_buddy@example.com"],
        "role": "follower"
    }
    
    res = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/collaboration/invitations", json=payload, headers=headers)
    print("Invitation endpoint response status:", res.status_code)
    if res.status_code != 200:
        print("Invitation failed:", res.json())
        sys.exit(1)
        
    # Read OTP code directly from DB
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT otp_code FROM trip_invitations WHERE trip_id = ? AND email = ?", (itinerary_id, "test_buddy@example.com"))
    row = c.fetchone()
    conn.close()
    
    if not row or not row[0]:
        print("Error: Could not retrieve OTP code from database.")
        sys.exit(1)
        
    otp_code = row[0]
    print(f"Retrieved 6-digit OTP code from DB: {otp_code}")
    return otp_code

def accept_otp(buddy_token, otp_code):
    headers = {"Authorization": f"Bearer {buddy_token}"}
    payload = {"otp_code": otp_code}
    
    res = requests.post(f"{BASE_URL}/api/collaboration/invitations/accept-otp", json=payload, headers=headers)
    print("Accept OTP response status:", res.status_code)
    print("Accept OTP response body:", res.json())
    if res.status_code != 200:
        print("Verification failed")
        sys.exit(1)
    print("Verification OTP Accept Invite: PASSED")

def test_live_location_alarms(leader_token, itinerary_id):
    print("\n--- 4. Testing leader live location tracking & proximity triggers ---")
    headers = {"Authorization": f"Bearer {leader_token}"}
    
    # 1. Teleport to Gateway of India
    print("Teleporting leader to Gateway of India (18.9220, 72.8347)...")
    res1 = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/leader-location", json={"lat": 18.9220, "lon": 72.8347}, headers=headers)
    print("Response status:", res1.status_code)
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT status, place_name FROM trip_visits WHERE trip_id = ?", (itinerary_id,))
    visits = c.fetchall()
    print("Current visits in DB:", visits)
    
    # 2. Simulate leaving Gateway of India (Move away by ~1.5km)
    print("Simulating leader leaving Gateway of India (moving to 18.9320, 72.8447)...")
    res2 = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/leader-location", json={"lat": 18.9320, "lon": 72.8447}, headers=headers)
    print("Response status:", res2.status_code)
    
    c.execute("SELECT status, place_name, prompt_sent FROM trip_visits WHERE trip_id = ?", (itinerary_id,))
    visits_after = c.fetchall()
    print("Visits after leaving in DB:", visits_after)
    conn.close()
    
    if visits_after and visits_after[0][0] == "left" and visits_after[0][2] == 1:
        print("Proximity alarm check: PASSED (leader left place and prompt_sent is true)")
    else:
        print("Proximity alarm check failed!")
        sys.exit(1)

def test_expenses_and_splitting(leader_token, buddy_token, itinerary_id):
    print("\n--- 5. Logging expenses and verifying split settlement ---")
    
    leader_headers = {"Authorization": f"Bearer {leader_token}"}
    buddy_headers = {"Authorization": f"Bearer {buddy_token}"}
    
    # Leader logs Rs. 100 spent
    res1 = requests.post(
        f"{BASE_URL}/api/trips/{itinerary_id}/expenses",
        json={"place_name": "Gateway of India", "amount": 100.0, "description": "Snacks"},
        headers=leader_headers
    )
    print("Leader log expense status:", res1.status_code)
    
    # Buddy logs Rs. 300 spent
    res2 = requests.post(
        f"{BASE_URL}/api/trips/{itinerary_id}/expenses",
        json={"place_name": "Gateway of India", "amount": 300.0, "description": "Camera guide fee"},
        headers=buddy_headers
    )
    print("Buddy log expense status:", res2.status_code)
    
    # Get split calculations
    res3 = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/expenses", headers=leader_headers)
    print("Expense splits response status:", res3.status_code)
    data = res3.json()
    print("Expense splits response body:", data)
    
    assert float(data["total_spent"]) == 400.0
    assert float(data["share_per_person"]) == 200.0
    assert len(data["splits"]) == 1
    assert data["splits"][0]["from_username"] == "test_leader"
    assert data["splits"][0]["to_username"] == "test_buddy"
    assert float(data["splits"][0]["amount"]) == 100.0
    print("Expense splits calculations: PASSED")

def clean_database(itinerary_id, leader_id, buddy_id):
    print("\n--- Cleaning up test records ---")
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM itineraries WHERE id = ?", (itinerary_id,))
    c.execute("DELETE FROM users WHERE id IN (?, ?)", (leader_id, buddy_id))
    c.execute("DELETE FROM trip_collaborators WHERE trip_id = ?", (itinerary_id,))
    c.execute("DELETE FROM trip_invitations WHERE trip_id = ?", (itinerary_id,))
    c.execute("DELETE FROM trip_visits WHERE trip_id = ?", (itinerary_id,))
    c.execute("DELETE FROM leader_locations WHERE trip_id = ?", (itinerary_id,))
    c.execute("DELETE FROM trip_expenses WHERE trip_id = ?", (itinerary_id,))
    conn.commit()
    conn.close()
    print("Cleanup completed.")

def main():
    try:
        # Pre-clean database in case a previous run crashed
        conn = get_db_connection()
        c = conn.cursor()
        # Delete only itineraries created by test runs
        c.execute("DELETE FROM itineraries WHERE start_city = 'Mumbai' AND destination = 'Mumbai'")
        c.execute("DELETE FROM trip_collaborators WHERE user_id IN (SELECT id FROM users WHERE email IN ('test_leader@example.com', 'test_buddy@example.com'))")
        c.execute("DELETE FROM users WHERE email IN ('test_leader@example.com', 'test_buddy@example.com')")
        c.execute("DELETE FROM trip_invitations WHERE email = 'test_buddy@example.com'")
        c.execute("DELETE FROM trip_collaborators WHERE trip_id NOT IN (SELECT id FROM itineraries) OR user_id NOT IN (SELECT id FROM users)")
        c.execute("DELETE FROM trip_invitations WHERE trip_id NOT IN (SELECT id FROM itineraries)")
        c.execute("DELETE FROM trip_visits")
        c.execute("DELETE FROM leader_locations")
        c.execute("DELETE FROM trip_expenses")
        conn.commit()
        conn.close()

        leader_id, buddy_id = setup_users()
        leader_token = login_user("test_leader@example.com", "Password123!")
        buddy_token = login_user("test_buddy@example.com", "Password123!")
        itinerary_id = create_itinerary(leader_id)
        
        otp_code = test_otp_invitation(leader_token, itinerary_id)
        accept_otp(buddy_token, otp_code)
        
        test_live_location_alarms(leader_token, itinerary_id)
        test_expenses_and_splitting(leader_token, buddy_token, itinerary_id)
        
        clean_database(itinerary_id, leader_id, buddy_id)
        print("\n=== ALL TESTS COMPLETED SUCCESSFULLY! ===")
    except Exception as e:
        print("\n=== TEST RUN ENCOUNTERED AN ERROR:", str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
