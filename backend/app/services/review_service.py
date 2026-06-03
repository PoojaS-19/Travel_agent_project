"""
Service for managing place and hotel reviews, ratings, analytics, and AI summaries.
"""
import os
import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.models import (
    PlaceReview,
    HotelReview,
    ReviewMedia,
    ReviewLike,
    ReviewReport,
    User,
    Itinerary,
    Booking,
    Hotel,
    TripCollaborator
)
from app.services.gemini import get_gemini_response
from typing import List, Dict, Any, Optional


class ReviewService:
    """Service for handling place and hotel reviews, verification, media, likes, and analytics"""

    # --- VERIFICATION HELPERS ---

    @staticmethod
    def check_verified_visitor(db: Session, user_id: int, place_name: str) -> bool:
        """Check if a tourist place exists in user's saved/collaborated itineraries"""
        try:
            # Own itineraries
            own_itins = db.query(Itinerary).filter(Itinerary.user_id == user_id).all()
            # Collaborated itineraries
            collab_itins = db.query(Itinerary).join(
                TripCollaborator, TripCollaborator.trip_id == Itinerary.id
            ).filter(TripCollaborator.user_id == user_id).all()

            all_itineraries = list(set(own_itins + collab_itins))
            place_name_lower = place_name.lower().strip()

            for itin in all_itineraries:
                if not itin.daily_plans:
                    continue
                try:
                    if isinstance(itin.daily_plans, str):
                        plans = json.loads(itin.daily_plans)
                    else:
                        plans = itin.daily_plans
                    
                    if not isinstance(plans, list):
                        continue
                    for day in plans:
                        activities = day.get("activities", [])
                        for act in activities:
                            if act.get("place_name", "").lower().strip() == place_name_lower:
                                return True
                except Exception:
                    pass
        except Exception as e:
            print(f"Error checking verified visitor: {e}")
        return False

    @staticmethod
    def check_verified_stay(db: Session, user_id: int, hotel_name: str) -> bool:
        """Check if user has a completed/confirmed booking for this hotel"""
        try:
            # Look up hotels matching this name
            hotels = db.query(Hotel).filter(Hotel.name.ilike(hotel_name.strip())).all()
            if not hotels:
                return False
            hotel_ids = [h.id for h in hotels]

            booking = db.query(Booking).filter(
                Booking.user_id == user_id,
                Booking.type == "hotel",
                Booking.status == "confirmed",
                Booking.item_id.in_(hotel_ids)
            ).first()
            return booking is not None
        except Exception as e:
            print(f"Error checking verified stay: {e}")
        return False

    # --- CREATE REVIEW METHODS ---

    @staticmethod
    def add_place_review(db: Session, user_id: int, review_data: Dict[str, Any]) -> PlaceReview:
        """Add a new place review with detailed ratings"""
        place_name = review_data["place_name"]
        verified = ReviewService.check_verified_visitor(db, user_id, place_name)

        review = PlaceReview(
            user_id=user_id,
            place_name=place_name,
            destination=review_data["destination"],
            rating=review_data["rating"],
            review=review_data.get("review") or review_data.get("review_text"),
            category=review_data.get("category"),
            trip_type=review_data.get("trip_type") or review_data.get("traveler_type"),
            mood=review_data.get("mood"),
            lat=review_data.get("lat"),
            lon=review_data.get("lon"),
            # Extended fields
            review_title=review_data.get("review_title"),
            additional_notes=review_data.get("additional_notes"),
            would_visit_again=review_data.get("would_visit_again"),
            traveler_type=review_data.get("traveler_type") or review_data.get("trip_type"),
            verified_status=verified,
            # Subcategory ratings
            rating_safety=review_data.get("rating_safety"),
            rating_cleanliness=review_data.get("rating_cleanliness"),
            rating_crowd=review_data.get("rating_crowd"),
            rating_accessibility=review_data.get("rating_accessibility"),
            rating_scenic=review_data.get("rating_scenic"),
            rating_family=review_data.get("rating_family"),
            rating_food=review_data.get("rating_food"),
            rating_transport=review_data.get("rating_transport"),
            rating_value=review_data.get("rating_value")
        )
        db.add(review)
        db.commit()
        db.refresh(review)
        return review

    @staticmethod
    def add_hotel_review(db: Session, user_id: int, review_data: Dict[str, Any]) -> HotelReview:
        """Add a new hotel review with detailed ratings"""
        hotel_name = review_data["hotel_name"]
        verified = ReviewService.check_verified_stay(db, user_id, hotel_name)

        review = HotelReview(
            user_id=user_id,
            hotel_name=hotel_name,
            hotel_id=review_data.get("hotel_id"),
            rating=review_data["rating"],
            review_title=review_data.get("review_title"),
            review_text=review_data.get("review_text") or review_data.get("review"),
            additional_notes=review_data.get("additional_notes"),
            would_recommend=review_data.get("would_recommend"),
            stay_date=review_data.get("stay_date"),
            traveler_type=review_data.get("traveler_type"),
            trip_purpose=review_data.get("trip_purpose"),
            verified_status=verified,
            # Subcategory ratings
            rating_cleanliness=review_data.get("rating_cleanliness"),
            rating_staff=review_data.get("rating_staff"),
            rating_comfort=review_data.get("rating_comfort"),
            rating_food=review_data.get("rating_food"),
            rating_value=review_data.get("rating_value"),
            rating_location=review_data.get("rating_location"),
            rating_amenities=review_data.get("rating_amenities"),
            rating_safety=review_data.get("rating_safety"),
            rating_checkin=review_data.get("rating_checkin"),
            rating_wifi=review_data.get("rating_wifi")
        )
        db.add(review)
        db.commit()
        db.refresh(review)
        return review

    # --- GET REVIEWS METHODS ---

    @staticmethod
    def get_place_reviews(db: Session, place_name: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Fetch all place reviews matching place_name with filters and sorting"""
        query = db.query(PlaceReview).filter(PlaceReview.place_name.ilike(place_name.strip()))
        
        if filters:
            # Traveler type filter
            if filters.get("traveler_type"):
                query = query.filter(
                    (PlaceReview.traveler_type == filters["traveler_type"]) | 
                    (PlaceReview.trip_type == filters["traveler_type"])
                )
            # Verified filter
            if filters.get("verified_only"):
                query = query.filter(PlaceReview.verified_status == True)
            # Filter by rating range, category, etc if needed

        reviews = query.all()
        formatted = []
        for r in reviews:
            # Count helpful likes
            likes_count = db.query(ReviewLike).filter(
                ReviewLike.review_type == "place",
                ReviewLike.review_id == r.id
            ).count()

            # Media files
            media_files = db.query(ReviewMedia).filter(
                ReviewMedia.review_type == "place",
                ReviewMedia.review_id == r.id
            ).all()

            # Get user username
            user = db.query(User).filter(User.id == r.user_id).first()
            username = user.username if user else "Anonymous"

            # Apply media filters in-memory
            has_photos = any(m.media_type == "image" for m in media_files)
            has_videos = any(m.media_type == "video" for m in media_files)
            if filters:
                if filters.get("with_photos") and not has_photos:
                    continue
                if filters.get("with_videos") and not has_videos:
                    continue

            formatted.append({
                "id": r.id,
                "review_type": "place",
                "user_id": r.user_id,
                "username": username,
                "place_name": r.place_name,
                "destination": r.destination,
                "rating": float(r.rating) if r.rating else 0.0,
                "review": r.review,
                "review_title": r.review_title,
                "additional_notes": r.additional_notes,
                "would_visit_again": r.would_visit_again,
                "traveler_type": r.traveler_type or r.trip_type,
                "verified_status": r.verified_status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "helpful_count": likes_count,
                "media": [{"id": m.id, "media_type": m.media_type, "file_url": m.file_url} for m in media_files],
                # subratings
                "rating_safety": r.rating_safety,
                "rating_cleanliness": r.rating_cleanliness,
                "rating_crowd": r.rating_crowd,
                "rating_accessibility": r.rating_accessibility,
                "rating_scenic": r.rating_scenic,
                "rating_family": r.rating_family,
                "rating_food": r.rating_food,
                "rating_transport": r.rating_transport,
                "rating_value": r.rating_value
            })

        # Sorting
        if filters and filters.get("sort_by"):
            sort = filters["sort_by"]
            if sort == "latest":
                formatted.sort(key=lambda x: x["created_at"] or "", reverse=True)
            elif sort == "oldest":
                formatted.sort(key=lambda x: x["created_at"] or "")
            elif sort == "highest_rated":
                formatted.sort(key=lambda x: x["rating"], reverse=True)
            elif sort == "lowest_rated":
                formatted.sort(key=lambda x: x["rating"])
            elif sort == "most_helpful":
                formatted.sort(key=lambda x: x["helpful_count"], reverse=True)
        else:
            # default to latest
            formatted.sort(key=lambda x: x["created_at"] or "", reverse=True)

        return formatted

    @staticmethod
    def get_hotel_reviews(db: Session, hotel_name: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Fetch all hotel reviews matching hotel_name with filters and sorting"""
        query = db.query(HotelReview).filter(HotelReview.hotel_name.ilike(hotel_name.strip()))
        
        if filters:
            if filters.get("traveler_type"):
                query = query.filter(HotelReview.traveler_type == filters["traveler_type"])
            if filters.get("verified_only"):
                query = query.filter(HotelReview.verified_status == True)

        reviews = query.all()
        formatted = []
        for r in reviews:
            # Count helpful likes
            likes_count = db.query(ReviewLike).filter(
                ReviewLike.review_type == "hotel",
                ReviewLike.review_id == r.id
            ).count()

            # Media files
            media_files = db.query(ReviewMedia).filter(
                ReviewMedia.review_type == "hotel",
                ReviewMedia.review_id == r.id
            ).all()

            # Get user username
            user = db.query(User).filter(User.id == r.user_id).first()
            username = user.username if user else "Anonymous"

            # Apply media filters in-memory
            has_photos = any(m.media_type == "image" for m in media_files)
            has_videos = any(m.media_type == "video" for m in media_files)
            if filters:
                if filters.get("with_photos") and not has_photos:
                    continue
                if filters.get("with_videos") and not has_videos:
                    continue

            formatted.append({
                "id": r.id,
                "review_type": "hotel",
                "user_id": r.user_id,
                "username": username,
                "hotel_name": r.hotel_name,
                "hotel_id": r.hotel_id,
                "rating": float(r.rating) if r.rating else 0.0,
                "review": r.review_text,
                "review_title": r.review_title,
                "additional_notes": r.additional_notes,
                "would_recommend": r.would_recommend,
                "stay_date": r.stay_date,
                "traveler_type": r.traveler_type,
                "trip_purpose": r.trip_purpose,
                "verified_status": r.verified_status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "helpful_count": likes_count,
                "media": [{"id": m.id, "media_type": m.media_type, "file_url": m.file_url} for m in media_files],
                # subratings
                "rating_cleanliness": r.rating_cleanliness,
                "rating_staff": r.rating_staff,
                "rating_comfort": r.rating_comfort,
                "rating_food": r.rating_food,
                "rating_value": r.rating_value,
                "rating_location": r.rating_location,
                "rating_amenities": r.rating_amenities,
                "rating_safety": r.rating_safety,
                "rating_checkin": r.rating_checkin,
                "rating_wifi": r.rating_wifi
            })

        # Sorting
        if filters and filters.get("sort_by"):
            sort = filters["sort_by"]
            if sort == "latest":
                formatted.sort(key=lambda x: x["created_at"] or "", reverse=True)
            elif sort == "oldest":
                formatted.sort(key=lambda x: x["created_at"] or "")
            elif sort == "highest_rated":
                formatted.sort(key=lambda x: x["rating"], reverse=True)
            elif sort == "lowest_rated":
                formatted.sort(key=lambda x: x["rating"])
            elif sort == "most_helpful":
                formatted.sort(key=lambda x: x["helpful_count"], reverse=True)
        else:
            # default to latest
            formatted.sort(key=lambda x: x["created_at"] or "", reverse=True)

        return formatted

    # --- EDIT / DELETE REVIEW METHODS ---

    @staticmethod
    def update_review(db: Session, user_id: int, review_type: str, review_id: int, update_data: Dict[str, Any]) -> Any:
        """Update an existing review if it belongs to the user"""
        if review_type == "hotel":
            review = db.query(HotelReview).filter(HotelReview.id == review_id).first()
        else:
            review = db.query(PlaceReview).filter(PlaceReview.id == review_id).first()

        if not review:
            raise Exception("Review not found")
        if review.user_id != user_id:
            raise Exception("Unauthorized to edit this review")

        # Update columns dynamically based on fields in update_data
        for key, value in update_data.items():
            if key == "rating" and value is not None:
                review.rating = value
            elif key == "review_title":
                review.review_title = value
            elif key in ["review_text", "review"]:
                if review_type == "hotel":
                    review.review_text = value
                else:
                    review.review = value
            elif key == "additional_notes":
                review.additional_notes = value
            elif key == "would_recommend" and review_type == "hotel":
                review.would_recommend = value
            elif key == "would_visit_again" and review_type == "place":
                review.would_visit_again = value
            elif key == "stay_date" and review_type == "hotel":
                review.stay_date = value
            elif key == "traveler_type":
                review.traveler_type = value
                if review_type == "place":
                    review.trip_type = value
            elif key == "trip_purpose" and review_type == "hotel":
                review.trip_purpose = value
            elif key.startswith("rating_"):
                # update subcategory rating
                if hasattr(review, key):
                    setattr(review, key, value)

        db.commit()
        db.refresh(review)
        return review

    @staticmethod
    def delete_review(db: Session, user_id: int, review_type: str, review_id: int, is_admin: bool = False) -> bool:
        """Delete an existing review (user owned or by admin)"""
        if review_type == "hotel":
            review = db.query(HotelReview).filter(HotelReview.id == review_id).first()
        else:
            review = db.query(PlaceReview).filter(PlaceReview.id == review_id).first()

        if not review:
            raise Exception("Review not found")
        if review.user_id != user_id and not is_admin:
            raise Exception("Unauthorized to delete this review")

        # Cascade clean up likes, reports, media
        db.query(ReviewLike).filter(ReviewLike.review_type == review_type, ReviewLike.review_id == review_id).delete()
        db.query(ReviewReport).filter(ReviewReport.review_type == review_type, ReviewReport.review_id == review_id).delete()
        db.query(ReviewMedia).filter(ReviewMedia.review_type == review_type, ReviewMedia.review_id == review_id).delete()
        db.delete(review)
        db.commit()
        return True

    # --- INTERACTIONS ---

    @staticmethod
    def like_review(db: Session, user_id: int, review_type: str, review_id: int) -> Dict[str, Any]:
        """Toggles helpful like on a review"""
        existing = db.query(ReviewLike).filter(
            ReviewLike.user_id == user_id,
            ReviewLike.review_type == review_type,
            ReviewLike.review_id == review_id
        ).first()

        if existing:
            db.delete(existing)
            liked = False
        else:
            new_like = ReviewLike(
                user_id=user_id,
                review_type=review_type,
                review_id=review_id
            )
            db.add(new_like)
            liked = True

        db.commit()

        # Count total likes
        count = db.query(ReviewLike).filter(
            ReviewLike.review_type == review_type,
            ReviewLike.review_id == review_id
        ).count()

        return {"liked": liked, "helpful_count": count}

    @staticmethod
    def report_review(db: Session, user_id: int, review_type: str, review_id: int, reason: str, details: Optional[str] = None) -> ReviewReport:
        """Flags review as spam or offensive"""
        # Verify review exists
        if review_type == "hotel":
            review = db.query(HotelReview).filter(HotelReview.id == review_id).first()
        else:
            review = db.query(PlaceReview).filter(PlaceReview.id == review_id).first()

        if not review:
            raise Exception("Review not found")

        report = ReviewReport(
            user_id=user_id,
            review_type=review_type,
            review_id=review_id,
            reason=reason,
            details=details,
            status="pending"
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        return report

    # --- MEDIA SUPPORT ---

    @staticmethod
    def add_review_media(db: Session, review_type: str, review_id: int, media_type: str, file_url: str) -> ReviewMedia:
        """Create media record linked to a review"""
        media = ReviewMedia(
            review_type=review_type,
            review_id=review_id,
            media_type=media_type,
            file_url=file_url
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        return media

    # --- ANALYTICS ---

    @staticmethod
    def get_review_analytics(db: Session, review_type: str, name: str) -> Dict[str, Any]:
        """Fetch average ratings and breakdowns for a hotel or tourist place"""
        if review_type == "hotel":
            reviews = db.query(HotelReview).filter(HotelReview.hotel_name.ilike(name.strip())).all()
            total = len(reviews)
            if total == 0:
                return {
                    "total_reviews": 0,
                    "overall_rating": 0.0,
                    "recommendation_percentage": 0,
                    "category_averages": {
                        "cleanliness": 0.0, "staff": 0.0, "comfort": 0.0, "food": 0.0, "value": 0.0,
                        "location": 0.0, "amenities": 0.0, "safety": 0.0, "checkin": 0.0, "wifi": 0.0
                    },
                    "rating_distribution": {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
                }

            # Calculations
            overall = sum(float(r.rating) for r in reviews) / total
            rec_count = sum(1 for r in reviews if r.would_recommend == True)
            rec_pct = int((rec_count / total) * 100)

            # Category ratings (only count not None)
            cats = ["cleanliness", "staff", "comfort", "food", "value", "location", "amenities", "safety", "checkin", "wifi"]
            cat_avgs = {}
            for c in cats:
                vals = [getattr(r, f"rating_{c}") for r in reviews if getattr(r, f"rating_{c}") is not None]
                cat_avgs[c] = round(sum(vals) / len(vals), 1) if vals else 0.0

            # Rating distribution
            dist = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
            for r in reviews:
                rating_int = min(5, max(1, int(round(float(r.rating)))))
                dist[rating_int] += 1

            return {
                "total_reviews": total,
                "overall_rating": round(overall, 1),
                "recommendation_percentage": rec_pct,
                "category_averages": cat_avgs,
                "rating_distribution": dist
            }
        else:
            reviews = db.query(PlaceReview).filter(PlaceReview.place_name.ilike(name.strip())).all()
            total = len(reviews)
            if total == 0:
                return {
                    "total_reviews": 0,
                    "overall_rating": 0.0,
                    "recommendation_percentage": 0,
                    "category_averages": {
                        "safety": 0.0, "cleanliness": 0.0, "crowd": 0.0, "accessibility": 0.0,
                        "scenic": 0.0, "family": 0.0, "food": 0.0, "transport": 0.0, "value": 0.0
                    },
                    "rating_distribution": {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
                }

            # Calculations
            overall = sum(float(r.rating) for r in reviews) / total
            would_visit_again_count = sum(1 for r in reviews if r.would_visit_again == True)
            rec_pct = int((would_visit_again_count / total) * 100)

            # Category ratings
            cats = ["safety", "cleanliness", "crowd", "accessibility", "scenic", "family", "food", "transport", "value"]
            cat_avgs = {}
            for c in cats:
                vals = [getattr(r, f"rating_{c}") for r in reviews if getattr(r, f"rating_{c}") is not None]
                cat_avgs[c] = round(sum(vals) / len(vals), 1) if vals else 0.0

            # Rating distribution
            dist = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
            for r in reviews:
                rating_int = min(5, max(1, int(round(float(r.rating)))))
                dist[rating_int] += 1

            return {
                "total_reviews": total,
                "overall_rating": round(overall, 1),
                "recommendation_percentage": rec_pct,
                "category_averages": cat_avgs,
                "rating_distribution": dist
            }

    # --- AI REVIEW INSIGHTS ---

    @staticmethod
    def get_ai_summary(db: Session, review_type: str, name: str) -> Dict[str, Any]:
        """Generates an AI summary of strengths, complaints, and overall sentiment using Gemini API"""
        if review_type == "hotel":
            reviews = db.query(HotelReview).filter(
                HotelReview.hotel_name.ilike(name.strip()),
                (HotelReview.review_text != None) & (HotelReview.review_text != "")
            ).all()
            texts = [f"[{r.rating}/5] {r.review_title or ''}: {r.review_text}" for r in reviews]
        else:
            reviews = db.query(PlaceReview).filter(
                PlaceReview.place_name.ilike(name.strip()),
                (PlaceReview.review != None) & (PlaceReview.review != "")
            ).all()
            texts = [f"[{r.rating}/5] {r.review_title or ''}: {r.review}" for r in reviews]

        # Programmatic fallback implementation if no reviews
        if not texts:
            # Let's count reviews without text
            overall_rating = 0.0
            if review_type == "hotel":
                all_revs = db.query(HotelReview).filter(HotelReview.hotel_name.ilike(name.strip())).all()
            else:
                all_revs = db.query(PlaceReview).filter(PlaceReview.place_name.ilike(name.strip())).all()
            
            if all_revs:
                avg_rating = sum(float(r.rating) for r in all_revs) / len(all_revs)
                sentiment = "Positive" if avg_rating >= 4.0 else ("Negative" if avg_rating <= 2.2 else "Neutral")
                return {
                    "top_strengths": ["Ratings are generally good"] if avg_rating >= 4.0 else ["Good overall experience"],
                    "common_complaints": ["No specific complaints compiled"] if avg_rating >= 3.0 else ["Needs general improvement"],
                    "overall_sentiment": sentiment,
                    "is_fallback": True
                }
            return {
                "top_strengths": ["No reviews yet"],
                "common_complaints": ["No reviews yet"],
                "overall_sentiment": "Neutral",
                "is_fallback": True
            }

        # Attempt to get a summary from Gemini
        try:
            review_corpus = "\n".join(texts[:15]) # Limit to top 15 reviews to fit model prompts easily
            prompt = (
                f"You are a helpful travel review analyst. Analyze these reviews for the destination/accommodation named '{name}':\n\n"
                f"{review_corpus}\n\n"
                "Synthesize this feedback. Respond ONLY with a valid JSON object matching this schema. "
                "Do NOT include any markdown code blocks, backticks, or other text outside the JSON. "
                "The response must be exactly parseable by json.loads() in Python.\n"
                "{\n"
                '  "top_strengths": ["string", "string", ...],\n'
                '  "common_complaints": ["string", "string", ...],\n'
                '  "overall_sentiment": "Positive" | "Neutral" | "Negative"\n'
                "}"
            )
            response = get_gemini_response(prompt)
            resp_text = response.text.strip()
            
            # Strip markdown formatting block if the model returned it
            if resp_text.startswith("```"):
                lines = resp_text.splitlines()
                # Remove starting and ending lines
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                resp_text = "\n".join(lines).strip()

            parsed = json.loads(resp_text)
            parsed["is_fallback"] = False
            return parsed

        except Exception as e:
            print(f"Gemini AI Review summary failed: {e}. Falling back to programmatic compilation.")

            # --- PROGRAMMATIC FALLBACK COMPILATION ---
            # Compile average rating
            ratings = []
            if review_type == "hotel":
                ratings = [float(r.rating) for r in reviews]
            else:
                ratings = [float(r.rating) for r in reviews]
            avg_rating = sum(ratings) / len(ratings) if ratings else 3.0
            sentiment = "Positive" if avg_rating >= 3.8 else ("Negative" if avg_rating <= 2.3 else "Neutral")

            # Basic keyword matches
            strengths_keywords = {
                "clean": "Clean environment & rooms",
                "staff": "Friendly and helpful staff",
                "location": "Convenient and accessible location",
                "food": "Delicious food options",
                "comfort": "Comfortable stay & seating",
                "beautiful": "Beautiful and scenic viewpoints",
                "safe": "Highly secure & family-friendly atmosphere",
                "value": "Great value for money",
            }
            complaints_keywords = {
                "dirty": "Housekeeping & cleanliness issues",
                "rude": "Unsupportive staff behavior",
                "slow": "Slow check-in/service turnaround",
                "wifi": "Poor internet or WiFi connectivity",
                "crowd": "High crowd density during peak hours",
                "expensive": "Overpriced food or services",
                "noise": "High noise levels",
                "bad": "Underwhelming experience",
            }

            all_words_lower = " ".join(texts).lower()
            strengths = []
            complaints = []

            for keyword, desc in strengths_keywords.items():
                if keyword in all_words_lower:
                    strengths.append(desc)
            for keyword, desc in complaints_keywords.items():
                if keyword in all_words_lower:
                    complaints.append(desc)

            # Cap or pad lists
            if not strengths:
                strengths = ["Overall friendly environment" if avg_rating >= 3.5 else "Has standard amenities"]
            if not complaints:
                complaints = ["Minor service delays" if avg_rating < 4.0 else "No prominent complaints"]

            return {
                "top_strengths": strengths[:3],
                "common_complaints": complaints[:3],
                "overall_sentiment": sentiment,
                "is_fallback": True
            }

    @staticmethod
    def add_review(db: Session, user_id: int, review_data: Dict[str, Any]) -> PlaceReview:
        """Add a new review for a place (backward compatibility)"""
        return ReviewService.add_place_review(db, user_id, review_data)

    @staticmethod
    def get_reviews_by_destination(db: Session, destination: str) -> List[PlaceReview]:
        """Get all reviews for a specific destination (backward compatibility)"""
        return db.query(PlaceReview).filter(PlaceReview.destination == destination).all()

    @staticmethod
    def get_top_places(db: Session, destination: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top-rated places for a destination with average ratings (backward compatibility)"""
        result = db.query(
            PlaceReview.place_name,
            func.avg(PlaceReview.rating).label('avg_rating'),
            func.count(PlaceReview.id).label('review_count'),
            func.avg(PlaceReview.lat).label('lat'),
            func.avg(PlaceReview.lon).label('lon'),
            func.max(PlaceReview.category).label('category') # Using max instead of mode for generic compatibility
        ).filter(
            PlaceReview.destination == destination
        ).group_by(
            PlaceReview.place_name
        ).having(
            func.count(PlaceReview.id) >= 1
        ).order_by(
            func.avg(PlaceReview.rating).desc(),
            func.count(PlaceReview.id).desc()
        ).limit(limit).all()

        return [
            {
                "place_name": row.place_name,
                "rating": float(row.avg_rating),
                "review_count": row.review_count,
                "lat": float(row.lat) if row.lat else None,
                "lon": float(row.lon) if row.lon else None,
                "category": row.category
            }
            for row in result
        ]

    @staticmethod
    def calculate_average_rating(db: Session, place_name: str, destination: str) -> float:
        """Calculate average rating for a specific place (backward compatibility)"""
        result = db.query(func.avg(PlaceReview.rating)).filter(
            PlaceReview.place_name == place_name,
            PlaceReview.destination == destination
        ).scalar()
        return float(result) if result else 0.0