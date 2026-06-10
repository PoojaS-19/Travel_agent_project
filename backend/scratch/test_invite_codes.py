import requests
import sys
import sqlite3
import json
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"

def get_db_connection():
    db_url = "travel_planner.db"
    return sqlite3.connect(db_url)

def setup_users():
    print("--- Setting up test users for Invite Code verification ---")
    
    # Leader signup
    leader_signup = {
        "username": "code_leader",
        "email": "code_leader@example.com",
        "password": "Password123!"
    }
    requests.post(f"{BASE_URL}/auth/signup", json=leader_signup)
    
    # Buddy signup
    buddy_signup = {
        "username": "code_buddy",
        "email": "code_buddy@example.com",
        "password": "Password123!"
    }
    requests.post(f"{BASE_URL}/auth/signup", json=buddy_signup)

    # Force verify users in DB
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE users SET is_verified = true WHERE email IN ('code_leader@example.com', 'code_buddy@example.com')")
    
    # Get user IDs
    c.execute("SELECT id, email FROM users WHERE email IN ('code_leader@example.com', 'code_buddy@example.com')")
    users = c.fetchall()
    conn.commit()
    conn.close()
    
    leader_id = [u[0] for u in users if u[1] == "code_leader@example.com"][0]
    buddy_id = [u[0] for u in users if u[1] == "code_buddy@example.com"][0]
    return leader_id, buddy_id

def login_user(email, password):
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        print(f"Login failed for {email}:", res.json())
        sys.exit(1)
    return res.json()["access_token"]

def create_itinerary(leader_id):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO itineraries (user_id, start_city, destination, itinerary_text, daily_plans, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (leader_id, "Pune", "Pune", "Test Invite Code Itinerary", json.dumps([]), "English", "2026-06-10 00:00:00")
    )
    c.execute("SELECT id FROM itineraries WHERE user_id = ? ORDER BY id DESC LIMIT 1", (leader_id,))
    itinerary_id = c.fetchone()[0]
    conn.commit()
    conn.close()
    return itinerary_id

