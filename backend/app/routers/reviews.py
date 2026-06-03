"""
API routes for place and hotel reviews, community recommendations, media uploads, and moderation.
"""
import os
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.review_service import ReviewService
from app.services.community_recommendation_service import CommunityRecommendationService
from app.routers.auth import get_current_user_id
from app.models import User, ReviewReport
from pydantic import BaseModel
from typing import Optional, List


# --- SCHEMAS ---

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
    
    # New place review columns
    review_title: Optional[str] = None
    additional_notes: Optional[str] = None
    would_visit_again: Optional[bool] = None
    traveler_type: Optional[str] = None
    
    # Subcategory ratings
    rating_safety: Optional[int] = None
    rating_cleanliness: Optional[int] = None
    rating_crowd: Optional[int] = None
    rating_accessibility: Optional[int] = None
    rating_scenic: Optional[int] = None
    rating_family: Optional[int] = None
    rating_food: Optional[int] = None
    rating_transport: Optional[int] = None
    rating_value: Optional[int] = None


class HotelReviewCreate(BaseModel):
    hotel_name: str
    hotel_id: Optional[int] = None
    rating: float
    review_title: Optional[str] = None
    review_text: Optional[str] = None
    additional_notes: Optional[str] = None
    would_recommend: Optional[bool] = None
    stay_date: Optional[str] = None
    traveler_type: Optional[str] = None
    trip_purpose: Optional[str] = None
    
    # Subcategory ratings
    rating_cleanliness: Optional[int] = None
    rating_staff: Optional[int] = None
    rating_comfort: Optional[int] = None
    rating_food: Optional[int] = None
    rating_value: Optional[int] = None
    rating_location: Optional[int] = None
    rating_amenities: Optional[int] = None
    rating_safety: Optional[int] = None
    rating_checkin: Optional[int] = None
    rating_wifi: Optional[int] = None


class ReviewUpdate(BaseModel):
    rating: Optional[float] = None
    review_title: Optional[str] = None
    review_text: Optional[str] = None  # maps to review for place
    review: Optional[str] = None       # maps to review for place
    additional_notes: Optional[str] = None
    would_recommend: Optional[bool] = None
    would_visit_again: Optional[bool] = None
    stay_date: Optional[str] = None
    traveler_type: Optional[str] = None
    trip_purpose: Optional[str] = None
    
    # Subcategory ratings
    rating_safety: Optional[int] = None
    rating_cleanliness: Optional[int] = None
    rating_crowd: Optional[int] = None
    rating_accessibility: Optional[int] = None
    rating_scenic: Optional[int] = None
    rating_family: Optional[int] = None
    rating_food: Optional[int] = None
    rating_transport: Optional[int] = None
    rating_value: Optional[int] = None
    rating_staff: Optional[int] = None
    rating_comfort: Optional[int] = None
    rating_location: Optional[int] = None
    rating_amenities: Optional[int] = None
    rating_checkin: Optional[int] = None
    rating_wifi: Optional[int] = None


class ReportCreate(BaseModel):
    reason: str
    details: Optional[str] = None


class ReportResolveRequest(BaseModel):
    action: str  # "delete" or "dismiss"


class CommunityRecommendationRequest(BaseModel):
    destination: str
    theme: Optional[str] = ""
    preferences: Optional[str] = ""
    trip_type: Optional[str] = ""
    mood: Optional[str] = ""
    lat: Optional[float] = None
    lon: Optional[float] = None


router = APIRouter(prefix="/reviews", tags=["Reviews"])


# --- ADMIN VERIFICATION HELPER ---

