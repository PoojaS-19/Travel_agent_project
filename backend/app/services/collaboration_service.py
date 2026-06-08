import hashlib
import os
import secrets
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import User
from app.models.collaboration import (
    CollaboratorRole,
    InvitationStatus,
    NotificationType,
    SuggestionComment,
    SuggestionReaction,
    SuggestionType,
    SuggestionVote,
    TripCollaborator,
    TripInvitation,
    TripNotification,
    TripSuggestion,
    VoteValue,
    TripExpense,
    TripVisit,
    LeaderLocation,
    MemberLocation,
    TripChatMessage,
)
from app.models.collaboration_schemas import (
    CollaboratorResponse,
    DecisionItem,
    InvitationResponse,
    ReactionSummary,
    SuggestionResponse,
    VoteSummary,
)
from app.repositories.collaboration_repository import CollaborationRepository
from app.services.email_service import EmailService

# In-memory tracking of member presence states for GPS hysteresis.
# Key: (trip_id, user_id, place_name), Value: "arrived" | "left"
MEMBER_PRESENCE_STATES = {}


CLIENT_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
INVITE_EXPIRE_DAYS = 7


class CollaborationService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CollaborationRepository(db)

    @staticmethod
    def hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _role_value(role) -> str:
        return role.value if hasattr(role, "value") else str(role)

    def ensure_owner_membership(self, trip_id: int) -> TripCollaborator:
        trip = self.repo.get_trip(trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        if not trip.user_id:
            raise HTTPException(status_code=400, detail="Trip must have an owner before collaboration can be enabled")

        existing = self.repo.get_collaborator(trip_id, trip.user_id)
        if existing:
            if existing.role != CollaboratorRole.OWNER:
                existing.role = CollaboratorRole.OWNER
                self.db.commit()
                self.db.refresh(existing)
            return existing

        owner = TripCollaborator(trip_id=trip_id, user_id=trip.user_id, role=CollaboratorRole.OWNER)
        self.db.add(owner)
        self.db.commit()
        self.db.refresh(owner)
        return owner

    def require_member(self, trip_id: int, user_id: int) -> TripCollaborator:
        self.ensure_owner_membership(trip_id)
        collaborator = self.repo.get_collaborator(trip_id, user_id)
        if not collaborator:
            raise HTTPException(status_code=403, detail="You are not a collaborator on this trip")
        return collaborator

    def require_owner(self, trip_id: int, user_id: int) -> TripCollaborator:
        collaborator = self.require_member(trip_id, user_id)
        if collaborator.role != CollaboratorRole.OWNER:
            raise HTTPException(status_code=403, detail="Only the trip owner can perform this action")
        return collaborator

    def require_editor(self, trip_id: int, user_id: int) -> TripCollaborator:
        collaborator = self.require_member(trip_id, user_id)
        if collaborator.role not in (CollaboratorRole.OWNER, CollaboratorRole.EDITOR):
            raise HTTPException(status_code=403, detail="Viewer role is read-only")
        return collaborator

    def ensure_voting_open(self, trip_id: int, user_id: int) -> None:
        collaborator = self.require_editor(trip_id, user_id)
        owner = self.ensure_owner_membership(trip_id)
        if owner.voting_locked or owner.finalized_at:
            raise HTTPException(status_code=409, detail="Voting is locked for this trip")
        if collaborator.finalized_at:
            raise HTTPException(status_code=409, detail="Trip is finalized")

    def serialize_collaborator(self, collaborator: TripCollaborator) -> CollaboratorResponse:
        user = getattr(collaborator, "user", None)
        return CollaboratorResponse(
            id=collaborator.id,
            trip_id=collaborator.trip_id,
            user_id=collaborator.user_id,
            role=self._role_value(collaborator.role),
            voting_locked=bool(collaborator.voting_locked),
            finalized_at=collaborator.finalized_at,
            joined_at=collaborator.joined_at,
            username=user.username if user else None,
            email=user.email if user else None,
        )

    def serialize_invitation(
        self,
        invitation: TripInvitation,
        raw_token: Optional[str] = None,
        email_sent: bool = False,
        email_error: Optional[str] = None,
    ) -> InvitationResponse:
        invite_link = f"{CLIENT_BASE_URL}/collaboration/accept?token={raw_token}" if raw_token else None
        return InvitationResponse(
            id=invitation.id,
            trip_id=invitation.trip_id,
            email=invitation.email,
            role=self._role_value(invitation.role),
            status=self._role_value(invitation.status),
            expires_at=invitation.expires_at,
            accepted_at=invitation.accepted_at,
            invite_link=invite_link,
            email_sent=email_sent,
            email_error=email_error,
        )

    def _vote_counts(self, suggestion_ids: Iterable[int]) -> Dict[int, Dict[str, object]]:
        ids = list(suggestion_ids)
        if not ids:
            return {}
        summaries = {sid: {"up": 0, "down": 0, "ranking_total": 0, "ranking_count": 0} for sid in ids}
        rows = (
            self.db.query(
                SuggestionVote.suggestion_id,
                SuggestionVote.vote_value,
                func.count(SuggestionVote.id),
                func.sum(SuggestionVote.ranking),
                func.count(SuggestionVote.ranking),
            )
            .filter(SuggestionVote.suggestion_id.in_(ids))
            .group_by(SuggestionVote.suggestion_id, SuggestionVote.vote_value)
            .all()
        )
        for suggestion_id, vote_value, count, ranking_sum, ranking_count in rows:
            key = self._role_value(vote_value)
            if key in ("up", "down"):
                summaries[suggestion_id][key] = int(count or 0)
            summaries[suggestion_id]["ranking_total"] += int(ranking_sum or 0)
            summaries[suggestion_id]["ranking_count"] += int(ranking_count or 0)
        return summaries

    def _reaction_counts(self, suggestion_ids: Iterable[int]) -> Dict[int, Dict[str, int]]:
        ids = list(suggestion_ids)
        if not ids:
            return {}
        rows = (
            self.db.query(SuggestionReaction.suggestion_id, SuggestionReaction.emoji, func.count(SuggestionReaction.id))
            .filter(SuggestionReaction.suggestion_id.in_(ids))
            .group_by(SuggestionReaction.suggestion_id, SuggestionReaction.emoji)
            .all()
        )
        result: Dict[int, Dict[str, int]] = {sid: {} for sid in ids}
        for suggestion_id, emoji, count in rows:
            result[suggestion_id][emoji] = int(count or 0)
        return result

    def _comment_counts(self, suggestion_ids: Iterable[int]) -> Dict[int, int]:
        ids = list(suggestion_ids)
        if not ids:
            return {}
        rows = (
            self.db.query(SuggestionComment.suggestion_id, func.count(SuggestionComment.id))
            .filter(SuggestionComment.suggestion_id.in_(ids))
            .group_by(SuggestionComment.suggestion_id)
            .all()
        )
        return {suggestion_id: int(count or 0) for suggestion_id, count in rows}

    def _my_votes(self, suggestion_ids: Iterable[int], user_id: int) -> Dict[int, SuggestionVote]:
        ids = list(suggestion_ids)
        if not ids:
            return {}
        votes = (
            self.db.query(SuggestionVote)
            .filter(SuggestionVote.suggestion_id.in_(ids), SuggestionVote.user_id == user_id)
            .all()
        )
        return {vote.suggestion_id: vote for vote in votes}

    def _my_reactions(self, suggestion_ids: Iterable[int], user_id: int) -> Dict[int, List[str]]:
        ids = list(suggestion_ids)
        if not ids:
            return {}
        reactions = (
            self.db.query(SuggestionReaction)
            .filter(SuggestionReaction.suggestion_id.in_(ids), SuggestionReaction.user_id == user_id)
            .all()
        )
        result: Dict[int, List[str]] = {sid: [] for sid in ids}
        for reaction in reactions:
            result.setdefault(reaction.suggestion_id, []).append(reaction.emoji)
        return result

    def score_suggestion(self, suggestion: TripSuggestion, budget_target: Optional[Decimal] = None) -> Tuple[float, Dict[str, object]]:
        vote_summary = self._vote_counts([suggestion.id]).get(suggestion.id, {})
        reactions = self._reaction_counts([suggestion.id]).get(suggestion.id, {})
        upvotes = int(vote_summary.get("up", 0))
        downvotes = int(vote_summary.get("down", 0))
        ranking_total = int(vote_summary.get("ranking_total", 0))
        ranking_count = int(vote_summary.get("ranking_count", 0))
        ranking_score = ((6 - (ranking_total / ranking_count)) * 2) if ranking_count else 0
        reaction_score = sum(count * (2 if emoji in ("❤️", "❤", "🔥") else 1) for emoji, count in reactions.items())
        budget_score = 0
        if budget_target and suggestion.estimated_cost is not None:
            cost = Decimal(suggestion.estimated_cost)
            budget_score = 3 if cost <= budget_target else max(-3, float((budget_target - cost) / budget_target))
        score = (upvotes * 3) - (downvotes * 2) + reaction_score + ranking_score + float(budget_score)
        return round(score, 2), {
            "upvotes": upvotes,
            "downvotes": downvotes,
            "reactions": reactions,
            "ranking_score": round(ranking_score, 2),
            "budget_score": round(float(budget_score), 2),
        }

    def serialize_suggestions(self, suggestions: List[TripSuggestion], user_id: int) -> List[SuggestionResponse]:
        ids = [suggestion.id for suggestion in suggestions]
        votes = self._vote_counts(ids)
        reactions = self._reaction_counts(ids)
        comments = self._comment_counts(ids)
        my_votes = self._my_votes(ids, user_id)
        my_reactions = self._my_reactions(ids, user_id)
        serialized = []
        for suggestion in suggestions:
            vote_data = votes.get(suggestion.id, {})
            ranking_count = int(vote_data.get("ranking_count", 0) or 0)
            average_ranking = None
            if ranking_count:
                average_ranking = round(int(vote_data.get("ranking_total", 0)) / ranking_count, 2)
            my_vote = my_votes.get(suggestion.id)
            score, _ = self.score_suggestion(suggestion)
            serialized.append(
                SuggestionResponse(
                    id=suggestion.id,
                    trip_id=suggestion.trip_id,
                    suggestion_type=self._role_value(suggestion.suggestion_type),
                    title=suggestion.title,
                    description=suggestion.description,
                    image_url=suggestion.image_url,
                    estimated_cost=suggestion.estimated_cost,
                    location=suggestion.location,
                    tags=suggestion.tags or [],
                    created_by_user_id=suggestion.created_by_user_id,
                    created_at=suggestion.created_at,
                    updated_at=suggestion.updated_at,
                    vote_summary=VoteSummary(
                        upvotes=int(vote_data.get("up", 0) or 0),
                        downvotes=int(vote_data.get("down", 0) or 0),
                        average_ranking=average_ranking,
                        my_vote=self._role_value(my_vote.vote_value) if my_vote and my_vote.vote_value else None,
                        my_ranking=my_vote.ranking if my_vote else None,
                    ),
                    reaction_summary=ReactionSummary(
                        counts=reactions.get(suggestion.id, {}),
                        mine=my_reactions.get(suggestion.id, []),
                    ),
                    comment_count=comments.get(suggestion.id, 0),
                    score=score,
                )
            )
        return serialized

    def create_invitations(self, trip_id: int, owner_id: int, emails: List[str], role: str) -> List[InvitationResponse]:
        self.require_owner(trip_id, owner_id)
        trip = self.repo.get_trip(trip_id)
        inviter = self.repo.get_user(owner_id)
        role_enum = CollaboratorRole(role)
        responses = []

        for raw_email in emails:
            email = raw_email.lower().strip()
            user = self.repo.get_user_by_email(email)
            if user and self.repo.get_collaborator(trip_id, user.id):
                continue

            token = secrets.token_urlsafe(40)
            token_hash = self.hash_token(token)
            otp_code = "".join(secrets.choice("0123456789") for _ in range(6))
            invitation = self.repo.get_pending_invitation(trip_id, email)
            if invitation:
                invitation.role = role_enum
                invitation.token_hash = token_hash
                invitation.otp_code = otp_code
                invitation.expires_at = datetime.utcnow() + timedelta(days=INVITE_EXPIRE_DAYS)
                invitation.updated_at = datetime.utcnow()
            else:
                invitation = TripInvitation(
                    trip_id=trip_id,
                    email=email,
                    role=role_enum,
                    token_hash=token_hash,
                    otp_code=otp_code,
                    invited_by_user_id=owner_id,
                    expires_at=datetime.utcnow() + timedelta(days=INVITE_EXPIRE_DAYS),
                )
                self.db.add(invitation)
            self.db.flush()
            
            print(f"[COLLAB_INVITE_OTP] to={email} otp={otp_code}")
            invite_link = f"{CLIENT_BASE_URL}/collaboration/accept?token={token}"
            delivery = EmailService.send_collaboration_otp(email, trip.destination or f"Trip #{trip.id}", inviter.username, otp_code)
            responses.append(self.serialize_invitation(invitation, token, delivery.sent, delivery.error))

        self.db.commit()
        return responses

    def accept_invitation(self, token: str, user_id: int) -> TripCollaborator:
        invitation = self.repo.get_invitation_by_hash(self.hash_token(token))
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invitation.status != InvitationStatus.PENDING:
            if invitation.status == InvitationStatus.ACCEPTED and invitation.accepted_by_user_id == user_id:
                collaborator = self.repo.get_collaborator(invitation.trip_id, user_id)
                if collaborator:
                    return collaborator
            raise HTTPException(status_code=409, detail=f"Invitation is {self._role_value(invitation.status)}")
        if invitation.expires_at <= datetime.utcnow():
            invitation.status = InvitationStatus.EXPIRED
            self.db.commit()
            raise HTTPException(status_code=410, detail="Invitation has expired")

        user = self.repo.get_user(user_id)
        if not user or user.email.lower() != invitation.email.lower():
            raise HTTPException(status_code=403, detail="This invite belongs to a different email address")

        collaborator = self.repo.get_collaborator(invitation.trip_id, user_id)
        if not collaborator:
            collaborator = TripCollaborator(
                trip_id=invitation.trip_id,
                user_id=user_id,
                role=invitation.role,
                invited_by_user_id=invitation.invited_by_user_id,
            )
            self.db.add(collaborator)

        invitation.status = InvitationStatus.ACCEPTED
        invitation.accepted_by_user_id = user_id
        invitation.accepted_at = datetime.utcnow()
        self.db.flush()
        self.notify_trip_owner(invitation.trip_id, user_id, NotificationType.INVITE_ACCEPTED, "Invite accepted", f"{user.username} joined your trip.")
        self.db.commit()
        self.db.refresh(collaborator)
        return collaborator

    def revoke_invitation(self, trip_id: int, invitation_id: int, owner_id: int) -> None:
        self.require_owner(trip_id, owner_id)
        invitation = self.repo.get_invitation(trip_id, invitation_id)
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        invitation.status = InvitationStatus.REVOKED
        invitation.revoked_at = datetime.utcnow()
        self.db.commit()

    def create_suggestion(self, trip_id: int, user_id: int, data) -> TripSuggestion:
        self.require_editor(trip_id, user_id)
        suggestion = TripSuggestion(
            trip_id=trip_id,
            suggestion_type=SuggestionType(data.suggestion_type),
            title=data.title.strip(),
            description=data.description,
            image_url=data.image_url,
            estimated_cost=data.estimated_cost,
            location=data.location,
            tags=data.tags,
            external_ref=data.external_ref,
            created_by_user_id=user_id,
        )
        self.db.add(suggestion)
        self.db.flush()
        self.notify_members(trip_id, user_id, NotificationType.NEW_SUGGESTION, "New suggestion", f"{suggestion.title} was suggested.")
        self.db.commit()
        self.db.refresh(suggestion)
        return suggestion

    def upsert_vote(self, suggestion_id: int, user_id: int, vote_value: Optional[str], ranking: Optional[int]) -> SuggestionVote:
        suggestion = self.repo.get_suggestion(suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        if vote_value is None and ranking is None:
            raise HTTPException(status_code=400, detail="Provide vote_value, ranking, or both")
        self.ensure_voting_open(suggestion.trip_id, user_id)
        vote = self.repo.get_vote(suggestion_id, user_id)
        if not vote:
            vote = SuggestionVote(suggestion_id=suggestion_id, user_id=user_id)
            self.db.add(vote)
        if vote_value is not None:
            vote.vote_value = VoteValue(vote_value)
        if ranking is not None:
            vote.ranking = ranking
        vote.updated_at = datetime.utcnow()
        self.notify_members(suggestion.trip_id, user_id, NotificationType.NEW_VOTE, "New vote", f"Someone voted on {suggestion.title}.")
        self.db.commit()
        self.db.refresh(vote)
        return vote

    def toggle_reaction(self, suggestion_id: int, user_id: int, emoji: str) -> Dict[str, object]:
        suggestion = self.repo.get_suggestion(suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        self.require_editor(suggestion.trip_id, user_id)
        reaction = self.repo.get_reaction(suggestion_id, user_id, emoji)
        active = False
        if reaction:
            self.db.delete(reaction)
        else:
            self.db.add(SuggestionReaction(suggestion_id=suggestion_id, user_id=user_id, emoji=emoji))
            active = True
        self.db.commit()
        return {"active": active, "counts": self._reaction_counts([suggestion_id]).get(suggestion_id, {})}

    def add_comment(self, suggestion_id: int, user_id: int, body: str, parent_id: Optional[int]) -> SuggestionComment:
        suggestion = self.repo.get_suggestion(suggestion_id)
        if not suggestion:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        self.require_editor(suggestion.trip_id, user_id)
        if parent_id:
            parent = self.db.query(SuggestionComment).filter(
                SuggestionComment.id == parent_id,
                SuggestionComment.suggestion_id == suggestion_id,
            ).first()
            if not parent:
                raise HTTPException(status_code=400, detail="Parent comment not found for this suggestion")
        comment = SuggestionComment(suggestion_id=suggestion_id, user_id=user_id, body=body.strip(), parent_id=parent_id)
        self.db.add(comment)
        if parent_id:
            self.notify_user(suggestion.trip_id, user_id, parent.user_id, NotificationType.COMMENT_REPLY, "Comment reply", "Someone replied to your comment.")
        self.db.commit()
        self.db.refresh(comment)
        return comment

    def set_voting_lock(self, trip_id: int, owner_id: int, locked: bool) -> TripCollaborator:
        owner = self.require_owner(trip_id, owner_id)
        owner.voting_locked = locked
        owner.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(owner)
        return owner

    def finalize_suggestion(self, trip_id: int, owner_id: int, suggestion_id: int) -> TripSuggestion:
        owner = self.require_owner(trip_id, owner_id)
        suggestion = self.repo.get_suggestion(suggestion_id)
        if not suggestion or suggestion.trip_id != trip_id:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        suggestion.is_finalized = True
        owner.finalized_at = datetime.utcnow()
        owner.voting_locked = True
        self.notify_members(trip_id, owner_id, NotificationType.TRIP_FINALIZED, "Trip finalized", f"{suggestion.title} was finalized.")
        self.db.commit()
        self.db.refresh(suggestion)
        return suggestion

    def update_member_role(self, trip_id: int, owner_id: int, collaborator_id: int, role: str) -> TripCollaborator:
        self.require_owner(trip_id, owner_id)
        collaborator = self.db.query(TripCollaborator).filter(
            TripCollaborator.trip_id == trip_id,
            TripCollaborator.id == collaborator_id,
        ).first()
        if not collaborator:
            raise HTTPException(status_code=404, detail="Collaborator not found")
        if collaborator.role == CollaboratorRole.OWNER:
            raise HTTPException(status_code=400, detail="Owner role cannot be changed")
        collaborator.role = CollaboratorRole(role)
        self.db.commit()
        self.db.refresh(collaborator)
        return collaborator

    def remove_member(self, trip_id: int, owner_id: int, collaborator_id: int) -> None:
        self.require_owner(trip_id, owner_id)
        collaborator = self.db.query(TripCollaborator).filter(
            TripCollaborator.trip_id == trip_id,
            TripCollaborator.id == collaborator_id,
        ).first()
        if not collaborator:
            raise HTTPException(status_code=404, detail="Collaborator not found")
        if collaborator.role == CollaboratorRole.OWNER:
            raise HTTPException(status_code=400, detail="Owner cannot be removed")
        self.db.delete(collaborator)
        self.db.commit()

    def decision_summary(self, trip_id: int, user_id: int, budget_target: Optional[Decimal]):
        self.require_member(trip_id, user_id)
        suggestions = self.db.query(TripSuggestion).filter(TripSuggestion.trip_id == trip_id).all()
        items = []
        for suggestion in suggestions:
            score, reasons = self.score_suggestion(suggestion, budget_target)
            items.append(
                DecisionItem(
                    suggestion_id=suggestion.id,
                    suggestion_type=self._role_value(suggestion.suggestion_type),
                    title=suggestion.title,
                    estimated_cost=suggestion.estimated_cost,
                    score=score,
                    reasons=reasons,
                )
            )
        items.sort(key=lambda item: item.score, reverse=True)
        return {
            "top_destination": next((item for item in items if item.suggestion_type == "destination"), None),
            "top_hotel": next((item for item in items if item.suggestion_type == "hotel"), None),
            "top_restaurants": [item for item in items if item.suggestion_type == "restaurant"][:5],
            "top_activities": [item for item in items if item.suggestion_type == "activity"][:5],
        }

    def notify_members(self, trip_id: int, actor_user_id: int, notification_type: NotificationType, title: str, message: str) -> None:
        for member in self.repo.list_collaborators(trip_id):
            if member.user_id != actor_user_id:
                self.notify_user(trip_id, actor_user_id, member.user_id, notification_type, title, message, commit=False)

    def notify_trip_owner(self, trip_id: int, actor_user_id: int, notification_type: NotificationType, title: str, message: str) -> None:
        trip = self.repo.get_trip(trip_id)
        if trip and trip.user_id and trip.user_id != actor_user_id:
            self.notify_user(trip_id, actor_user_id, trip.user_id, notification_type, title, message, commit=False)

    def notify_user(self, trip_id: int, actor_user_id: int, recipient_user_id: int, notification_type: NotificationType, title: str, message: str, commit: bool = True) -> TripNotification:
        notification = TripNotification(
            trip_id=trip_id,
            recipient_user_id=recipient_user_id,
            actor_user_id=actor_user_id,
            notification_type=notification_type,
            title=title,
            message=message,
        )
        self.db.add(notification)
        if commit:
            self.db.commit()
            self.db.refresh(notification)
        return notification

    def accept_invitation_by_otp(self, otp_code: str, user_id: int) -> TripCollaborator:
        invitation = self.db.query(TripInvitation).filter(
            TripInvitation.otp_code == otp_code,
            TripInvitation.status == InvitationStatus.PENDING
        ).first()
        
        if not invitation:
            raise HTTPException(status_code=404, detail="Invalid verification code or no pending invite found")
            
        if invitation.expires_at <= datetime.utcnow():
            invitation.status = InvitationStatus.EXPIRED
            self.db.commit()
            raise HTTPException(status_code=410, detail="Invitation has expired")

        target_user = self.repo.get_user_by_email(invitation.email)
        if not target_user:
            raise HTTPException(status_code=400, detail="The invited user must be registered before verifying the code.")

        collaborator = self.repo.get_collaborator(invitation.trip_id, target_user.id)
        if not collaborator:
            collaborator = TripCollaborator(
                trip_id=invitation.trip_id,
                user_id=target_user.id,
                role=invitation.role,
                invited_by_user_id=invitation.invited_by_user_id,
            )
            self.db.add(collaborator)

        invitation.status = InvitationStatus.ACCEPTED
        invitation.accepted_by_user_id = target_user.id
        invitation.accepted_at = datetime.utcnow()
        self.db.flush()
        
        self.notify_trip_owner(invitation.trip_id, target_user.id, NotificationType.INVITE_ACCEPTED, "Invite accepted", f"{target_user.username} joined your trip.")
        self.db.commit()
        self.db.refresh(collaborator)
        return collaborator

    def get_current_destination(self, trip_id: int) -> Optional[dict]:
        trip = self.repo.get_trip(trip_id)
        if not trip or not trip.daily_plans:
            return None
        from app.services.database_service import normalize_daily_plans
        normalized = normalize_daily_plans(trip.daily_plans)
        for day in (normalized or []):
            for act in day.get("activities", []):
                if act.get("status") == "current":
                    return act
        return None

    def _detect_arrival_transitions(
        self, trip_id: int, user_id: int, prev_lat: Optional[float], prev_lon: Optional[float], new_lat: float, new_lon: float
    ) -> List[dict]:
        current_dest = self.get_current_destination(trip_id)
        if not current_dest:
            return []
            
        dest_name = current_dest.get("place_name")
        dest_lat = current_dest.get("lat")
        dest_lon = current_dest.get("lon")
        
        if not dest_name or dest_lat is None or dest_lon is None:
            return []
            
        dest_lat = float(dest_lat)
        dest_lon = float(dest_lon)
        
        import math
        def get_dist(lat1, lon1, lat2, lon2):
            return math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2) * 111
            
        new_dist = get_dist(new_lat, new_lon, dest_lat, dest_lon)
        
        collaborator = self.repo.get_collaborator(trip_id, user_id)
        if not collaborator or not collaborator.user:
            return []
            
        username = collaborator.user.username
        role_prefix = "👑 " if collaborator.role == CollaboratorRole.OWNER else ""
        actor_name = f"{role_prefix}{username}"
        
        system_message = None
        
        # GPS hysteresis: Arrived within 150m (0.15 km), Left beyond 250m (0.25 km)
        state_key = (trip_id, user_id, dest_name)
        current_state = MEMBER_PRESENCE_STATES.get(state_key)
        
        if current_state is None:
            if new_dist < 0.15:
                MEMBER_PRESENCE_STATES[state_key] = "arrived"
                system_message = f"{actor_name} arrived at {dest_name}."
            else:
                MEMBER_PRESENCE_STATES[state_key] = "left"
        else:
            if new_dist < 0.15:
                if current_state != "arrived":
                    MEMBER_PRESENCE_STATES[state_key] = "arrived"
                    system_message = f"{actor_name} arrived at {dest_name}."
            elif new_dist >= 0.25:
                if current_state == "arrived":
                    MEMBER_PRESENCE_STATES[state_key] = "left"
                    system_message = f"{actor_name} left {dest_name}."
                
        if system_message:
            db_msg = TripChatMessage(
                trip_id=trip_id,
                user_id=user_id,
                message=system_message,
                message_type="system",
                created_at=datetime.utcnow()
            )
            self.db.add(db_msg)
            self.db.flush()
            
            ws_payload = {
                "event": "chat_message",
                "id": db_msg.id,
                "trip_id": trip_id,
                "user_id": user_id,
                "username": "System",
                "message": db_msg.message,
                "message_type": db_msg.message_type,
                "message_uuid": db_msg.message_uuid,
                "is_pinned": db_msg.is_pinned,
                "timestamp": db_msg.created_at.isoformat() + "Z"
            }
            
            progress_payload = {
                "event": "itinerary_progress_updated",
                "trip_id": trip_id
            }
            return [ws_payload, progress_payload]
            
        return []

    def _update_member_location_record(self, trip_id: int, user_id: int, latitude: float, longitude: float) -> Tuple[MemberLocation, Optional[float], Optional[float]]:
        loc = self.db.query(MemberLocation).filter_by(trip_id=trip_id, user_id=user_id).first()
        prev_lat = None
        prev_lon = None
        if not loc:
            loc = MemberLocation(
                trip_id=trip_id,
                user_id=user_id,
                latitude=latitude,
                longitude=longitude,
                is_sharing=True,
                last_updated=datetime.utcnow()
            )
            self.db.add(loc)
        else:
            prev_lat = loc.latitude
            prev_lon = loc.longitude
            loc.latitude = latitude
            loc.longitude = longitude
            loc.last_updated = datetime.utcnow()
        self.db.flush()
        return loc, prev_lat, prev_lon

    def update_leader_location(self, trip_id: int, user_id: int, lat: float, lon: float) -> Tuple[LeaderLocation, List[dict]]:
        self.require_owner(trip_id, user_id)
        
        leader_loc = self.db.query(LeaderLocation).filter_by(trip_id=trip_id).first()
        prev_lat = leader_loc.lat if leader_loc else None
        prev_lon = leader_loc.lon if leader_loc else None
        
        if not leader_loc:
            leader_loc = LeaderLocation(trip_id=trip_id, lat=lat, lon=lon)
            self.db.add(leader_loc)
        else:
            leader_loc.lat = lat
            leader_loc.lon = lon
            leader_loc.updated_at = datetime.utcnow()
        self.db.flush()
        
        # Sync leader coordinates to member_locations table
        self._update_member_location_record(trip_id, user_id, lat, lon)
        
        # Detect leader arrival/departure system chat message transitions
        events_triggered = self._detect_arrival_transitions(trip_id, user_id, prev_lat, prev_lon, lat, lon)
        
        trip = self.repo.get_trip(trip_id)
        if not trip or not trip.daily_plans:
            self.db.commit()
            return leader_loc, events_triggered
            
        import math
        def get_dist(lat1, lon1, lat2, lon2):
            return math.sqrt((lat1 - lat2) ** 2 + (lon1 - lon2) ** 2) * 111
            
        activities = []
        for day in (trip.daily_plans or []):
            for activity in (day.get("activities", []) or []):
                place_name = activity.get("place_name")
                a_lat = activity.get("lat")
                a_lon = activity.get("lon")
                if place_name and a_lat is not None and a_lon is not None:
                    activities.append({
                        "place_name": place_name,
                        "lat": float(a_lat),
                        "lon": float(a_lon)
                    })
                    
        for act in activities:
            dist = get_dist(lat, lon, act["lat"], act["lon"])
            visit = self.db.query(TripVisit).filter_by(trip_id=trip_id, place_name=act["place_name"]).first()
            
            # GPS hysteresis: Arrived within 150m (0.15 km), Left beyond 250m (0.25 km)
            if dist < 0.15:
                if not visit:
                    visit = TripVisit(trip_id=trip_id, place_name=act["place_name"], status="arrived", arrived_at=datetime.utcnow())
                    self.db.add(visit)
                    self.db.flush()
                    events_triggered.append({
                        "event": "leader_arrived",
                        "place_name": act["place_name"],
                        "trip_id": trip_id
                    })
                elif visit.status == "left":
                    visit.status = "arrived"
                    visit.arrived_at = datetime.utcnow()
                    visit.left_at = None
                    visit.prompt_sent = False
                    self.db.flush()
                    events_triggered.append({
                        "event": "leader_arrived",
                        "place_name": act["place_name"],
                        "trip_id": trip_id
                    })
            elif dist >= 0.25:
                if visit and visit.status == "arrived":
                    visit.status = "left"
                    visit.left_at = datetime.utcnow()
                    
                    if not visit.prompt_sent:
                        visit.prompt_sent = True
                        self.db.flush()
                        events_triggered.append({
                            "event": "ask_expense",
                            "place_name": act["place_name"],
                            "trip_id": trip_id
                        })
                        
                        self.notify_members(
                            trip_id,
                            user_id,
                            NotificationType.NEW_SUGGESTION,
                            f"How much did you spend at {act['place_name']}?",
                            f"Leader left {act['place_name']}. Log your expenses."
                        )
                        
        self.db.commit()
        return leader_loc, events_triggered

    def update_member_location(self, trip_id: int, user_id: int, latitude: float, longitude: float) -> Tuple[MemberLocation, List[dict]]:
        self.require_member(trip_id, user_id)
        
        loc, prev_lat, prev_lon = self._update_member_location_record(trip_id, user_id, latitude, longitude)
        
        events_triggered = self._detect_arrival_transitions(trip_id, user_id, prev_lat, prev_lon, latitude, longitude)
        
        self.db.commit()
        self.db.refresh(loc)
        return loc, events_triggered

    def toggle_sharing_status(self, trip_id: int, user_id: int, is_sharing: bool) -> MemberLocation:
        self.require_member(trip_id, user_id)
        
        loc = self.db.query(MemberLocation).filter_by(trip_id=trip_id, user_id=user_id).first()
        if not loc:
            loc = MemberLocation(
                trip_id=trip_id,
                user_id=user_id,
                latitude=0.0,
                longitude=0.0,
                is_sharing=is_sharing,
                last_updated=datetime.utcnow()
            )
            self.db.add(loc)
        else:
            loc.is_sharing = is_sharing
            loc.last_updated = datetime.utcnow()
            
        self.db.commit()
        self.db.refresh(loc)
        return loc

    def get_member_locations(self, trip_id: int) -> List[dict]:
        collaborators = self.repo.list_collaborators(trip_id)
        user_info = {}
        for c in collaborators:
            if c.user:
                user_info[c.user_id] = {
                    "username": c.user.username,
                    "role": self._role_value(c.role)
                }
                
        leader_loc = self.db.query(LeaderLocation).filter_by(trip_id=trip_id).first()
        leader_lat = leader_loc.lat if leader_loc else None
        leader_lon = leader_loc.lon if leader_loc else None
        
        import math
        def haversine(lat1, lon1, lat2, lon2):
            if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
                return None
            R = 6371.0
            d_lat = math.radians(lat2 - lat1)
            d_lon = math.radians(lon2 - lon1)
            a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            return R * c

        locs = self.db.query(MemberLocation).filter_by(trip_id=trip_id).all()
        results = []
        now = datetime.utcnow()
        for loc in locs:
            if loc.user_id not in user_info:
                continue
                
            info = user_info[loc.user_id]
            diff_secs = (now - loc.last_updated).total_seconds()
            
            if not loc.is_sharing:
                status_str = "Location Sharing Disabled"
            elif diff_secs <= 60:
                status_str = "Online"
            else:
                status_str = "Offline"
                
            dist_str = "Distance unavailable"
            if loc.is_sharing and leader_lat is not None and leader_lon is not None:
                dist_km = haversine(loc.latitude, loc.longitude, leader_lat, leader_lon)
                if dist_km is not None:
                    dist_str = f"{round(dist_km, 1)} km"
                    
            results.append({
                "trip_id": trip_id,
                "user_id": loc.user_id,
                "username": info["username"],
                "role": info["role"],
                "latitude": loc.latitude if loc.is_sharing else 0.0,
                "longitude": loc.longitude if loc.is_sharing else 0.0,
                "is_sharing": loc.is_sharing,
                "last_updated": loc.last_updated,
                "status": status_str,
                "distance_from_leader": dist_str
            })
        return results

    def log_expense(self, trip_id: int, user_id: int, place_name: str, amount: Decimal, description: Optional[str]) -> TripExpense:
        self.require_member(trip_id, user_id)
        
        expense = TripExpense(
            trip_id=trip_id,
            user_id=user_id,
            place_name=place_name.strip(),
            amount=amount,
            description=description.strip() if description else None
        )
        self.db.add(expense)
        self.db.commit()
        self.db.refresh(expense)
        return expense

    def get_expense_splits(self, trip_id: int, user_id: int) -> dict:
        self.require_member(trip_id, user_id)
        
        expenses = self.db.query(TripExpense).filter_by(trip_id=trip_id).order_by(TripExpense.created_at.desc()).all()
        
        collaborators = self.repo.list_collaborators(trip_id)
        members = {c.user_id: c.user.username for c in collaborators if c.user}
        
        trip = self.repo.get_trip(trip_id)
        if trip and trip.user_id and trip.user_id not in members:
            owner = self.repo.get_user(trip.user_id)
            if owner:
                members[trip.user_id] = owner.username
                
        user_spent = {uid: Decimal("0.00") for uid in members.keys()}
        total_spent = Decimal("0.00")
        
        serialized_expenses = []
        for e in expenses:
            uid = e.user_id
            uname = members.get(uid, f"User #{uid}")
            user_spent[uid] = user_spent.get(uid, Decimal("0.00")) + e.amount
            total_spent += e.amount
            serialized_expenses.append({
                "id": e.id,
                "trip_id": e.trip_id,
                "user_id": e.user_id,
                "username": uname,
                "place_name": e.place_name,
                "amount": float(e.amount),
                "description": e.description or "",
                "created_at": e.created_at
            })
            
        num_members = len(members)
        share_per_person = Decimal("0.00")
        splits = []
        
        if num_members > 0:
            share_per_person = total_spent / Decimal(num_members)
            
            balances = {uid: user_spent[uid] - share_per_person for uid in members.keys()}
            
            debtors = []
            creditors = []
            
            for uid, bal in balances.items():
                if bal < -Decimal("0.01"):
                    debtors.append([uid, -bal])
                elif bal > Decimal("0.01"):
                    creditors.append([uid, bal])
            
            debtors.sort(key=lambda x: x[1], reverse=True)
            creditors.sort(key=lambda x: x[1], reverse=True)
            
            d_idx = 0
            c_idx = 0
            
            while d_idx < len(debtors) and c_idx < len(creditors):
                d_id, d_amt = debtors[d_idx]
                c_id, c_amt = creditors[c_idx]
                
                settle_amt = min(d_amt, c_amt)
                
                splits.append({
                    "from_username": members.get(d_id, f"User #{d_id}"),
                    "to_username": members.get(c_id, f"User #{c_id}"),
                    "amount": round(float(settle_amt), 2)
                })
                
                debtors[d_idx][1] -= settle_amt
                creditors[c_idx][1] -= settle_amt
                
                if debtors[d_idx][1] < Decimal("0.01"):
                    d_idx += 1
                if creditors[c_idx][1] < Decimal("0.01"):
                    c_idx += 1
                    
        return {
            "total_spent": float(total_spent),
            "share_per_person": float(share_per_person),
            "expenses": serialized_expenses,
            "splits": splits
        }
