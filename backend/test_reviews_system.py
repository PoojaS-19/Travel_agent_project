"""
Verification script for Travel Review System
Tests database migrations, verification badge checks, analytics, and interactions.
"""
import sys
import os
import json
from datetime import datetime

# Setup path to import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import engine, SessionLocal, Base
from app.models import User, Hotel, Booking, Itinerary, PlaceReview, HotelReview, ReviewLike, ReviewReport
from app.services.review_service import ReviewService


def setup_test_data(db: Session):
    print("Setting up mock test data in database...")

    # 1. Create a test user if not exists
    user = db.query(User).filter(User.username == "test_reviewer").first()
    if not user:
        user = User(
            username="test_reviewer",
            email="tester@example.com",
            password_hash="fakehash",
            is_verified=True,
            is_admin=True # making them admin for testing
        )
        db.add(user)
        db.flush()
    print(f"User: {user.username} (ID: {user.id})")

    # 2. Create a test hotel if not exists
    hotel = db.query(Hotel).filter(Hotel.name == "Grand Palace Resort").first()
    if not hotel:
        hotel = Hotel(
            name="Grand Palace Resort",
            address="123 Luxury Road, Goa",
            rating=4.5,
            city="Goa"
        )
        db.add(hotel)
        db.flush()
    print(f"Hotel: {hotel.name} (ID: {hotel.id})")

    # 3. Create a confirmed booking for the user for this hotel
    booking = db.query(Booking).filter(
        Booking.user_id == user.id,
        Booking.type == "hotel",
        Booking.item_id == hotel.id
    ).first()
    if not booking:
        booking = Booking(
            user_id=user.id,
            type="hotel",
            item_id=hotel.id,
            status="confirmed",
            total_price=9999.00
        )
        db.add(booking)
        db.flush()
    print(f"Hotel Booking PNR created (ID: {booking.id})")

    # 4. Create an itinerary containing a specific tourist place
    itinerary = db.query(Itinerary).filter(Itinerary.user_id == user.id).first()
    daily_plans = [
        {
            "day": 1,
            "activities": [
                {
                    "place_name": "Sunset Beach Viewpoint",
                    "category": "Attraction",
                    "lat": 15.4989,
                    "lon": 73.8278,
                    "description": "Watch beautiful sunset over the sea."
                }
            ]
        }
    ]
    if not itinerary:
        itinerary = Itinerary(
            user_id=user.id,
            start_city="Mumbai",
            destination="Goa",
            itinerary_text="A trip to Goa beaches",
            daily_plans=json.dumps(daily_plans)
        )
        db.add(itinerary)
        db.flush()
    else:
        # Update daily plans to ensure Sunset Beach is present
        itinerary.daily_plans = json.dumps(daily_plans)
        db.flush()
    print(f"Itinerary created with tourist place 'Sunset Beach Viewpoint' (ID: {itinerary.id})")

    db.commit()
    return user, hotel, itinerary


