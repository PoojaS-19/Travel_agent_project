import requests
import sys
import sqlite3
import json
import io

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = "http://127.0.0.1:8000"

class DBConnectionWrapper:
    def __init__(self):
        db_url = os.getenv("DATABASE_URL", "sqlite:///travel_planner.db")
        self.is_postgres = db_url.startswith("postgresql")
        if self.is_postgres:
            import psycopg2
            self.conn = psycopg2.connect(db_url)
        else:
            self.conn = sqlite3.connect("travel_planner.db")

    def cursor(self):
        return DBCursorWrapper(self.conn.cursor(), self.is_postgres)

    def commit(self):
        self.conn.commit()

    def close(self):
        self.conn.close()

class DBCursorWrapper:
    def __init__(self, cursor, is_postgres):
        self.cursor = cursor
        self.is_postgres = is_postgres

    def execute(self, sql, params=None):
        if self.is_postgres:
            sql = sql.replace("?", "%s")
        if params is None:
            self.cursor.execute(sql)
        else:
            self.cursor.execute(sql, params)

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def close(self):
        self.cursor.close()

def get_db_connection():
    return DBConnectionWrapper()

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
    c.execute("UPDATE users SET is_verified = true WHERE email IN ('test_leader@example.com', 'test_buddy@example.com')")
    
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
    # Database-agnostic lastrowid query
    c.execute("SELECT id FROM itineraries WHERE user_id = ? ORDER BY id DESC LIMIT 1", (leader_id,))
    itinerary_id = c.fetchone()[0]
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

def test_itinerary_progression(leader_token, buddy_token, itinerary_id):
    print("\n--- 6. Testing itinerary progression mechanics, duplicate protection, and end-of-trip logs ---")
    headers_leader = {"Authorization": f"Bearer {leader_token}"}
    headers_buddy = {"Authorization": f"Bearer {buddy_token}"}
    
    # Check initial statuses after normalization
    res = requests.get(f"{BASE_URL}/itineraries/{itinerary_id}", headers=headers_leader)
    assert res.status_code == 200
    plans = res.json()["daily_plans"]
    act1 = plans[0]["activities"][0]
    act2 = plans[0]["activities"][1]
    
    # After normalization, first activity should be 'current', second should be 'upcoming'
    assert act1["status"] == "current"
    assert act2["status"] == "upcoming"
    print("Initial status checks (current / upcoming): PASSED")
    
    # 1. Test backend protection against wrong place progression
    payload_wrong = {"place_name": "Taj Mahal Palace Hotel"}  # not current
    res_wrong = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/itinerary/complete", json=payload_wrong, headers=headers_leader)
    assert res_wrong.status_code == 400
    print("Protection check against incorrect place name progression: PASSED")
    
    # 2. Complete current place ("Gateway of India")
    payload_correct = {"place_name": "Gateway of India"}
    res_complete = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/itinerary/complete", json=payload_correct, headers=headers_leader)
    assert res_complete.status_code == 200
    print("Complete current place ('Gateway of India') progression: PASSED")
    
    # 3. Test protection against duplicate progression (sending Gateway of India again)
    res_dup = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/itinerary/complete", json=payload_correct, headers=headers_leader)
    assert res_dup.status_code == 400
    print("Protection check against duplicate progression requests: PASSED")
    
    # Verify progression status
    res = requests.get(f"{BASE_URL}/itineraries/{itinerary_id}", headers=headers_leader)
    plans = res.json()["daily_plans"]
    act1 = plans[0]["activities"][0]
    act2 = plans[0]["activities"][1]
    assert act1["status"] == "completed"
    assert act2["status"] == "current"
    
    # 4. Verify system chat message details (including leader crown emoji & username)
    res_chat = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/chat", headers=headers_leader)
    chat_history = res_chat.json()
    system_msgs = [m for m in chat_history if m["message_type"] == "system"]
    assert len(system_msgs) > 0
    last_msg = system_msgs[-1]["message"]
    print("System chat message logged:", last_msg)
    assert "👑 test_leader completed Gateway of India. Moving to Taj Mahal Palace Hotel." in last_msg
    print("System chat message format and content validation: PASSED")
    
    # 5. Skip the next destination to test skip mechanics and end-of-trip handling
    payload_skip = {"place_name": "Taj Mahal Palace Hotel"}
    res_skip = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/itinerary/skip", json=payload_skip, headers=headers_leader)
    assert res_skip.status_code == 200
    print("Skip current place ('Taj Mahal Palace Hotel') progression: PASSED")
    
    # Verify end of trip state: no current activity, all completed/skipped
    res = requests.get(f"{BASE_URL}/itineraries/{itinerary_id}", headers=headers_leader)
    plans = res.json()["daily_plans"]
    act2 = plans[0]["activities"][1]
    assert act2["status"] == "skipped"
    
    all_statuses = [act["status"] for day in plans for act in day["activities"]]
    assert "current" not in all_statuses
    print("End-of-trip status verify (no next/current destination left): PASSED")
    
    # Verify end-of-trip system chat message
    res_chat = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/chat", headers=headers_leader)
    chat_history = res_chat.json()
    system_msgs = [m for m in chat_history if m["message_type"] == "system"]
    last_msg = system_msgs[-1]["message"]
    print("End-of-trip system message logged:", last_msg)
    assert "👑 test_leader skipped Taj Mahal Palace Hotel. Trip completed!" in last_msg
    print("End-of-trip system message validation: PASSED")

