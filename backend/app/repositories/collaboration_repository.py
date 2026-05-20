from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models import User
from app.models.collaboration import (
    InvitationStatus,
    SuggestionComment,
    SuggestionReaction,
    SuggestionVote,
    TripCollaborator,
    TripInvitation,
    TripNotification,
    TripSuggestion,
    SuggestionType,
)
from app.models.models import Itinerary


class CollaborationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_trip(self, trip_id: int) -> Optional[Itinerary]:
        return self.db.query(Itinerary).filter(Itinerary.id == trip_id).first()

    def get_user(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(func.lower(User.email) == email.lower()).first()

    def get_collaborator(self, trip_id: int, user_id: int) -> Optional[TripCollaborator]:
        return (
            self.db.query(TripCollaborator)
            .filter(TripCollaborator.trip_id == trip_id, TripCollaborator.user_id == user_id)
            .first()
        )

    def list_collaborators(self, trip_id: int):
        return (
            self.db.query(TripCollaborator)
            .options(joinedload(TripCollaborator.user))
            .filter(TripCollaborator.trip_id == trip_id)
            .order_by(TripCollaborator.joined_at.asc())
            .all()
        )

    def get_invitation_by_hash(self, token_hash: str) -> Optional[TripInvitation]:
        return self.db.query(TripInvitation).filter(TripInvitation.token_hash == token_hash).first()

    def get_pending_invitation(self, trip_id: int, email: str) -> Optional[TripInvitation]:
        return (
            self.db.query(TripInvitation)
            .filter(
                TripInvitation.trip_id == trip_id,
                func.lower(TripInvitation.email) == email.lower(),
                TripInvitation.status == InvitationStatus.PENDING,
            )
            .order_by(TripInvitation.created_at.desc())
            .first()
        )

    def list_pending_invitations(self, trip_id: int):
        return (
            self.db.query(TripInvitation)
            .filter(
                TripInvitation.trip_id == trip_id,
                TripInvitation.status == InvitationStatus.PENDING,
                TripInvitation.expires_at > datetime.utcnow(),
            )
            .order_by(TripInvitation.created_at.desc())
            .all()
        )

    def get_invitation(self, trip_id: int, invitation_id: int) -> Optional[TripInvitation]:
        return (
            self.db.query(TripInvitation)
            .filter(TripInvitation.trip_id == trip_id, TripInvitation.id == invitation_id)
            .first()
        )

    def get_suggestion(self, suggestion_id: int) -> Optional[TripSuggestion]:
        return self.db.query(TripSuggestion).filter(TripSuggestion.id == suggestion_id).first()

    def list_suggestions(self, trip_id: int, suggestion_type: Optional[str], page: int, page_size: int):
        query = self.db.query(TripSuggestion).filter(TripSuggestion.trip_id == trip_id)
        if suggestion_type:
            query = query.filter(TripSuggestion.suggestion_type == SuggestionType(suggestion_type))
        total = query.count()
        items = (
            query.order_by(TripSuggestion.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def get_vote(self, suggestion_id: int, user_id: int) -> Optional[SuggestionVote]:
        return (
            self.db.query(SuggestionVote)
            .filter(SuggestionVote.suggestion_id == suggestion_id, SuggestionVote.user_id == user_id)
            .first()
        )

    def get_reaction(self, suggestion_id: int, user_id: int, emoji: str) -> Optional[SuggestionReaction]:
        return (
            self.db.query(SuggestionReaction)
            .filter(
                SuggestionReaction.suggestion_id == suggestion_id,
                SuggestionReaction.user_id == user_id,
                SuggestionReaction.emoji == emoji,
            )
            .first()
        )

    def list_comments(self, suggestion_id: int, page: int, page_size: int):
        query = (
            self.db.query(SuggestionComment)
            .options(joinedload(SuggestionComment.user))
            .filter(SuggestionComment.suggestion_id == suggestion_id)
        )
        total = query.count()
        items = (
            query.order_by(SuggestionComment.created_at.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def list_notifications(self, user_id: int, page: int, page_size: int, unread_only: bool):
        query = self.db.query(TripNotification).filter(TripNotification.recipient_user_id == user_id)
        if unread_only:
            query = query.filter(TripNotification.read_at.is_(None))
        total = query.count()
        items = (
            query.order_by(TripNotification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def unread_count(self, user_id: int, trip_id: Optional[int] = None) -> int:
        query = self.db.query(TripNotification).filter(
            TripNotification.recipient_user_id == user_id,
            TripNotification.read_at.is_(None),
        )
        if trip_id:
            query = query.filter(TripNotification.trip_id == trip_id)
        return query.count()
