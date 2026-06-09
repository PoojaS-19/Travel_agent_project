"""
Service for managing place reviews and ratings.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.models import PlaceReview
from typing import List, Dict, Any


class ReviewService:
    """Service for handling place reviews"""

    @staticmethod
    def add_review(db: Session, user_id: int, review_data: Dict[str, Any]) -> PlaceReview:
        """Add a new review for a place"""
        review = PlaceReview(
            user_id=user_id,
            place_name=review_data["place_name"],
            destination=review_data["destination"],
            rating=review_data["rating"],
            review=review_data.get("review"),
            category=review_data.get("category"),
            trip_type=review_data.get("trip_type"),
            mood=review_data.get("mood"),
            lat=review_data.get("lat"),
            lon=review_data.get("lon"),
            photo_url=review_data.get("photo_url")
        )
        db.add(review)
        db.commit()
        db.refresh(review)
        return review

    @staticmethod
    def get_reviews_by_destination(db: Session, destination: str) -> List[PlaceReview]:
        """Get all reviews for a specific destination"""
        return db.query(PlaceReview).filter(PlaceReview.destination == destination).all()

    @staticmethod
    def get_top_places(db: Session, destination: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top-rated places for a destination with average ratings"""
        # Group by place_name and calculate average rating
        result = db.query(
            PlaceReview.place_name,
            func.avg(PlaceReview.rating).label('avg_rating'),
            func.count(PlaceReview.id).label('review_count'),
            func.avg(PlaceReview.lat).label('lat'),
            func.avg(PlaceReview.lon).label('lon'),
            func.max(PlaceReview.category).label('category'),
            func.max(PlaceReview.photo_url).label('photo_url')
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
                "category": row.category,
                "photo_url": row.photo_url
            }
            for row in result
        ]

    @staticmethod
    def calculate_average_rating(db: Session, place_name: str, destination: str) -> float:
        """Calculate average rating for a specific place"""
        result = db.query(func.avg(PlaceReview.rating)).filter(
            PlaceReview.place_name == place_name,
            PlaceReview.destination == destination
        ).scalar()

        return float(result) if result else 0.0