def test_phase3_arrival_hysteresis_and_metadata(leader_token, buddy_token, itinerary_id):
    print("\n--- 7. Testing Phase 3 GPS Hysteresis and Visit Metadata ---")
    leader_headers = {"Authorization": f"Bearer {leader_token}"}
    buddy_headers = {"Authorization": f"Bearer {buddy_token}"}
    
    # Verify current_visit exists in response
    res = requests.get(f"{BASE_URL}/itineraries/{itinerary_id}", headers=leader_headers)
    assert res.status_code == 200
    assert "current_visit" in res.json()
    
    # Get initial chat messages count
    res_chat = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/chat", headers=leader_headers)
    initial_chat_len = len(res_chat.json())
    
    # 1. Teleport leader to Gateway of India (within 150m boundary)
    # 18.9220, 72.8338 is approx 100m away
    print("Teleporting leader to Gateway of India (within 150m boundary)...")
    res = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/leader-location", json={"lat": 18.9220, "lon": 72.8338}, headers=leader_headers)
    assert res.status_code == 200
    
    # Verify leader arrived message is logged in chat history
    res_chat = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/chat", headers=leader_headers)
    chat_msgs = res_chat.json()[initial_chat_len:]
    system_msgs = [m["message"] for m in chat_msgs if m["message_type"] == "system"]
    print("Logged system messages:", system_msgs)
    assert any("👑 test_leader arrived at Gateway of India." in m for m in system_msgs)
    
    # Verify current_visit status and arrived_at are populated
    res_itinerary = requests.get(f"{BASE_URL}/itineraries/{itinerary_id}", headers=leader_headers)
    visit = res_itinerary.json().get("current_visit")
    assert visit is not None
    assert visit["place_name"] == "Gateway of India"
    assert visit["status"] == "arrived"
    assert visit["arrived_at"] is not None
    
    # 2. Test leader drift (between 150m and 250m, e.g. 200m)
    # 18.9220, 72.8329 is approx 200m away
    print("Leader drifts to ~200m away (hysteresis region)...")
    initial_chat_len = len(res_chat.json())
    res = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/leader-location", json={"lat": 18.9220, "lon": 72.8329}, headers=leader_headers)
    assert res.status_code == 200
    
    # Verify no new arrival/departure system messages are logged
    res_chat = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/chat", headers=leader_headers)
    chat_msgs = res_chat.json()[initial_chat_len:]
    system_msgs = [m["message"] for m in chat_msgs if m["message_type"] == "system"]
    assert len(system_msgs) == 0
    print("Leader drift inside hysteresis zone: PASSED (no duplicate event triggered)")
    
    # 3. Test buddy live location tracking and hysteresis
    # Buddy starts outside (400m away, 18.9220, 72.8311)
    print("Buddy sharing location outside (400m)...")
    res = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/locations", json={"latitude": 18.9220, "longitude": 72.8311, "is_sharing": True}, headers=buddy_headers)
    assert res.status_code == 200
    
    initial_chat_len = len(res_chat.json())
    # Buddy moves within 150m (100m away, 18.9220, 72.8338)
    print("Buddy moves inside 150m...")
    res = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/locations", json={"latitude": 18.9220, "longitude": 72.8338, "is_sharing": True}, headers=buddy_headers)
    assert res.status_code == 200
    
    res_chat = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/chat", headers=leader_headers)
    chat_msgs = res_chat.json()[initial_chat_len:]
    system_msgs = [m["message"] for m in chat_msgs if m["message_type"] == "system"]
    print("Logged system messages for buddy:", system_msgs)
    assert any("test_buddy arrived at Gateway of India." in m for m in system_msgs)
    
    # Buddy drifts to 200m (between 150m and 250m)
    print("Buddy drifts to ~200m away (hysteresis region)...")
    initial_chat_len = len(res_chat.json())
    res = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/locations", json={"latitude": 18.9220, "longitude": 72.8329, "is_sharing": True}, headers=buddy_headers)
    assert res.status_code == 200
    
    res_chat = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/chat", headers=leader_headers)
    chat_msgs = res_chat.json()[initial_chat_len:]
    system_msgs = [m["message"] for m in chat_msgs if m["message_type"] == "system"]
    assert len(system_msgs) == 0
    print("Buddy drift inside hysteresis zone: PASSED")
    
    # Buddy leaves beyond 250m (300m away, 18.9220, 72.8320)
    print("Buddy leaves beyond 250m...")
    res = requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/locations", json={"latitude": 18.9220, "longitude": 72.8320, "is_sharing": True}, headers=buddy_headers)
    assert res.status_code == 200
    
    res_chat = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/chat", headers=leader_headers)
    chat_msgs = res_chat.json()[initial_chat_len:]
    system_msgs = [m["message"] for m in chat_msgs if m["message_type"] == "system"]
    print("Logged system messages for buddy leaving:", system_msgs)
    assert any("test_buddy left Gateway of India." in m for m in system_msgs)
    print("Buddy left trigger: PASSED")

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
        test_phase3_arrival_hysteresis_and_metadata(leader_token, buddy_token, itinerary_id)
        test_itinerary_progression(leader_token, buddy_token, itinerary_id)
        
        clean_database(itinerary_id, leader_id, buddy_id)
        print("\n=== ALL TESTS COMPLETED SUCCESSFULLY! ===")
    except Exception as e:
        print("\n=== TEST RUN ENCOUNTERED AN ERROR:", str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()
