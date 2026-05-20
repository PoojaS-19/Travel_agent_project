from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, JSON, ForeignKey, DECIMAL, TIME
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    itineraries = relationship("Itinerary", back_populates="user", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreference", back_populates="user", cascade="all, delete-orphan")
    search_history = relationship("SearchHistory", back_populates="user", cascade="all, delete-orphan")
    trip_collaborations = relationship("TripCollaborator", foreign_keys="TripCollaborator.user_id", back_populates="user", cascade="all, delete-orphan")
    trip_suggestions = relationship("TripSuggestion", back_populates="created_by")
    suggestion_votes = relationship("SuggestionVote", back_populates="user", cascade="all, delete-orphan")
    suggestion_reactions = relationship("SuggestionReaction", back_populates="user", cascade="all, delete-orphan")
    suggestion_comments = relationship("SuggestionComment", back_populates="user", cascade="all, delete-orphan")
    trip_notifications = relationship("TripNotification", foreign_keys="TripNotification.recipient_user_id", back_populates="recipient", cascade="all, delete-orphan")


class Flight(Base):
    __tablename__ = "flights"

    id = Column(Integer, primary_key=True, index=True)
    airline = Column(String(10), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    departure = Column(DateTime, nullable=False)
    arrival = Column(DateTime, nullable=False)
    source = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    api_response = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Index hint: source, destination


class TrainType(str, enum.Enum):
    Express = "Express"
    Passenger = "Passenger"
    Superfast = "Superfast"


class Train(Base):
    __tablename__ = "trains"

    id = Column(Integer, primary_key=True, index=True)
    train_number = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    source = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    departure = Column(TIME, nullable=False)
    arrival = Column(TIME, nullable=False)
    duration = Column(String(20), nullable=True)
    type = Column(Enum(TrainType), nullable=False)
    running_days = Column(JSON, nullable=True)  # {"MON": true, "TUE": false}
    created_at = Column(DateTime, default=datetime.utcnow)

    # Index hint: source, destination


class Hotel(Base):
    __tablename__ = "hotels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(String(300), nullable=True)
    rating = Column(DECIMAL(2, 1), nullable=True)
    price_level = Column(Integer, nullable=True)  # 1-4
    lat = Column(DECIMAL(10, 8), nullable=True)
    lon = Column(DECIMAL(11, 8), nullable=True)
    api_response = Column(JSON, nullable=True)
    city = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Index hint: city


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(String(300), nullable=True)
    rating = Column(DECIMAL(2, 1), nullable=True)
    price_level = Column(Integer, nullable=True)
    lat = Column(DECIMAL(10, 8), nullable=True)
    lon = Column(DECIMAL(11, 8), nullable=True)
    api_response = Column(JSON, nullable=True)
    city = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Index hint: city


class Itinerary(Base):
    __tablename__ = "itineraries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    start_city = Column(String(100), nullable=True)
    destination = Column(String(100), nullable=True)
    itinerary_text = Column(String(1000), nullable=True)
    daily_plans = Column(JSON, nullable=True)
    language = Column(String(20), default="English")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="itineraries")
    collaborators = relationship("TripCollaborator", back_populates="trip", cascade="all, delete-orphan")
    invitations = relationship("TripInvitation", back_populates="trip", cascade="all, delete-orphan")
    suggestions = relationship("TripSuggestion", back_populates="trip", cascade="all, delete-orphan")
    notifications = relationship("TripNotification", back_populates="trip", cascade="all, delete-orphan")

    # Index hint: user_id


class BookingStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


class BookingType(str, enum.Enum):
    FLIGHT = "flight"
    TRAIN = "train"
    HOTEL = "hotel"
    RESTAURANT = "restaurant"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(BookingType), nullable=False)
    item_id = Column(Integer, nullable=False)  # References flights.id, trains.id, etc.
    booking_date = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING)
    total_price = Column(DECIMAL(10, 2), nullable=True)

    # Relationships
    user = relationship("User", back_populates="bookings")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    preference_key = Column(String(50), nullable=False)  # e.g., 'favorite_destination'
    preference_value = Column(String(255), nullable=True)

    # Relationships
    user = relationship("User", back_populates="preferences")

    # Unique constraint: user_id + preference_key


class SearchType(str, enum.Enum):
    FLIGHT = "flight"
    TRAIN = "train"
    HOTEL = "hotel"
    RESTAURANT = "restaurant"


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    search_type = Column(Enum(SearchType), nullable=False)
    query = Column(JSON, nullable=True)  # {"source": "Delhi", "destination": "Mumbai"}
    results_count = Column(Integer, nullable=True)
    searched_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="search_history")

    # Index hint: user_id


class PlaceReview(Base):
    __tablename__ = "place_reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    place_name = Column(String(200), nullable=False)
    destination = Column(String(100), nullable=False)
    rating = Column(DECIMAL(2, 1), nullable=False)  # 1.0 to 5.0
    review = Column(String(1000), nullable=True)
    category = Column(String(50), nullable=True)
    trip_type = Column(String(50), nullable=True)  # e.g., "friends", "family"
    mood = Column(String(50), nullable=True)  # e.g., "chill", "adventure"
    lat = Column(DECIMAL(10, 8), nullable=True)
    lon = Column(DECIMAL(11, 8), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="place_reviews")

    # Index hint: destination, place_name


# Add to User model
User.place_reviews = relationship("PlaceReview", back_populates="user", cascade="all, delete-orphan")
