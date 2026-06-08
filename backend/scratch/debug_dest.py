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
from app.services.collaboration_service import CollaborationService, MEMBER_PRESENCE_STATES

db = SessionLocal()
service = CollaborationService(db)

# Ensure owner collaborator is set up
trip_id = 4
leader_id = 10

# We make sure owner membership exists in db
owner = service.ensure_owner_membership(trip_id)
print("Owner collaborator entry in DB:", owner.id, owner.role)

# Make sure Gateway of India is normalized to status='current'
from app.services.database_service import normalize_daily_plans
trip = service.repo.get_trip(trip_id)
normalized = normalize_daily_plans(trip.daily_plans)
trip.daily_plans = normalized
db.commit()

print("MEMBER_PRESENCE_STATES at start:", MEMBER_PRESENCE_STATES)

# Run transition checks step by step
print("\n--- Teleport 1: 18.9220, 72.8347 (arrived) ---")
events1 = service._detect_arrival_transitions(trip_id, leader_id, None, None, 18.9220, 72.8347)
print("Events triggered:", events1)
print("MEMBER_PRESENCE_STATES after 1:", MEMBER_PRESENCE_STATES)

print("\n--- Teleport 2: 18.9320, 72.8447 (left) ---")
events2 = service._detect_arrival_transitions(trip_id, leader_id, 18.9220, 72.8347, 18.9320, 72.8447)
print("Events triggered:", events2)
print("MEMBER_PRESENCE_STATES after 2:", MEMBER_PRESENCE_STATES)

print("\n--- Teleport 3: 18.9220, 72.8338 (arrived again) ---")
events3 = service._detect_arrival_transitions(trip_id, leader_id, 18.9320, 72.8447, 18.9220, 72.8338)
print("Events triggered:", events3)
print("MEMBER_PRESENCE_STATES after 3:", MEMBER_PRESENCE_STATES)

db.close()