def main():
    try:
        # Pre-clean
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("DELETE FROM users WHERE email IN ('code_leader@example.com', 'code_buddy@example.com')")
        c.execute("DELETE FROM itineraries WHERE start_city = 'Pune'")
        conn.commit()
        conn.close()

        leader_id, buddy_id = setup_users()
        leader_token = login_user("code_leader@example.com", "Password123!")
        buddy_token = login_user("code_buddy@example.com", "Password123!")
        itinerary_id = create_itinerary(leader_id)

        print(f"Itinerary created: ID={itinerary_id}")

        # Ensure leader is mapped as OWNER collaborator
        # The collaboration service ensure_owner_membership creates the OWNER collaborator record when dashboard is loaded
        dashboard_res = requests.get(f"{BASE_URL}/api/trips/{itinerary_id}/collaboration/dashboard", headers={"Authorization": f"Bearer {leader_token}"})
        print("Dashboard loaded, owner membership ensured. My role:", dashboard_res.json().get("my_role"))

        # Test 1: Generate invite code
        print("--- Test 1: Generating Invite Code ---")
        gen_res = requests.post(
            f"{BASE_URL}/api/collaboration/invitations/generate-code",
            json={"trip_id": itinerary_id},
            headers={"Authorization": f"Bearer {leader_token}"}
        )
        print("Generate code response status:", gen_res.status_code)
        assert gen_res.status_code == 200
        gen_data = gen_res.json()
        invite_code = gen_data["invite_code"]
        print("Generated invite code:", invite_code)
        assert len(invite_code) == 6
        assert invite_code.isdigit()

        # Test 2: Invalidation of older code on regeneration
        print("--- Test 2: Regenerating and Invalidation of Previous Code ---")
        regen_res = requests.post(
            f"{BASE_URL}/api/collaboration/invitations/generate-code",
            json={"trip_id": itinerary_id},
            headers={"Authorization": f"Bearer {leader_token}"}
        )
        assert regen_res.status_code == 200
        new_invite_code = regen_res.json()["invite_code"]
        print("New generated invite code:", new_invite_code)
        assert new_invite_code != invite_code

        # Verify old code is deleted from DB
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT count(*) FROM trip_invite_codes WHERE invite_code = ?", (invite_code,))
        assert c.fetchone()[0] == 0
        print("Old invite code successfully deleted from database: PASSED")
        conn.close()

        # Test 3: Unauthorized user generation (buddy is not collaborator yet)
        print("--- Test 3: Unauthorized User Invite Code Generation ---")
        unauth_res = requests.post(
            f"{BASE_URL}/api/collaboration/invitations/generate-code",
            json={"trip_id": itinerary_id},
            headers={"Authorization": f"Bearer {buddy_token}"}
        )
        print("Unauthorized user generate code response status:", unauth_res.status_code)
        assert unauth_res.status_code == 403
        print("Access denied for non-collaborator user: PASSED")

        # Test 4: Accept valid code
        print("--- Test 4: Accept Valid Invite Code ---")
        accept_res = requests.post(
            f"{BASE_URL}/api/collaboration/invitations/accept-code",
            json={"invite_code": new_invite_code},
            headers={"Authorization": f"Bearer {buddy_token}"}
        )
        print("Accept code response status:", accept_res.status_code)
        assert accept_res.status_code == 200
        accept_data = accept_res.json()
        assert accept_data["success"] is True
        assert accept_data["trip_id"] == itinerary_id

        # Verify buddy is collaborator in DB
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT role FROM trip_collaborators WHERE trip_id = ? AND user_id = ?", (itinerary_id, buddy_id))
        row = c.fetchone()
        assert row is not None
        print("Buddy is now mapped as collaborator with role:", row[0])
        conn.close()

        # Test 5: Prevent duplicate collaborator joining (re-join)
        print("--- Test 5: Double Join Protection ---")
        rejoin_res = requests.post(
            f"{BASE_URL}/api/collaboration/invitations/accept-code",
            json={"invite_code": new_invite_code},
            headers={"Authorization": f"Bearer {buddy_token}"}
        )
        print("Re-join response status:", rejoin_res.status_code)
        assert rejoin_res.status_code == 409
        assert rejoin_res.json()["detail"] == "You are already a collaborator on this trip"
        print("Double join prevention successfully returned 409 Conflict: PASSED")

        # Test 6: Expired invite code rejection
        print("--- Test 6: Expired Code Rejection ---")
        # Generate new code for test
        test_code_res = requests.post(
            f"{BASE_URL}/api/collaboration/invitations/generate-code",
            json={"trip_id": itinerary_id},
            headers={"Authorization": f"Bearer {leader_token}"}
        )
        test_code = test_code_res.json()["invite_code"]
        
        # Manually alter expires_at in DB to past time
        conn = get_db_connection()
        c = conn.cursor()
        past_time = (datetime.utcnow() - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S")
        c.execute("UPDATE trip_invite_codes SET expires_at = ? WHERE invite_code = ?", (past_time, test_code))
        conn.commit()
        conn.close()

        # Create a new unregistered user to join
        third_user = {
            "username": "code_third",
            "email": "code_third@example.com",
            "password": "Password123!"
        }
        requests.post(f"{BASE_URL}/auth/signup", json=third_user)
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("UPDATE users SET is_verified = true WHERE email = 'code_third@example.com'")
        c.execute("SELECT id FROM users WHERE email = 'code_third@example.com'")
        third_id = c.fetchone()[0]
        conn.commit()
        conn.close()

        third_token = login_user("code_third@example.com", "Password123!")

        expired_res = requests.post(
            f"{BASE_URL}/api/collaboration/invitations/accept-code",
            json={"invite_code": test_code},
            headers={"Authorization": f"Bearer {third_token}"}
        )
        print("Expired code response status:", expired_res.status_code)
        assert expired_res.status_code == 410
        assert expired_res.json()["detail"] == "Invite code has expired"
        print("Expired code rejection returned 410 Gone: PASSED")

        # Cleanup
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("DELETE FROM users WHERE email IN ('code_leader@example.com', 'code_buddy@example.com', 'code_third@example.com')")
        c.execute("DELETE FROM itineraries WHERE start_city = 'Pune'")
        c.execute("DELETE FROM trip_collaborators WHERE trip_id = ?", (itinerary_id,))
        c.execute("DELETE FROM trip_invite_codes WHERE trip_id = ?", (itinerary_id,))
        conn.commit()
        conn.close()

        print("\n=== ALL TRIP INVITE CODE TESTS COMPLETED SUCCESSFULLY! ===")

    except Exception as e:
        print("\n=== TRIP INVITE CODE TEST RUN ENCOUNTERED AN ERROR:", str(e))
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
