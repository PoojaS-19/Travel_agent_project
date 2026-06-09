"""
Example service showing how to interact with SQLAlchemy models
"""
from sqlalchemy.orm import Session
from app.models import User, Flight, Itinerary, Train, SearchHistory, SearchType
from datetime import datetime


class UserService:
    """User database operations"""
    
    @staticmethod
    def create_user(db: Session, username: str, email: str, password_hash: str):
        """Create a new user"""
        user = User(username=username, email=email, password_hash=password_hash)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def get_user_by_email(db: Session, email: str):
        """Get user by email"""
        return db.query(User).filter(User.email == email).first()
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: int):
        """Get user by ID"""
        return db.query(User).filter(User.id == user_id).first()


class FlightService:
    """Flight database operations"""
    
    @staticmethod
    def create_flight(db: Session, airline: str, price: float, departure: datetime, 
                     arrival: datetime, source: str, destination: str, api_response=None):
        """Create a new flight record"""
        flight = Flight(
            airline=airline,
            price=price,
            departure=departure,
            arrival=arrival,
            source=source,
            destination=destination,
            api_response=api_response
        )
        db.add(flight)
        db.commit()
        db.refresh(flight)
        return flight
    
    @staticmethod
    def search_flights(db: Session, source: str, destination: str):
        """Search flights by source and destination"""
        return db.query(Flight).filter(
            Flight.source == source,
            Flight.destination == destination
        ).all()


class TrainService:
    """Train database operations"""
    
    @staticmethod
    def create_train(db: Session, train_number: str, name: str, source: str, 
                    destination: str, departure, arrival, duration: str, train_type: str):
        """Create a new train record"""
        train = Train(
            train_number=train_number,
            name=name,
            source=source,
            destination=destination,
            departure=departure,
            arrival=arrival,
            duration=duration,
            type=train_type
        )
        db.add(train)
        db.commit()
        db.refresh(train)
        return train
    
    @staticmethod
    def search_trains(db: Session, source: str, destination: str):
        """Search trains by source and destination"""
        return db.query(Train).filter(
            Train.source == source,
            Train.destination == destination
        ).all()


def normalize_daily_plans(daily_plans):
    """Normalize daily_plans list to ensure every activity has a status.
    First activity becomes current, remaining activities become upcoming.
    """
    if not isinstance(daily_plans, list):
        return daily_plans
    
    # Check if any activity in the entire itinerary has a status
    has_any_status = False
    for day in daily_plans:
        if isinstance(day, dict) and "activities" in day:
            activities = day["activities"]
            if isinstance(activities, list):
                for act in activities:
                    if isinstance(act, dict) and "status" in act:
                        has_any_status = True
                        break
    
    first = True
    for day in daily_plans:
        if isinstance(day, dict) and "activities" in day:
            activities = day["activities"]
            if isinstance(activities, list):
                for act in activities:
                    if isinstance(act, dict):
                        if not has_any_status:
                            if first:
                                act["status"] = "current"
                                first = False
                            else:
                                act["status"] = "upcoming"
                        else:
                            if "status" not in act:
                                act["status"] = "upcoming"
    return daily_plans


class ItineraryService:
    """Itinerary database operations"""
    
    @staticmethod
    def create_itinerary(db: Session, user_id: int, start_city: str, destination: str,
                        itinerary_text: str, daily_plans: dict, language: str = "English", route_polyline: list = None):
        """Create a new itinerary"""
        normalized_plans = normalize_daily_plans(daily_plans)
        itinerary = Itinerary(
            user_id=user_id,
            start_city=start_city,
            destination=destination,
            itinerary_text=itinerary_text,
            daily_plans=normalized_plans,
            route_polyline=route_polyline,
            language=language
        )
        db.add(itinerary)
        db.commit()
        db.refresh(itinerary)
        return itinerary
    
    @staticmethod
    def get_user_itineraries(db: Session, user_id: int, limit: int = None):
        """Get all itineraries for a user"""
        query = db.query(Itinerary).filter(Itinerary.user_id == user_id).order_by(Itinerary.created_at.desc())
        if limit:
            query = query.limit(limit)
        return query.all()

    @staticmethod
    def get_user_itinerary(db: Session, user_id: int, itinerary_id: int):
        """Get one itinerary that belongs to a user"""
        return db.query(Itinerary).filter(
            Itinerary.id == itinerary_id,
            Itinerary.user_id == user_id
        ).first()

    @staticmethod
    def update_itinerary(db: Session, itinerary: Itinerary, updates: dict):
        """Update an existing itinerary"""
        if "daily_plans" in updates:
            updates["daily_plans"] = normalize_daily_plans(updates["daily_plans"])
            
        for field, value in updates.items():
            setattr(itinerary, field, value)
        db.commit()
        db.refresh(itinerary)
        return itinerary

    @staticmethod
    def delete_itinerary(db: Session, itinerary: Itinerary):
        """Delete an itinerary"""
        db.delete(itinerary)
        db.commit()


class SearchHistoryService:
    """Search history database operations"""
    
    @staticmethod
    def log_search(db: Session, user_id: int, search_type: str, query: dict, results_count: int):
        """Log a search"""
        search = SearchHistory(
            user_id=user_id,
            search_type=search_type,
            query=query,
            results_count=results_count
        )
        db.add(search)
        db.commit()
        db.refresh(search)
        return search
    
    @staticmethod
    def get_user_search_history(db: Session, user_id: int, limit: int = 10):
        """Get user's search history"""
        return db.query(SearchHistory).filter(
            SearchHistory.user_id == user_id
        ).order_by(SearchHistory.searched_at.desc()).limit(limit).all()
