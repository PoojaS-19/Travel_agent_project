"""
API routes for place reviews and community recommendations.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.review_service import ReviewService
from app.services.community_recommendation_service import CommunityRecommendationService
from app.routers.auth import get_current_user_id
from pydantic import BaseModel
from typing import Optional


class ReviewCreate(BaseModel):
    place_name: str
    destination: str
    rating: float
    review: Optional[str] = None
    category: Optional[str] = None
    trip_type: Optional[str] = None
    mood: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


class CommunityRecommendationRequest(BaseModel):
    destination: str
    theme: Optional[str] = ""
    preferences: Optional[str] = ""
    trip_type: Optional[str] = ""
    mood: Optional[str] = ""
    lat: Optional[float] = None
    lon: Optional[float] = None


router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("/")
def add_review(
    review: ReviewCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Add a new place review"""
    if not (1.0 <= review.rating <= 5.0):
        raise HTTPException(status_code=400, detail="Rating must be between 1.0 and 5.0")

    try:
        new_review = ReviewService.add_review(db, user_id, review.dict())
        return {
            "message": "Review added successfully",
            "review_id": new_review.id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add review: {str(e)}")


@router.get("/{destination}")
def get_reviews_by_destination(
    destination: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get all reviews for a destination"""
    try:
        reviews = ReviewService.get_reviews_by_destination(db, destination)
        return {
            "reviews": [
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "place_name": r.place_name,
                    "rating": float(r.rating),
                    "review": r.review,
                    "category": r.category,
                    "trip_type": r.trip_type,
                    "mood": r.mood,
                    "lat": float(r.lat) if r.lat else None,
                    "lon": float(r.lon) if r.lon else None,
                    "created_at": r.created_at.isoformat()
                }
                for r in reviews
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reviews: {str(e)}")


@router.post("/community-recommendations")
def get_community_recommendations(
    request: CommunityRecommendationRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get community-driven place recommendations"""
    try:
        recommendations = CommunityRecommendationService.get_community_recommendations(
            db=db,
            destination=request.destination,
            theme=request.theme,
            preferences=request.preferences,
            user_lat=request.lat,
            user_lon=request.lon,
            trip_type=request.trip_type,
            mood=request.mood
        )
        return {"suggestions": recommendations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")