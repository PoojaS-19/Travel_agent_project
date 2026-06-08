import requests
import sys
import sqlite3
import json
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

def clean_old():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DELETE FROM itineraries WHERE start_city = 'DemoCity' AND destination = 'DemoCity'")
    c.execute("DELETE FROM users WHERE email IN ('demo_leader@example.com', 'demo_buddy@example.com')")
    c.execute("DELETE FROM trip_collaborators WHERE user_id NOT IN (SELECT id FROM users)")
    conn.commit()
    conn.close()

def setup_users():
    clean_old()
    print("Creating demo users...")
    leader = {"username": "demo_leader", "email": "demo_leader@example.com", "password": "Password123!"}
    requests.post(f"{BASE_URL}/auth/signup", json=leader)
    
    buddy = {"username": "demo_buddy", "email": "demo_buddy@example.com", "password": "Password123!"}
    requests.post(f"{BASE_URL}/auth/signup", json=buddy)

    conn = get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE users SET is_verified = true WHERE email IN ('demo_leader@example.com', 'demo_buddy@example.com')")
    c.execute("SELECT id, email FROM users WHERE email IN ('demo_leader@example.com', 'demo_buddy@example.com')")
    users = c.fetchall()
    conn.commit()
    conn.close()
    
    leader_id = [u[0] for u in users if u[1] == "demo_leader@example.com"][0]
    buddy_id = [u[0] for u in users if u[1] == "demo_buddy@example.com"][0]
    return leader_id, buddy_id

def login(email, password):
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]

def create_itinerary(leader_id):
    print("Setting up demo itinerary...")
    daily_plans_mock = [
        {
            "day": 1,
            "date": "2026-06-15",
            "activities": [
                {
                    "place_name": "Eiffel Tower",
                    "time": "09:00 AM",
                    "category": "Attraction",
                    "status": "completed",
                    "lat": 48.8584, "lon": 2.2945,
                    "description": "Visit the iconic tower."
                },
                {
                    "place_name": "Louvre Museum",
                    "time": "01:00 PM",
                    "category": "Attraction",
                    "status": "current",
                    "lat": 48.8606, "lon": 2.3376,
                    "description": "Explore art and history."
                },
                {
                    "place_name": "Seine River Cruise",
                    "time": "05:00 PM",
                    "category": "Relax",
                    "status": "upcoming",
                    "lat": 48.8600, "lon": 2.3200,
                    "description": "Evening boat ride."
                }
            ]
        },
        {
            "day": 2,
            "date": "2026-06-16",
            "activities": [
                {
                    "place_name": "Notre-Dame",
                    "time": "10:00 AM",
                    "category": "Attraction",
                    "status": "upcoming",
                    "lat": 48.8529, "lon": 2.3499,
                    "description": "Historic cathedral."
                },
                {
                    "place_name": "Montmartre",
                    "time": "03:00 PM",
                    "category": "Walk",
                    "status": "upcoming",
                    "lat": 48.8867, "lon": 2.3431,
                    "description": "Artistic neighborhood walk."
                }
            ]
        }
    ]
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute(
        "INSERT INTO itineraries (user_id, start_city, destination, itinerary_text, daily_plans, language, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (leader_id, "DemoCity", "DemoCity", "A lovely trip to Paris", json.dumps(daily_plans_mock), "English", "2026-06-01 00:00:00")
    )
    c.execute("SELECT id FROM itineraries WHERE user_id = ? ORDER BY id DESC LIMIT 1", (leader_id,))
    itinerary_id = c.fetchone()[0]
    conn.commit()
    conn.close()
    return itinerary_id

def setup_expenses_and_collab(leader_token, buddy_token, itinerary_id):
    print("Setting up collaboration and expenses...")
    
    # 1. Invite and Accept
    headers = {"Authorization": f"Bearer {leader_token}"}
    requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/collaboration/invitations", json={"emails": ["demo_buddy@example.com"], "role": "follower"}, headers=headers)
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT otp_code FROM trip_invitations WHERE trip_id = ? AND email = ?", (itinerary_id, "demo_buddy@example.com"))
    otp_code = c.fetchone()[0]
    conn.close()
    
    buddy_headers = {"Authorization": f"Bearer {buddy_token}"}
    requests.post(f"{BASE_URL}/api/collaboration/invitations/accept-otp", json={"otp_code": otp_code}, headers=buddy_headers)
    
    # 2. Add Expenses
    requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/expenses", json={"place_name": "Eiffel Tower", "amount": 150.0, "description": "Tickets"}, headers=headers)
    requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/expenses", json={"place_name": "Lunch", "amount": 350.0, "description": "Lunch at Cafe"}, headers=buddy_headers)
    requests.post(f"{BASE_URL}/api/trips/{itinerary_id}/expenses", json={"place_name": "Louvre Museum", "amount": 200.0, "description": "Museum pass"}, headers=headers)

if __name__ == "__main__":
    leader_id, buddy_id = setup_users()
    leader_token = login("demo_leader@example.com", "Password123!")
    buddy_token = login("demo_buddy@example.com", "Password123!")
    
    itinerary_id = create_itinerary(leader_id)
    setup_expenses_and_collab(leader_token, buddy_token, itinerary_id)
    
    print("\n--- FAKE DATA CREATED SUCCESSFULLY ---")
    print(f"Trip ID: {itinerary_id}")
    print("Login with:")
    print("Email: demo_leader@example.com")
    print("Password: Password123!")
    print("\nOnce logged in, go to the trip dashboard to see the active itinerary progression and expense splits!")
