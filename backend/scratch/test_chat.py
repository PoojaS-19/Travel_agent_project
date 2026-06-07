import requests
import sys
from sqlalchemy import text
from app.database import SessionLocal

BASE_URL = "http://127.0.0.1:8000"

def execute_sql(query, params=None):
    db = SessionLocal()
    try:
        db.execute(text(query), params or {})
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"SQL Error: {e}")
    finally:
        db.close()

def force_verify_user(email):
    execute_sql("UPDATE users SET is_verified = true WHERE email = :email", {"email": email})

def get_user_id(email):
    db = SessionLocal()
    try:
        from app.models import User
        user = db.query(User).filter_by(email=email).first()
        return user.id if user else None
    finally:
        db.close()

def main():
    print("=== STARTING INTEGRATION TESTS FOR GROUP CHAT ===")

    # 1. Sign up Leader & Buddy
    leader_signup = {
        "username": "chat_leader_test",
        "email": "chat_leader_test@example.com",
        "password": "Password123!"
    }
    buddy_signup = {
        "username": "chat_buddy_test",
        "email": "chat_buddy_test@example.com",
        "password": "Password123!"
    }

    # Delete existing test users if they exist to avoid conflict
    execute_sql("DELETE FROM users WHERE email IN ('chat_leader_test@example.com', 'chat_buddy_test@example.com')")

    res_l = requests.post(f"{BASE_URL}/auth/signup", json=leader_signup)
    res_b = requests.post(f"{BASE_URL}/auth/signup", json=buddy_signup)
    print(f"Leader Signup Status: {res_l.status_code}")
    print(f"Buddy Signup Status: {res_b.status_code}")

    if res_l.status_code not in (200, 201) or res_b.status_code not in (200, 201):
        print("Signups failed! Make sure backend is running.")
        sys.exit(1)

    force_verify_user("chat_leader_test@example.com")
    force_verify_user("chat_buddy_test@example.com")

    # 2. Login to get tokens
    tok_l = requests.post(f"{BASE_URL}/auth/login", json={"email": "chat_leader_test@example.com", "password": "Password123!"}).json()["access_token"]
    tok_b = requests.post(f"{BASE_URL}/auth/login", json={"email": "chat_buddy_test@example.com", "password": "Password123!"}).json()["access_token"]
    print("Logins successful.")

    leader_id = get_user_id("chat_leader_test@example.com")
    buddy_id = get_user_id("chat_buddy_test@example.com")

    # 3. Create Itinerary (Trip)
    db = SessionLocal()
    from app.models import Itinerary
    new_trip = Itinerary(
        user_id=leader_id,
        start_city="Delhi",
        destination="Agra",
        language="English"
    )
    db.add(new_trip)
    db.commit()
    trip_id = new_trip.id
    db.close()
    print(f"Created trip ID: {trip_id}")

    # Ensure leader role is OWNER in trip_collaborators
    # Wait, CollaborationService ensures this during requirements checks, but we can verify it
    headers_l = {"Authorization": f"Bearer {tok_l}"}
    headers_b = {"Authorization": f"Bearer {tok_b}"}

    # Invite Buddy as editor
    invite_payload = {
        "emails": ["chat_buddy_test@example.com"],
        "role": "editor"
    }
    requests.post(f"{BASE_URL}/api/trips/{trip_id}/collaboration/invitations", json=invite_payload, headers=headers_l)

    # Accept Invite directly via DB for simplicity in test
    execute_sql(
        "INSERT INTO trip_collaborators (trip_id, user_id, role, joined_at, updated_at) VALUES (:trip_id, :user_id, 'editor', now(), now()) ON CONFLICT DO NOTHING",
        {"trip_id": trip_id, "user_id": buddy_id}
    )
    print("Buddy linked to trip.")

    # 4. Test Chat History API - Initial
    history_res = requests.get(f"{BASE_URL}/api/trips/{trip_id}/chat", headers=headers_l)
    print(f"Initial Chat History Status: {history_res.status_code}")
    assert history_res.status_code == 200
    assert len(history_res.json()) == 0

    # 5. Test Posting Text Message
    msg_payload = {
        "message": "Hello buddies!",
        "message_type": "text",
        "message_uuid": "test-uuid-1"
    }
    post_res = requests.post(f"{BASE_URL}/api/trips/{trip_id}/chat", json=msg_payload, headers=headers_l)
    print(f"Leader Send Message Status: {post_res.status_code}")
    assert post_res.status_code == 200
    assert post_res.json()["message"] == "Hello buddies!"
    assert post_res.json()["message_type"] == "text"

    # 6. Test Duplicate Prevention (message_uuid check)
    dup_res = requests.post(f"{BASE_URL}/api/trips/{trip_id}/chat", json=msg_payload, headers=headers_l)
    print(f"Duplicate Send Message Status: {dup_res.status_code}")
    assert dup_res.status_code == 200
    # The returned ID must be the same as the first one, meaning it didn't create a new message
    assert dup_res.json()["id"] == post_res.json()["id"]

    # 7. Test Message Validation (max length / min length)
    empty_payload = {
        "message": "",
        "message_type": "text"
    }
    empty_res = requests.post(f"{BASE_URL}/api/trips/{trip_id}/chat", json=empty_payload, headers=headers_l)
    print(f"Empty Message Status: {empty_res.status_code} (Expect 422)")
    assert empty_res.status_code == 422

    too_long_payload = {
        "message": "a" * 1001,
        "message_type": "text"
    }
    too_long_res = requests.post(f"{BASE_URL}/api/trips/{trip_id}/chat", json=too_long_payload, headers=headers_l)
    print(f"Too Long Message Status: {too_long_res.status_code} (Expect 422)")
    assert too_long_res.status_code == 422

    # 8. Test Announcement Permissions
    ann_payload = {
        "message": "Leader announcement: Let's gather at 9 AM!",
        "message_type": "announcement",
        "message_uuid": "test-uuid-2"
    }
    # Send by leader (should succeed)
    ann_res_l = requests.post(f"{BASE_URL}/api/trips/{trip_id}/chat", json=ann_payload, headers=headers_l)
    print(f"Leader Send Announcement Status: {ann_res_l.status_code}")
    assert ann_res_l.status_code == 200

    # Send by buddy (should fail with 403 Forbidden)
    ann_res_b = requests.post(f"{BASE_URL}/api/trips/{trip_id}/chat", json=ann_payload, headers=headers_b)
    print(f"Buddy Send Announcement Status: {ann_res_b.status_code} (Expect 403)")
    assert ann_res_b.status_code == 403

    # 9. Test Access Control: Unaffiliated user tries to read/write chat
    unaffiliated_signup = {
        "username": "chat_unaffiliated_test",
        "email": "chat_unaffiliated_test@example.com",
        "password": "Password123!"
    }
    execute_sql("DELETE FROM users WHERE email = 'chat_unaffiliated_test@example.com'")
    requests.post(f"{BASE_URL}/auth/signup", json=unaffiliated_signup)
    force_verify_user("chat_unaffiliated_test@example.com")
    tok_u = requests.post(f"{BASE_URL}/auth/login", json={"email": "chat_unaffiliated_test@example.com", "password": "Password123!"}).json()["access_token"]
    headers_u = {"Authorization": f"Bearer {tok_u}"}

    get_u_res = requests.get(f"{BASE_URL}/api/trips/{trip_id}/chat", headers=headers_u)
    print(f"Unaffiliated Get Chat Status: {get_u_res.status_code} (Expect 403)")
    assert get_u_res.status_code == 403

    post_u_res = requests.post(f"{BASE_URL}/api/trips/{trip_id}/chat", json={"message": "Hack attempt"}, headers=headers_u)
    print(f"Unaffiliated Post Chat Status: {post_u_res.status_code} (Expect 403)")
    assert post_u_res.status_code == 403

    # 10. Check Chat History order and length
    history_after = requests.get(f"{BASE_URL}/api/trips/{trip_id}/chat", headers=headers_l).json()
    print(f"Chat messages count in DB: {len(history_after)}")
    assert len(history_after) == 2
    # Ensure ordered chronologically
    assert history_after[0]["message_uuid"] == "test-uuid-1"
    assert history_after[1]["message_uuid"] == "test-uuid-2"

    # Cleanup test data
    execute_sql("DELETE FROM trip_chat_messages WHERE trip_id = :trip_id", {"trip_id": trip_id})
    execute_sql("DELETE FROM trip_collaborators WHERE trip_id = :trip_id", {"trip_id": trip_id})
    execute_sql("DELETE FROM itineraries WHERE id = :trip_id", {"trip_id": trip_id})
    execute_sql("DELETE FROM users WHERE email IN ('chat_leader_test@example.com', 'chat_buddy_test@example.com', 'chat_unaffiliated_test@example.com')")
    print("\n=== ALL CHAT INTEGRATION TESTS COMPLETED SUCCESSFULLY! ===")

if __name__ == "__main__":
    main()
