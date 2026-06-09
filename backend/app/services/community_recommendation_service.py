"""
Service for generating community-driven place recommendations.
"""
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.services.review_service import ReviewService
import math


class CommunityRecommendationService:
    """Service for community-based place recommendations"""

    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points in km using Haversine formula"""
        if not all([lat1, lon1, lat2, lon2]):
            return float('inf')

        R = 6371  # Earth's radius in km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        return R * c

    @staticmethod
    def get_community_recommendations(
        db: Session,
        destination: str,
        theme: str = "",
        preferences: str = "",
        user_lat: float = None,
        user_lon: float = None,
        trip_type: str = "",
        mood: str = "",
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Generate community recommendations based on reviews and user preferences"""

        # Get top places for the destination
        top_places = ReviewService.get_top_places(db, destination, limit=50)

        if not top_places:
            return []

        recommendations = []

        for place in top_places:
            score = place["rating"] * 0.4  # Base score from rating

            # Trip type match bonus
            trip_type_match = 1.0 if not trip_type or place.get("trip_type") == trip_type else 0.5
            score += trip_type_match * 0.2

            # Mood match bonus
            mood_match = 1.0 if not mood or place.get("mood") == mood else 0.5
            score += mood_match * 0.2

            # Popularity bonus (based on review count)
            popularity = min(place["review_count"] / 10, 1.0)  # Cap at 10 reviews
            score += popularity * 0.2

            # Distance calculation (prefer nearby places)
            distance = float('inf')
            if user_lat and user_lon and place["lat"] and place["lon"]:
                distance = CommunityRecommendationService.calculate_distance(
                    user_lat, user_lon, place["lat"], place["lon"]
                )

            place["score"] = score
            place["distance"] = distance
            recommendations.append(place)

        # Sort by score (descending), then by distance (ascending)
        recommendations.sort(key=lambda x: (-x["score"], x["distance"]))

        # Take top recommendations
        top_recs = recommendations[:limit]

        # Format for output
        formatted_recs = []
        for rec in top_recs:
            reason_parts = []
            if rec["rating"] >= 4.5:
                reason_parts.append("Highly rated by community")
            elif rec["rating"] >= 4.0:
                reason_parts.append("Well-rated by travelers")

            if rec["review_count"] > 5:
                reason_parts.append("Popular choice")

            if rec["distance"] < float('inf'):
                if rec["distance"] < 1:
                    distance_str = "Less than 1 km away"
                elif rec["distance"] < 5:
                    distance_str = f"{rec['distance']:.1f} km away"
                else:
                    distance_str = f"{rec['distance']:.1f} km away"
            else:
                distance_str = "Distance unknown"

            formatted_recs.append({
                "place_name": rec["place_name"],
                "rating": round(rec["rating"], 1),
                "reason": " • ".join(reason_parts) if reason_parts else "Community recommended",
                "distance": distance_str,
                "lat": rec["lat"],
                "lon": rec["lon"],
                "category": rec.get("category", "Attraction"),
                "photo_url": rec.get("photo_url")
            })

        return formatted_recs