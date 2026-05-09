"""
Recommendation service for personalized itinerary suggestions based on user history.
"""
from sqlalchemy.orm import Session
from app.services.database_service import ItineraryService, SearchHistoryService
from app.services.gemini import get_gemini_response
from app.services.prompts import RECOMMENDATION_INFERENCE_PROMPT, RECOMMENDATION_GENERATION_PROMPT
import json


class RecommendationService:
    """Service for generating personalized recommendations"""

    @staticmethod
    def get_user_history(db: Session, user_id: int, limit: int = 10):
        """Fetch user's recent itineraries and search history"""
        itineraries = ItineraryService.get_user_itineraries(db, user_id, limit)
        searches = SearchHistoryService.get_user_search_history(db, user_id, limit)

        history = {
            "itineraries": [
                {
                    "start_city": it.start_city,
                    "destination": it.destination,
                    "itinerary_text": it.itinerary_text,
                    "created_at": it.created_at.isoformat()
                } for it in itineraries
            ],
            "searches": [
                {
                    "search_type": s.search_type,
                    "query": s.query,
                    "searched_at": s.searched_at.isoformat()
                } for s in searches
            ]
        }
        return history

    @staticmethod
    def infer_user_preferences(history: dict) -> str:
        """Analyze user history to infer preferences using Gemini"""
        if not history["itineraries"] and not history["searches"]:
            return "No clear preferences identified from history."

        prompt = RECOMMENDATION_INFERENCE_PROMPT.format(
            itineraries=json.dumps(history["itineraries"], indent=2),
            searches=json.dumps(history["searches"], indent=2)
        )

        try:
            response = get_gemini_response(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Error inferring preferences: {e}")
            return "Unable to analyze preferences."

    @staticmethod
    def generate_recommendations(preferences: str, language: str = "English") -> list:
        """Generate personalized itinerary recommendations based on preferences"""
        if "No clear preferences" in preferences or "Unable to analyze" in preferences:
            return []

        prompt = RECOMMENDATION_GENERATION_PROMPT.format(
            preferences=preferences,
            language=language
        )

        try:
            response = get_gemini_response(prompt)
            result = json.loads(response.text.strip())
            return result.get("recommendations", [])
        except Exception as e:
            print(f"Error generating recommendations: {e}")
            return []

    @staticmethod
    def generic_recommendations(language: str = "English") -> list:
        """Return generic fallback recommendations when personalized data is unavailable"""
        return [
            {
                "title": "Coastal Escape to Goa",
                "destination": "Goa, India",
                "theme": "Beach relaxation and local seafood",
                "reason": "Perfect for travelers who enjoy beaches, water sports, and relaxed coastal vibes.",
                "suggested_duration": "3-4 days"
            },
            {
                "title": "Cultural Delhi and Agra Tour",
                "destination": "Delhi & Agra, India",
                "theme": "History, markets, and iconic landmarks",
                "reason": "Great for first-time visitors who love heritage sites, local cuisine, and immersive city experiences.",
                "suggested_duration": "4-5 days"
            },
            {
                "title": "Hillside Retreat in Lonavala",
                "destination": "Lonavala, India",
                "theme": "Nature, tranquility, and scenic viewpoints",
                "reason": "Ideal for travelers seeking a refreshing hill station getaway with waterfalls and greenery.",
                "suggested_duration": "2-3 days"
            }
        ]

    @staticmethod
    def get_personalized_recommendations(db: Session, user_id: int, language: str = "English") -> list:
        """Main method to get personalized recommendations for a user"""
        if user_id is None:
            return RecommendationService.generic_recommendations(language)

        history = RecommendationService.get_user_history(db, user_id)
        preferences = RecommendationService.infer_user_preferences(history)
        recommendations = RecommendationService.generate_recommendations(preferences, language)
        if not recommendations:
            return RecommendationService.generic_recommendations(language)
        return recommendations