def verify_admin_status(user_id: int, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not getattr(user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin credentials required for this operation"
        )
    return user


# --- REVIEW SUBMISSION ROUTES ---

@router.post("/")
def add_review(
    review: ReviewCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Add a new place review (backward-compatible endpoint)"""
    if not (1.0 <= review.rating <= 5.0):
        raise HTTPException(status_code=400, detail="Rating must be between 1.0 and 5.0")

    try:
        new_review = ReviewService.add_place_review(db, user_id, review.dict())
        return {
            "message": "Review added successfully",
            "review_id": new_review.id,
            "verified_status": new_review.verified_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add review: {str(e)}")


@router.post("/place")
def add_place_review(
    review: ReviewCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Add a new place review"""
    if not (1.0 <= review.rating <= 5.0):
        raise HTTPException(status_code=400, detail="Rating must be between 1.0 and 5.0")

    try:
        new_review = ReviewService.add_place_review(db, user_id, review.dict())
        return {
            "message": "Place review submitted successfully",
            "review_id": new_review.id,
            "verified_status": new_review.verified_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add place review: {str(e)}")


@router.post("/hotel")
def add_hotel_review(
    review: HotelReviewCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Add a new hotel review"""
    if not (1.0 <= review.rating <= 5.0):
        raise HTTPException(status_code=400, detail="Rating must be between 1.0 and 5.0")

    try:
        new_review = ReviewService.add_hotel_review(db, user_id, review.dict())
        return {
            "message": "Hotel review submitted successfully",
            "review_id": new_review.id,
            "verified_status": new_review.verified_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add hotel review: {str(e)}")


# --- FETCH REVIEWS BY PLACE/HOTEL NAME ---

@router.get("/place/search/{place_name}")
def get_place_reviews(
    place_name: str,
    traveler_type: Optional[str] = Query(None),
    verified_only: bool = Query(False),
    with_photos: bool = Query(False),
    with_videos: bool = Query(False),
    sort_by: str = Query("latest"),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get all detailed reviews for a tourist place"""
    try:
        filters = {
            "traveler_type": traveler_type,
            "verified_only": verified_only,
            "with_photos": with_photos,
            "with_videos": with_videos,
            "sort_by": sort_by
        }
        reviews = ReviewService.get_place_reviews(db, place_name, filters)
        return {"reviews": reviews}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch place reviews: {str(e)}")


@router.get("/hotel/search/{hotel_name}")
def get_hotel_reviews(
    hotel_name: str,
    traveler_type: Optional[str] = Query(None),
    verified_only: bool = Query(False),
    with_photos: bool = Query(False),
    with_videos: bool = Query(False),
    sort_by: str = Query("latest"),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get all detailed reviews for a hotel"""
    try:
        filters = {
            "traveler_type": traveler_type,
            "verified_only": verified_only,
            "with_photos": with_photos,
            "with_videos": with_videos,
            "sort_by": sort_by
        }
        reviews = ReviewService.get_hotel_reviews(db, hotel_name, filters)
        return {"reviews": reviews}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch hotel reviews: {str(e)}")


# --- EDIT / DELETE OWN REVIEWS ---

@router.put("/{review_type}/{review_id}")
def update_review(
    review_type: str,
    review_id: int,
    update_data: ReviewUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Update a review written by the current user"""
    if review_type not in ["hotel", "place"]:
        raise HTTPException(status_code=400, detail="Invalid review type")

    try:
        updated = ReviewService.update_review(db, user_id, review_type, review_id, update_data.dict(exclude_unset=True))
        return {"message": "Review updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{review_type}/{review_id}")
def delete_review(
    review_type: str,
    review_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Delete a review written by the current user or by admin"""
    if review_type not in ["hotel", "place"]:
        raise HTTPException(status_code=400, detail="Invalid review type")

    try:
        # Check if user is admin
        user = db.query(User).filter(User.id == user_id).first()
        is_admin = getattr(user, "is_admin", False) if user else False
        
        ReviewService.delete_review(db, user_id, review_type, review_id, is_admin=is_admin)
        return {"message": "Review deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# --- HELPUL LIKES & REPORTING ---

@router.post("/{review_type}/{review_id}/like")
def like_review(
    review_type: str,
    review_id: int,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Toggle marking a review as helpful"""
    if review_type not in ["hotel", "place"]:
        raise HTTPException(status_code=400, detail="Invalid review type")

    try:
        result = ReviewService.like_review(db, user_id, review_type, review_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{review_type}/{review_id}/report")
def report_review(
    review_type: str,
    review_id: int,
    report: ReportCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Report a review for moderation"""
    if review_type not in ["hotel", "place"]:
        raise HTTPException(status_code=400, detail="Invalid review type")

    try:
        new_report = ReviewService.report_review(db, user_id, review_type, review_id, report.reason, report.details)
        return {"message": "Review reported successfully", "report_id": new_report.id}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# --- MEDIA UPLOAD ---

@router.post("/{review_type}/{review_id}/media")
def upload_review_media(
    review_type: str,
    review_id: int,
    files: List[UploadFile] = File(...),
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """Upload photos and short videos for a review"""
    if review_type not in ["hotel", "place"]:
        raise HTTPException(status_code=400, detail="Invalid review type")

    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    saved_media = []

    for file in files:
        content_type = file.content_type or ""
        media_type = "video" if "video" in content_type else "image"
        
        file_ext = os.path.splitext(file.filename)[1] or (".mp4" if media_type == "video" else ".jpg")
        unique_name = f"{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(upload_dir, unique_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_url = f"/uploads/{unique_name}"
        media_rec = ReviewService.add_review_media(db, review_type, review_id, media_type, file_url)
        saved_media.append({
            "id": media_rec.id,
            "media_type": media_rec.media_type,
            "file_url": media_rec.file_url
        })
        
    return {"message": "Media uploaded successfully", "media": saved_media}


# --- REVIEW ANALYTICS & AI SUMMARIES ---

@router.get("/place/{place_name}/analytics")
def get_place_analytics(
    place_name: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Fetch breakdown averages and recommendations for a tourist place"""
    try:
        analytics = ReviewService.get_review_analytics(db, "place", place_name)
        return analytics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hotel/{hotel_name}/analytics")
def get_hotel_analytics(
    hotel_name: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Fetch breakdown averages and recommendation percentages for a hotel"""
    try:
        analytics = ReviewService.get_review_analytics(db, "hotel", hotel_name)
        return analytics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{review_type}/{item_name}/ai-summary")
def get_ai_summary(
    review_type: str,
    item_name: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Retrieve Gemini-powered AI summary of reviews"""
    if review_type not in ["hotel", "place"]:
        raise HTTPException(status_code=400, detail="Invalid review type")

    try:
        summary = ReviewService.get_ai_summary(db, review_type, item_name)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- ADMIN CONTROL ENDPOINTS ---

@router.get("/admin/reports")
def get_reported_reviews(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """View flagged reviews (Admin only)"""
    verify_admin_status(user_id, db)
    
    reports = db.query(ReviewReport).filter(ReviewReport.status == "pending").all()
    formatted = []
    
    for r in reports:
        reporter = db.query(User).filter(User.id == r.user_id).first()
        reporter_name = reporter.username if reporter else "Anonymous"
        
        # Get target review details
        review_title = ""
        review_text = ""
        author_name = "Unknown"
        
        if r.review_type == "hotel":
            rev = db.query(User).filter(User.id == r.user_id).first() # fallback author check
            hotel_rev = db.query(User).join(User.hotel_reviews).filter(User.hotel_reviews.property.mapper.class_.id == r.review_id).first()
            # Let's query properly
            from app.models import HotelReview
            actual_rev = db.query(HotelReview).filter(HotelReview.id == r.review_id).first()
            if actual_rev:
                review_title = actual_rev.review_title
                review_text = actual_rev.review_text
                author = db.query(User).filter(User.id == actual_rev.user_id).first()
                author_name = author.username if author else "Anonymous"
        else:
            from app.models import PlaceReview
            actual_rev = db.query(PlaceReview).filter(PlaceReview.id == r.review_id).first()
            if actual_rev:
                review_title = actual_rev.review_title
                review_text = actual_rev.review
                author = db.query(User).filter(User.id == actual_rev.user_id).first()
                author_name = author.username if author else "Anonymous"
                
        formatted.append({
            "id": r.id,
            "review_type": r.review_type,
            "review_id": r.review_id,
            "reporter_username": reporter_name,
            "reason": r.reason,
            "details": r.details,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "review_title": review_title,
            "review_text": review_text,
            "author_username": author_name
        })
        
    return {"reports": formatted}


@router.post("/admin/reports/{report_id}/resolve")
def resolve_reported_review(
    report_id: int,
    action_req: ReportResolveRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Resolve review report: 'delete' target review or 'dismiss' the report (Admin only)"""
    verify_admin_status(user_id, db)
    
    report = db.query(ReviewReport).filter(ReviewReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    if action_req.action == "delete":
        try:
            # Delete review using service (with admin override flag)
            ReviewService.delete_review(db, user_id, report.review_type, report.review_id, is_admin=True)
            report.status = "resolved"
            db.commit()
            return {"message": "Review deleted and report resolved"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete review: {str(e)}")
            
    elif action_req.action == "dismiss":
        report.status = "dismissed"
        db.commit()
        return {"message": "Report dismissed"}
        
    else:
        raise HTTPException(status_code=400, detail="Invalid resolve action. Must be 'delete' or 'dismiss'")


# --- COMMUNITY RECOMMENDATION ENDPOINTS ---

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


# --- LEGACY RETRIEVAL BY DESTINATION ---

@router.get("/{destination}")
def get_reviews_by_destination(
    destination: str,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    """Get all reviews for a destination (legacy compatibility endpoint)"""
    try:
        reviews = ReviewService.get_reviews_by_destination(db, destination)
        return {
            "reviews": [
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "place_name": r.place_name,
                    "rating": float(r.rating) if r.rating else 0.0,
                    "review": r.review,
                    "category": r.category,
                    "trip_type": r.trip_type,
                    "mood": r.mood,
                    "lat": float(r.lat) if r.lat else None,
                    "lon": float(r.lon) if r.lon else None,
                    "created_at": r.created_at.isoformat() if r.created_at else None
                }
                for r in reviews
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reviews: {str(e)}")