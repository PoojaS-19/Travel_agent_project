import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    DECIMAL,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


class CollaboratorRole(str, enum.Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"
    FOLLOWER = "follower"


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"


class SuggestionType(str, enum.Enum):
    DESTINATION = "destination"
    HOTEL = "hotel"
    RESTAURANT = "restaurant"
    ACTIVITY = "activity"


class VoteValue(str, enum.Enum):
    UP = "up"
    DOWN = "down"


class NotificationType(str, enum.Enum):
    INVITE_ACCEPTED = "invite_accepted"
    NEW_VOTE = "new_vote"
    NEW_SUGGESTION = "new_suggestion"
    COMMENT_REPLY = "comment_reply"
    TRIP_FINALIZED = "trip_finalized"


class TripCollaborator(Base):
    __tablename__ = "trip_collaborators"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(CollaboratorRole), nullable=False, default=CollaboratorRole.EDITOR)
    invited_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    voting_locked = Column(Boolean, nullable=False, default=False)
    finalized_at = Column(DateTime, nullable=True)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    trip = relationship("Itinerary", back_populates="collaborators")
    user = relationship("User", foreign_keys=[user_id], back_populates="trip_collaborations")
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])

    __table_args__ = (
        UniqueConstraint("trip_id", "user_id", name="uq_trip_collaborator_user"),
        Index("ix_trip_collaborators_trip_role", "trip_id", "role"),
    )


class TripInvitation(Base):
    __tablename__ = "trip_invitations"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    role = Column(Enum(CollaboratorRole), nullable=False, default=CollaboratorRole.EDITOR)
    token_hash = Column(String(128), unique=True, nullable=False)
    token = Column(String(255), nullable=True)
    otp_code = Column(String(6), nullable=True)
    status = Column(Enum(InvitationStatus), nullable=False, default=InvitationStatus.PENDING)
    invited_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    accepted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    trip = relationship("Itinerary", back_populates="invitations")
    invited_by = relationship("User", foreign_keys=[invited_by_user_id])
    accepted_by = relationship("User", foreign_keys=[accepted_by_user_id])

    __table_args__ = (
        Index("ix_trip_invitations_trip_email", "trip_id", "email"),
        Index("ix_trip_invitations_status_expires", "status", "expires_at"),
    )


class TripSuggestion(Base):
    __tablename__ = "trip_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    suggestion_type = Column(Enum(SuggestionType), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String(1000), nullable=True)
    estimated_cost = Column(DECIMAL(10, 2), nullable=True)
    location = Column(String(255), nullable=True)
    tags = Column(JSON, nullable=True)
    external_ref = Column(JSON, nullable=True)
    is_finalized = Column(Boolean, nullable=False, default=False)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    trip = relationship("Itinerary", back_populates="suggestions")
    created_by = relationship("User", back_populates="trip_suggestions")
    votes = relationship("SuggestionVote", back_populates="suggestion", cascade="all, delete-orphan")
    reactions = relationship("SuggestionReaction", back_populates="suggestion", cascade="all, delete-orphan")
    comments = relationship("SuggestionComment", back_populates="suggestion", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_trip_suggestions_trip_type_created", "trip_id", "suggestion_type", "created_at"),
        Index("ix_trip_suggestions_trip_finalized", "trip_id", "is_finalized"),
    )


class SuggestionVote(Base):
    __tablename__ = "suggestion_votes"

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(Integer, ForeignKey("trip_suggestions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    vote_value = Column(Enum(VoteValue), nullable=True)
    ranking = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    suggestion = relationship("TripSuggestion", back_populates="votes")
    user = relationship("User", back_populates="suggestion_votes")

    __table_args__ = (
        UniqueConstraint("suggestion_id", "user_id", name="uq_suggestion_vote_user"),
        Index("ix_suggestion_votes_value", "suggestion_id", "vote_value"),
        Index("ix_suggestion_votes_ranking", "suggestion_id", "ranking"),
    )


class SuggestionReaction(Base):
    __tablename__ = "suggestion_reactions"

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(Integer, ForeignKey("trip_suggestions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    emoji = Column(String(16), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    suggestion = relationship("TripSuggestion", back_populates="reactions")
    user = relationship("User", back_populates="suggestion_reactions")

    __table_args__ = (
        UniqueConstraint("suggestion_id", "user_id", "emoji", name="uq_suggestion_reaction_user_emoji"),
        Index("ix_suggestion_reactions_emoji", "suggestion_id", "emoji"),
    )


class SuggestionComment(Base):
    __tablename__ = "suggestion_comments"

    id = Column(Integer, primary_key=True, index=True)
    suggestion_id = Column(Integer, ForeignKey("trip_suggestions.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("suggestion_comments.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    suggestion = relationship("TripSuggestion", back_populates="comments")
    user = relationship("User", back_populates="suggestion_comments")
    parent = relationship("SuggestionComment", remote_side=[id], back_populates="replies")
    replies = relationship("SuggestionComment", back_populates="parent", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_suggestion_comments_suggestion_created", "suggestion_id", "created_at"),
        Index("ix_suggestion_comments_parent", "parent_id"),
    )


class TripNotification(Base):
    __tablename__ = "trip_notifications"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    recipient_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notification_type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(String(1000), nullable=True)
    payload = Column(JSON, nullable=True)
    emailed_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    trip = relationship("Itinerary", back_populates="notifications")
    recipient = relationship("User", foreign_keys=[recipient_user_id], back_populates="trip_notifications")
    actor = relationship("User", foreign_keys=[actor_user_id])

    __table_args__ = (
        Index("ix_trip_notifications_recipient_read", "recipient_user_id", "read_at"),
        Index("ix_trip_notifications_trip_created", "trip_id", "created_at"),
    )


class TripExpense(Base):
    __tablename__ = "trip_expenses"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    place_name = Column(String(200), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    trip = relationship("Itinerary")
    user = relationship("User")


class TripVisit(Base):
    __tablename__ = "trip_visits"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    place_name = Column(String(200), nullable=False)
    status = Column(String(20), nullable=False)  # "arrived" or "left"
    arrived_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    left_at = Column(DateTime, nullable=True)
    prompt_sent = Column(Boolean, default=False, nullable=False)

    trip = relationship("Itinerary")


class LeaderLocation(Base):
    __tablename__ = "leader_locations"

    trip_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), primary_key=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    trip = relationship("Itinerary")


class MemberLocation(Base):
    __tablename__ = "member_locations"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_sharing = Column(Boolean, default=True, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    trip = relationship("Itinerary")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("trip_id", "user_id", name="uq_member_location_user"),
        Index("ix_member_locations_trip_user", "trip_id", "user_id"),
    )


class TripChatMessage(Base):
    __tablename__ = "trip_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    message_type = Column(String(50), default="text", nullable=False)  # "text", "system", "announcement"
    message_uuid = Column(String(36), unique=True, index=True, nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    message_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    trip = relationship("Itinerary")
    user = relationship("User")

    __table_args__ = (
        Index("ix_trip_chat_messages_trip_created", "trip_id", "created_at"),
    )


