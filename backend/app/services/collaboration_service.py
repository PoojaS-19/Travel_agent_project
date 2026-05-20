import hashlib
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


CLIENT_BASE_URL = "http://localhost:5173"
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

    def serialize_invitation(self, invitation: TripInvitation, raw_token: Optional[str] = None) -> InvitationResponse:
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
            invitation = self.repo.get_pending_invitation(trip_id, email)
            if invitation:
                invitation.role = role_enum
                invitation.token_hash = token_hash
                invitation.expires_at = datetime.utcnow() + timedelta(days=INVITE_EXPIRE_DAYS)
                invitation.updated_at = datetime.utcnow()
            else:
                invitation = TripInvitation(
                    trip_id=trip_id,
                    email=email,
                    role=role_enum,
                    token_hash=token_hash,
                    invited_by_user_id=owner_id,
                    expires_at=datetime.utcnow() + timedelta(days=INVITE_EXPIRE_DAYS),
                )
                self.db.add(invitation)
            self.db.flush()
            invite_link = f"{CLIENT_BASE_URL}/collaboration/accept?token={token}"
            EmailService.send_trip_invitation(email, trip.destination or f"Trip #{trip.id}", inviter.username, invite_link)
            responses.append(self.serialize_invitation(invitation, token))

        self.db.commit()
        return responses

    def accept_invitation(self, token: str, user_id: int) -> TripCollaborator:
        invitation = self.repo.get_invitation_by_hash(self.hash_token(token))
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation not found")
        if invitation.status != InvitationStatus.PENDING:
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
