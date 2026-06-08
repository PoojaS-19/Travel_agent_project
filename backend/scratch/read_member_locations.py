import sys
import os
import io

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal
from app.models.models import Itinerary
from app.models.collaboration import TripCollaborator, LeaderLocation, MemberLocation

db = SessionLocal()

# List itineraries
trips = db.query(Itinerary).all()
print("=== ITINERARIES ===")
for t in trips:
    print(f"ID: {t.id}, Owner: {t.user_id}, Dest: {t.destination}")

# For each trip, show collaborators
print("\n=== COLLABORATORS ===")
collabs = db.query(TripCollaborator).all()
for c in collabs:
    print(f"Trip: {c.trip_id}, User ID: {c.user_id}, Role: {c.role}, Joined: {c.joined_at}")

# Show leader locations
print("\n=== LEADER LOCATIONS ===")
leaders = db.query(LeaderLocation).all()
for l in leaders:
    print(f"Trip: {l.trip_id}, Lat: {l.lat}, Lon: {l.lon}, Updated: {l.updated_at}")

# Show member locations
print("\n=== MEMBER LOCATIONS ===")
members = db.query(MemberLocation).all()
for m in members:
    print(f"ID: {m.id}, Trip: {m.trip_id}, User: {m.user_id}, Lat: {m.latitude}, Lon: {m.longitude}, Sharing: {m.is_sharing}, Updated: {m.last_updated}")

db.close()