def run_tests():
    # Run migrations first
    print("Running database migrations...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables created/verified successfully")
    except Exception as e:
        print(f"Warning: Base.metadata.create_all failed: {e}")

    # Alter table for trip_invitations if missing (just like main.py)
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE trip_invitations ADD COLUMN otp_code VARCHAR(6)"))
    except Exception:
        pass

    # Alter table for place_reviews if missing
    place_reviews_cols = [
        ("review_title", "VARCHAR(200)"),
        ("additional_notes", "TEXT"),
        ("would_visit_again", "BOOLEAN"),
        ("traveler_type", "VARCHAR(50)"),
        ("verified_status", "BOOLEAN DEFAULT FALSE"),
        ("rating_safety", "INTEGER"),
        ("rating_cleanliness", "INTEGER"),
        ("rating_crowd", "INTEGER"),
        ("rating_accessibility", "INTEGER"),
        ("rating_scenic", "INTEGER"),
        ("rating_family", "INTEGER"),
        ("rating_food", "INTEGER"),
        ("rating_transport", "INTEGER"),
        ("rating_value", "INTEGER"),
    ]
    for col_name, col_type in place_reviews_cols:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE place_reviews ADD COLUMN {col_name} {col_type}"))
        except Exception:
            pass

    # Alter table for users if missing
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE"))
    except Exception:
        pass


    db = SessionLocal()
    try:
        user, hotel, itinerary = setup_test_data(db)

        print("\n--- TEST 1: Verification Badge Checks ---")
        
        # Test Hotel Stay Verification (Should be True)
        verified_stay = ReviewService.check_verified_stay(db, user.id, "Grand Palace Resort")
        print(f"Verified stay for 'Grand Palace Resort': {verified_stay}")
        assert verified_stay is True, "Verification for stay should be True"

        # Test Hotel Stay Verification for invalid hotel name (Should be False)
        verified_stay_fake = ReviewService.check_verified_stay(db, user.id, "Fake Motel")
        print(f"Verified stay for 'Fake Motel': {verified_stay_fake}")
        assert verified_stay_fake is False, "Verification for invalid stay should be False"

        # Test Place Visitor Verification (Should be True)
        verified_visitor = ReviewService.check_verified_visitor(db, user.id, "Sunset Beach Viewpoint")
        print(f"Verified visitor for 'Sunset Beach Viewpoint': {verified_visitor}")
        assert verified_visitor is True, "Verification for visitor should be True"

        # Test Place Visitor Verification for invalid place name (Should be False)
        verified_visitor_fake = ReviewService.check_verified_visitor(db, user.id, "Eiffel Tower")
        print(f"Verified visitor for 'Eiffel Tower': {verified_visitor_fake}")
        assert verified_visitor_fake is False, "Verification for invalid visitor should be False"

        print("[OK] TEST 1 PASSED!")

        print("\n--- TEST 2: Hotel Review Creation & Analytics ---")
        
        # Add a mock hotel review
        hotel_review_data = {
            "hotel_name": "Grand Palace Resort",
            "hotel_id": hotel.id,
            "rating": 5.0,
            "review_title": "Absolutely outstanding stay!",
            "review_text": "Perfect stay, clean rooms, slow wifi though.",
            "additional_notes": "Ask for sea-view rooms.",
            "would_recommend": True,
            "stay_date": "2026-05-15",
            "traveler_type": "Couple",
            "trip_purpose": "Honeymoon",
            "rating_cleanliness": 5,
            "rating_staff": 5,
            "rating_comfort": 5,
            "rating_food": 4,
            "rating_value": 5,
            "rating_location": 5,
            "rating_amenities": 4,
            "rating_safety": 5,
            "rating_checkin": 5,
            "rating_wifi": 2
        }
        
        # Clean up old reviews of same name to avoid build-up in analytics
        db.query(HotelReview).filter(HotelReview.hotel_name == "Grand Palace Resort").delete()
        db.commit()
        
        h_rev = ReviewService.add_hotel_review(db, user.id, hotel_review_data)
        print(f"Hotel Review created successfully! ID: {h_rev.id}, Verified: {h_rev.verified_status}")
        assert h_rev.verified_status is True, "Review should be marked verified"
        
        # Verify fields
        assert h_rev.rating_cleanliness == 5
        assert h_rev.rating_wifi == 2
        assert h_rev.stay_date == "2026-05-15"
        
        # Fetch hotel analytics
        analytics = ReviewService.get_review_analytics(db, "hotel", "Grand Palace Resort")
        print("Hotel Review Analytics:", json.dumps(analytics, indent=2))
        assert analytics["total_reviews"] == 1
        assert analytics["overall_rating"] == 5.0
        assert analytics["recommendation_percentage"] == 100
        assert analytics["category_averages"]["cleanliness"] == 5.0
        assert analytics["category_averages"]["wifi"] == 2.0
        assert analytics["rating_distribution"][5] == 1

        print("[OK] TEST 2 PASSED!")

        print("\n--- TEST 3: Place Review Creation & Analytics ---")
        
        place_review_data = {
            "place_name": "Sunset Beach Viewpoint",
            "destination": "Goa",
            "rating": 4.5,
            "review_title": "Magnificent sunset!",
            "review": "Very clean beach, crowded in evenings.",
            "additional_notes": "Visit around 5:30 PM.",
            "would_visit_again": True,
            "traveler_type": "Solo Traveler",
            "category": "Attraction",
            "rating_safety": 5,
            "rating_cleanliness": 4,
            "rating_crowd": 2,
            "rating_accessibility": 4,
            "rating_scenic": 5,
            "rating_family": 4,
            "rating_food": 3,
            "rating_transport": 4,
            "rating_value": 5
        }
        
        # Clean up old place reviews
        db.query(PlaceReview).filter(PlaceReview.place_name == "Sunset Beach Viewpoint").delete()
        db.commit()
        
        p_rev = ReviewService.add_place_review(db, user.id, place_review_data)
        print(f"Place Review created successfully! ID: {p_rev.id}, Verified: {p_rev.verified_status}")
        assert p_rev.verified_status is True, "Place review should be marked verified"
        
        # Fetch analytics
        p_analytics = ReviewService.get_review_analytics(db, "place", "Sunset Beach Viewpoint")
        print("Place Review Analytics:", json.dumps(p_analytics, indent=2))
        assert p_analytics["total_reviews"] == 1
        assert p_analytics["overall_rating"] == 4.5
        assert p_analytics["category_averages"]["scenic"] == 5.0
        assert p_analytics["category_averages"]["crowd"] == 2.0

        print("[OK] TEST 3 PASSED!")

        print("\n--- TEST 4: Interactions (Likes & Reports) ---")
        
        # Test Helpful Like Toggle
        # First like
        like_res = ReviewService.like_review(db, user.id, "hotel", h_rev.id)
        print(f"Liked hotel review: {like_res}")
        assert like_res["liked"] is True
        assert like_res["helpful_count"] == 1
        
        # Second like (toggles off)
        unlike_res = ReviewService.like_review(db, user.id, "hotel", h_rev.id)
        print(f"Unliked hotel review: {unlike_res}")
        assert unlike_res["liked"] is False
        assert unlike_res["helpful_count"] == 0
        
        # Report Review
        report = ReviewService.report_review(db, user.id, "place", p_rev.id, "Spam", "This looks like a copy-paste review.")
        print(f"Report created on place review: ID {report.id}, Reason: {report.reason}, Status: {report.status}")
        assert report.reason == "Spam"
        assert report.status == "pending"

        print("[OK] TEST 4 PASSED!")

        # Clean up test review entries to leave DB neat
        h_rev_id = h_rev.id
        p_rev_id = p_rev.id
        db.query(HotelReview).filter(HotelReview.hotel_name == "Grand Palace Resort").delete()
        db.query(PlaceReview).filter(PlaceReview.place_name == "Sunset Beach Viewpoint").delete()
        db.query(ReviewLike).filter(ReviewLike.review_id == h_rev_id).delete()
        db.query(ReviewReport).filter(ReviewReport.review_id == p_rev_id).delete()
        db.commit()
        print("\nCleanup completed.")
        print("=============================")
        print("ALL TESTS PASSED SUCCESSFULLY!")
        print("=============================")

    except Exception as e:
        print(f"\n[ERROR] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
