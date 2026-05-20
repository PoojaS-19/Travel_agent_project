from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, validator


class Pagination(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    total: int


class CollaboratorResponse(BaseModel):
    id: int
    trip_id: int
    user_id: int
    role: str
    voting_locked: bool
    finalized_at: Optional[datetime] = None
    joined_at: datetime
    username: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


class InvitationCreate(BaseModel):
    emails: List[EmailStr] = Field(..., min_items=1, max_items=25)
    role: str = Field("editor", pattern="^(editor|viewer)$")


class InvitationResponse(BaseModel):
    id: int
    trip_id: int
    email: str
    role: str
    status: str
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    invite_link: Optional[str] = None

    class Config:
        from_attributes = True


class InvitationAcceptRequest(BaseModel):
    token: str = Field(..., min_length=32)


class InvitationAcceptResponse(BaseModel):
    trip_id: int
    collaborator: CollaboratorResponse
    message: str


class MemberRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(editor|viewer)$")


class TripVotingStateUpdate(BaseModel):
    voting_locked: bool


class SuggestionCreate(BaseModel):
    suggestion_type: str = Field(..., pattern="^(destination|hotel|restaurant|activity)$")
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=5000)
    image_url: Optional[str] = Field(None, max_length=1000)
    estimated_cost: Optional[Decimal] = Field(None, ge=0)
    location: Optional[str] = Field(None, max_length=255)
    tags: List[str] = Field(default_factory=list, max_items=20)
    external_ref: Optional[Dict[str, Any]] = None

    @validator("tags", pre=True, always=True)
    def normalize_tags(cls, value):
        if not value:
            return []
        return [str(tag).strip().lower()[:40] for tag in value if str(tag).strip()]


class VoteSummary(BaseModel):
    upvotes: int = 0
    downvotes: int = 0
    average_ranking: Optional[float] = None
    my_vote: Optional[str] = None
    my_ranking: Optional[int] = None


class ReactionSummary(BaseModel):
    counts: Dict[str, int] = Field(default_factory=dict)
    mine: List[str] = Field(default_factory=list)


class SuggestionResponse(BaseModel):
    id: int
    trip_id: int
    suggestion_type: str
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    estimated_cost: Optional[Decimal] = None
    location: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    vote_summary: VoteSummary
    reaction_summary: ReactionSummary
    comment_count: int = 0
    score: float = 0

    class Config:
        from_attributes = True


class SuggestionListResponse(BaseModel):
    items: List[SuggestionResponse]
    pagination: Pagination


class VoteUpsert(BaseModel):
    vote_value: Optional[str] = Field(None, pattern="^(up|down)$")
    ranking: Optional[int] = Field(None, ge=1, le=5)


class ReactionToggle(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=16)


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=3000)
    parent_id: Optional[int] = None


class CommentResponse(BaseModel):
    id: int
    suggestion_id: int
    parent_id: Optional[int] = None
    user_id: int
    body: str
    created_at: datetime
    updated_at: datetime
    username: Optional[str] = None

    class Config:
        from_attributes = True


class DecisionItem(BaseModel):
    suggestion_id: int
    suggestion_type: str
    title: str
    estimated_cost: Optional[Decimal] = None
    score: float
    reasons: Dict[str, Any]


class DecisionSummaryResponse(BaseModel):
    budget_target: Optional[Decimal] = None
    top_destination: Optional[DecisionItem] = None
    top_hotel: Optional[DecisionItem] = None
    top_restaurants: List[DecisionItem]
    top_activities: List[DecisionItem]


class NotificationResponse(BaseModel):
    id: int
    trip_id: int
    notification_type: str
    title: str
    message: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    read_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CollaborationDashboardResponse(BaseModel):
    trip_id: int
    my_role: str
    voting_locked: bool
    finalized_at: Optional[datetime] = None
    members: List[CollaboratorResponse]
    pending_invitations: List[InvitationResponse]
    recent_suggestions: List[SuggestionResponse]
    unread_notifications: int
