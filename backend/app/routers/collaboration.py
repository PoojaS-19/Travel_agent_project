from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from jose import JWTError
from sqlalchemy.orm import Session, joinedload

from app.database import SessionLocal, get_db
from app.models.collaboration_schemas import (
    CollaborationDashboardResponse,
    CommentCreate,
    CommentResponse,
    DecisionSummaryResponse,
    InvitationAcceptRequest,
    InvitationAcceptResponse,
    InvitationCreate,
    InvitationResponse,
    MemberRoleUpdate,
    NotificationResponse,
    Pagination,
    ReactionToggle,
    SuggestionCreate,
    SuggestionListResponse,
    SuggestionResponse,
    TripVotingStateUpdate,
    VoteUpsert,
    InvitationOTPAcceptRequest,
    LeaderLocationUpdate,
    LeaderLocationResponse,
    TripExpenseCreate,
    TripExpenseResponse,
    ExpenseSplitResult,
    MemberLocationUpdate,
    MemberLocationResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ProgressionRequest,
)
from app.repositories.collaboration_repository import CollaborationRepository
from app.routers.auth import get_current_user_id
from app.services.auth_service import AuthService
from app.services.collaboration_service import CollaborationService
from app.websocket_manager import trip_ws_manager
from app.models.collaboration import TripNotification, CollaboratorRole, TripChatMessage
from app.models import Itinerary
from app.services.database_service import normalize_daily_plans



router = APIRouter(prefix="/api", tags=["Trip Collaboration"])


@router.get("/trips/{trip_id}/collaboration/dashboard", response_model=CollaborationDashboardResponse)
def collaboration_dashboard(trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    repo = CollaborationRepository(db)
    me = service.require_member(trip_id, user_id)
    owner = service.ensure_owner_membership(trip_id)
    suggestions, _ = repo.list_suggestions(trip_id, None, 1, 8)
    return CollaborationDashboardResponse(
        trip_id=trip_id,
        my_role=service._role_value(me.role),
        voting_locked=bool(owner.voting_locked),
        finalized_at=owner.finalized_at,
        members=[service.serialize_collaborator(member) for member in repo.list_collaborators(trip_id)],
        pending_invitations=[service.serialize_invitation(invite) for invite in repo.list_pending_invitations(trip_id)],
        recent_suggestions=service.serialize_suggestions(suggestions, user_id),
        unread_notifications=repo.unread_count(user_id, trip_id),
    )


@router.post("/trips/{trip_id}/collaboration/invitations", response_model=list[InvitationResponse])
async def create_invitations(payload: InvitationCreate, trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    invitations = service.create_invitations(trip_id, user_id, [str(email) for email in payload.emails], payload.role)
    await trip_ws_manager.broadcast(trip_id, "invite_sent", {"count": len(invitations)})
    return invitations


@router.post("/trips/{trip_id}/collaboration/invitations/{invitation_id}/resend", response_model=InvitationResponse)
async def resend_invite(invitation_id: int, trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    repo = CollaborationRepository(db)
    service.require_owner(trip_id, user_id)
    invitation = repo.get_invitation(trip_id, invitation_id)
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    response = service.create_invitations(trip_id, user_id, [invitation.email], service._role_value(invitation.role))[0]
    await trip_ws_manager.broadcast(trip_id, "invite_sent", {"invitation_id": invitation_id, "resent": True})
    return response


@router.delete("/trips/{trip_id}/collaboration/invitations/{invitation_id}", status_code=204)
async def revoke_invite(invitation_id: int, trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    CollaborationService(db).revoke_invitation(trip_id, invitation_id, user_id)
    await trip_ws_manager.broadcast(trip_id, "invite_revoked", {"invitation_id": invitation_id})
    return None


@router.post("/collaboration/invitations/accept", response_model=InvitationAcceptResponse)
async def accept_invite(payload: InvitationAcceptRequest, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    collaborator = service.accept_invitation(payload.token, user_id)
    response = service.serialize_collaborator(collaborator)
    await trip_ws_manager.broadcast(collaborator.trip_id, "member_joined", jsonable_encoder(response))
    return InvitationAcceptResponse(trip_id=collaborator.trip_id, collaborator=response, message="Invitation accepted")


@router.post("/collaboration/invitations/accept-otp", response_model=InvitationAcceptResponse)
async def accept_invite_otp(payload: InvitationOTPAcceptRequest, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    collaborator = service.accept_invitation_by_otp(payload.otp_code, user_id)
    response = service.serialize_collaborator(collaborator)
    await trip_ws_manager.broadcast(collaborator.trip_id, "member_joined", jsonable_encoder(response))
    return InvitationAcceptResponse(trip_id=collaborator.trip_id, collaborator=response, message="Invitation accepted")


@router.patch("/trips/{trip_id}/collaboration/members/{collaborator_id}", response_model=dict)
async def update_member_role(payload: MemberRoleUpdate, collaborator_id: int, trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    collaborator = CollaborationService(db).update_member_role(trip_id, user_id, collaborator_id, payload.role)
    await trip_ws_manager.broadcast(trip_id, "member_updated", {"collaborator_id": collaborator.id, "role": payload.role})
    return {"message": "Role updated"}


@router.delete("/trips/{trip_id}/collaboration/members/{collaborator_id}", status_code=204)
async def remove_member(collaborator_id: int, trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    CollaborationService(db).remove_member(trip_id, user_id, collaborator_id)
    await trip_ws_manager.broadcast(trip_id, "member_removed", {"collaborator_id": collaborator_id})
    return None


@router.patch("/trips/{trip_id}/collaboration/voting", response_model=dict)
async def set_voting_state(payload: TripVotingStateUpdate, trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    CollaborationService(db).set_voting_lock(trip_id, user_id, payload.voting_locked)
    await trip_ws_manager.broadcast(trip_id, "trip_updated", {"voting_locked": payload.voting_locked})
    return {"message": "Voting state updated", "voting_locked": payload.voting_locked}


@router.post("/trips/{trip_id}/collaboration/suggestions", response_model=SuggestionResponse)
async def create_suggestion(payload: SuggestionCreate, trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    suggestion = service.create_suggestion(trip_id, user_id, payload)
    response = service.serialize_suggestions([suggestion], user_id)[0]
    await trip_ws_manager.broadcast(trip_id, "suggestion_added", jsonable_encoder(response))
    return response


@router.get("/trips/{trip_id}/collaboration/suggestions", response_model=SuggestionListResponse)
def list_suggestions(
    trip_id: int,
    suggestion_type: Optional[str] = Query(None, pattern="^(destination|hotel|restaurant|activity)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    service = CollaborationService(db)
    service.require_member(trip_id, user_id)
    repo = CollaborationRepository(db)
    items, total = repo.list_suggestions(trip_id, suggestion_type, page, page_size)
    return SuggestionListResponse(
        items=service.serialize_suggestions(items, user_id),
        pagination=Pagination(page=page, page_size=page_size, total=total),
    )


@router.put("/collaboration/suggestions/{suggestion_id}/vote", response_model=dict)
async def upsert_vote(payload: VoteUpsert, suggestion_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    vote = service.upsert_vote(suggestion_id, user_id, payload.vote_value, payload.ranking)
    suggestion = CollaborationRepository(db).get_suggestion(suggestion_id)
    response = service.serialize_suggestions([suggestion], user_id)[0]
    await trip_ws_manager.broadcast(suggestion.trip_id, "vote_updated", {"suggestion": jsonable_encoder(response)})
    return {"message": "Vote updated", "vote_id": vote.id, "suggestion": response}


@router.post("/collaboration/suggestions/{suggestion_id}/reactions", response_model=dict)
async def toggle_reaction(payload: ReactionToggle, suggestion_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    result = service.toggle_reaction(suggestion_id, user_id, payload.emoji)
    suggestion = CollaborationRepository(db).get_suggestion(suggestion_id)
    await trip_ws_manager.broadcast(suggestion.trip_id, "reaction_updated", {"suggestion_id": suggestion_id, **result})
    return result


@router.post("/collaboration/suggestions/{suggestion_id}/comments", response_model=CommentResponse)
async def add_comment(payload: CommentCreate, suggestion_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    comment = CollaborationService(db).add_comment(suggestion_id, user_id, payload.body, payload.parent_id)
    username = comment.user.username if comment.user else None
    response = CommentResponse(
        id=comment.id,
        suggestion_id=comment.suggestion_id,
        parent_id=comment.parent_id,
        user_id=comment.user_id,
        body=comment.body,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        username=username,
    )
    suggestion = CollaborationRepository(db).get_suggestion(suggestion_id)
    await trip_ws_manager.broadcast(suggestion.trip_id, "comment_added", jsonable_encoder(response))
    return response


@router.get("/collaboration/suggestions/{suggestion_id}/comments", response_model=dict)
def list_comments(suggestion_id: int, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    repo = CollaborationRepository(db)
    suggestion = repo.get_suggestion(suggestion_id)
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    CollaborationService(db).require_member(suggestion.trip_id, user_id)
    comments, total = repo.list_comments(suggestion_id, page, page_size)
    return {
        "items": [
            CommentResponse(
                id=comment.id,
                suggestion_id=comment.suggestion_id,
                parent_id=comment.parent_id,
                user_id=comment.user_id,
                body=comment.body,
                created_at=comment.created_at,
                updated_at=comment.updated_at,
                username=comment.user.username if comment.user else None,
            )
            for comment in comments
        ],
        "pagination": Pagination(page=page, page_size=page_size, total=total),
    }


@router.post("/trips/{trip_id}/collaboration/finalize/{suggestion_id}", response_model=SuggestionResponse)
async def finalize_suggestion(suggestion_id: int, trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    suggestion = service.finalize_suggestion(trip_id, user_id, suggestion_id)
    response = service.serialize_suggestions([suggestion], user_id)[0]
    await trip_ws_manager.broadcast(trip_id, "trip_finalized", jsonable_encoder(response))
    return response


@router.get("/trips/{trip_id}/collaboration/decisions", response_model=DecisionSummaryResponse)
def decision_summary(trip_id: int, budget_target: Optional[Decimal] = None, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    summary = service.decision_summary(trip_id, user_id, budget_target)
    return DecisionSummaryResponse(budget_target=budget_target, **summary)


@router.get("/collaboration/notifications", response_model=dict)
def list_notifications(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), unread_only: bool = False, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    repo = CollaborationRepository(db)
    items, total = repo.list_notifications(user_id, page, page_size, unread_only)
    return {
        "items": [
            NotificationResponse(
                id=item.id,
                trip_id=item.trip_id,
                notification_type=CollaborationService._role_value(item.notification_type),
                title=item.title,
                message=item.message,
                payload=item.payload,
                read_at=item.read_at,
                created_at=item.created_at,
            )
            for item in items
        ],
        "pagination": Pagination(page=page, page_size=page_size, total=total),
    }


@router.post("/collaboration/notifications/{notification_id}/read", response_model=dict)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    notification = db.query(TripNotification).filter_by(id=notification_id, recipient_user_id=user_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read_at = datetime.utcnow()
    db.commit()
    return {"message": "Notification marked as read"}


@router.post("/trips/{trip_id}/leader-location", response_model=LeaderLocationResponse)
async def update_leader_location(trip_id: int, payload: LeaderLocationUpdate, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    leader_loc, events_triggered = service.update_leader_location(trip_id, user_id, payload.lat, payload.lon)
    
    await trip_ws_manager.broadcast(trip_id, "leader_location_updated", {
        "trip_id": trip_id,
        "lat": payload.lat,
        "lon": payload.lon,
        "updated_at": leader_loc.updated_at.isoformat()
    })
    
    for event in events_triggered:
        await trip_ws_manager.broadcast(trip_id, event["event"], event)
        
    return LeaderLocationResponse(
        trip_id=trip_id,
        lat=leader_loc.lat,
        lon=leader_loc.lon,
        updated_at=leader_loc.updated_at
    )


@router.get("/trips/{trip_id}/leader-location", response_model=LeaderLocationResponse)
def get_leader_location(trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    service.require_member(trip_id, user_id)
    from app.models.collaboration import LeaderLocation
    loc = db.query(LeaderLocation).filter_by(trip_id=trip_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Leader location not set yet")
    return LeaderLocationResponse(
        trip_id=trip_id,
        lat=loc.lat,
        lon=loc.lon,
        updated_at=loc.updated_at
    )


@router.post("/trips/{trip_id}/locations", response_model=MemberLocationResponse)
async def update_member_location(
    trip_id: int,
    payload: MemberLocationUpdate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    service = CollaborationService(db)
    service.require_member(trip_id, user_id)
    
    collaborator = service.repo.get_collaborator(trip_id, user_id)
    if collaborator and collaborator.role == CollaboratorRole.OWNER:
        leader_loc, events_triggered = service.update_leader_location(trip_id, user_id, payload.latitude, payload.longitude)
        
        await trip_ws_manager.broadcast(trip_id, "leader_location_updated", {
            "trip_id": trip_id,
            "lat": payload.latitude,
            "lon": payload.longitude,
            "updated_at": leader_loc.updated_at.isoformat()
        })
        
        for event in events_triggered:
            await trip_ws_manager.broadcast(trip_id, event["event"], event)
    else:
        service.update_member_location(trip_id, user_id, payload.latitude, payload.longitude)
        
    all_locations = service.get_member_locations(trip_id)
    await trip_ws_manager.broadcast(trip_id, "member_locations_updated", {
        "trip_id": trip_id,
        "locations": all_locations
    })
    
    user_loc = next((l for l in all_locations if l["user_id"] == user_id), None)
    if not user_loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return user_loc


@router.get("/trips/{trip_id}/locations", response_model=list[MemberLocationResponse])
def get_member_locations(trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    service.require_member(trip_id, user_id)
    return service.get_member_locations(trip_id)


@router.patch("/trips/{trip_id}/collaboration/members/me/sharing", response_model=MemberLocationResponse)
async def update_sharing_status(
    trip_id: int,
    is_sharing: bool = Query(...),
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    service = CollaborationService(db)
    service.toggle_sharing_status(trip_id, user_id, is_sharing)
    
    all_locations = service.get_member_locations(trip_id)
    await trip_ws_manager.broadcast(trip_id, "member_locations_updated", {
        "trip_id": trip_id,
        "locations": all_locations
    })
    
    user_loc = next((l for l in all_locations if l["user_id"] == user_id), None)
    if not user_loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return user_loc



@router.post("/trips/{trip_id}/expenses", response_model=TripExpenseResponse)
async def log_expense(trip_id: int, payload: TripExpenseCreate, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    expense = service.log_expense(trip_id, user_id, payload.place_name, payload.amount, payload.description)
    user = service.repo.get_user(user_id)
    
    await trip_ws_manager.broadcast(trip_id, "expense_updated", {})
    
    return TripExpenseResponse(
        id=expense.id,
        trip_id=expense.trip_id,
        user_id=expense.user_id,
        username=user.username if user else None,
        place_name=expense.place_name,
        amount=expense.amount,
        description=expense.description,
        created_at=expense.created_at
    )


@router.get("/trips/{trip_id}/expenses", response_model=ExpenseSplitResult)
def get_expense_splits(trip_id: int, db: Session = Depends(get_db), user_id: int = Depends(get_current_user_id)):
    service = CollaborationService(db)
    splits = service.get_expense_splits(trip_id, user_id)
    return splits


@router.get("/trips/{trip_id}/chat", response_model=list[ChatMessageResponse])
def get_chat_history(
    trip_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    service = CollaborationService(db)
    service.require_member(trip_id, user_id)
    messages = (
        db.query(TripChatMessage)
        .options(joinedload(TripChatMessage.user))
        .filter(TripChatMessage.trip_id == trip_id)
        .order_by(TripChatMessage.created_at.asc())
        .all()
    )
    result = []
    for msg in messages:
        result.append(
            ChatMessageResponse(
                id=msg.id,
                user_id=msg.user_id,
                username=msg.user.username if msg.user else "Unknown",
                message=msg.message,
                message_type=msg.message_type,
                message_uuid=msg.message_uuid,
                is_pinned=msg.is_pinned,
                message_metadata=msg.message_metadata,
                created_at=msg.created_at,
            )
        )
    return result


@router.post("/trips/{trip_id}/chat", response_model=ChatMessageResponse)
async def send_chat_message(
    trip_id: int,
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    service = CollaborationService(db)
    collaborator = service.require_member(trip_id, user_id)
    
    # Validate message types: owner can post announcements, others get rejected
    if payload.message_type == "announcement":
        if collaborator.role != CollaboratorRole.OWNER:
            raise HTTPException(
                status_code=403,
                detail="Only the trip leader can send announcements."
            )
            
    # De-duplicate messages using client-generated message_uuid
    if payload.message_uuid:
        existing = (
            db.query(TripChatMessage)
            .options(joinedload(TripChatMessage.user))
            .filter(TripChatMessage.message_uuid == payload.message_uuid)
            .first()
        )
        if existing:
            return ChatMessageResponse(
                id=existing.id,
                user_id=existing.user_id,
                username=existing.user.username if existing.user else "Unknown",
                message=existing.message,
                message_type=existing.message_type,
                message_uuid=existing.message_uuid,
                is_pinned=existing.is_pinned,
                message_metadata=existing.message_metadata,
                created_at=existing.created_at,
            )
            
    db_msg = TripChatMessage(
        trip_id=trip_id,
        user_id=user_id,
        message=payload.message,
        message_type=payload.message_type or "text",
        message_uuid=payload.message_uuid,
        created_at=datetime.utcnow()
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    
    # Eager load user relationship
    db_msg = (
        db.query(TripChatMessage)
        .options(joinedload(TripChatMessage.user))
        .filter(TripChatMessage.id == db_msg.id)
        .first()
    )
    
    response = ChatMessageResponse(
        id=db_msg.id,
        user_id=db_msg.user_id,
        username=db_msg.user.username if db_msg.user else "Unknown",
        message=db_msg.message,
        message_type=db_msg.message_type,
        message_uuid=db_msg.message_uuid,
        is_pinned=db_msg.is_pinned,
        message_metadata=db_msg.message_metadata,
        created_at=db_msg.created_at,
    )
    
    ws_payload = {
        "id": db_msg.id,
        "trip_id": trip_id,
        "user_id": user_id,
        "username": response.username,
        "message": db_msg.message,
        "message_type": db_msg.message_type,
        "message_uuid": db_msg.message_uuid,
        "is_pinned": db_msg.is_pinned,
        "timestamp": db_msg.created_at.isoformat() + "Z"
    }
    await trip_ws_manager.broadcast(trip_id, "chat_message", ws_payload)
    
    return response


async def websocket_trip_endpoint(websocket: WebSocket, trip_id: int, token: str = Query(...)):
    db = SessionLocal()
    user_id = None
    try:
        try:
            payload = AuthService.decode_token(token)
            user_id = int(payload.get("sub"))
        except (JWTError, TypeError, ValueError):
            await websocket.close(code=1008)
            return
        CollaborationService(db).require_member(trip_id, user_id)
        
        # Get username for typing broadcasts
        from app.models.models import User
        user = db.query(User).filter_by(id=user_id).first()
        username = user.username if user else "Unknown"

        await trip_ws_manager.connect(trip_id, websocket)
        await trip_ws_manager.broadcast(trip_id, "presence", {"user_id": user_id, "status": "online"})
        while True:
            text_data = await websocket.receive_text()
            try:
                import json
                data = json.loads(text_data)
                if data.get("event") == "chat_typing":
                    is_typing = data.get("payload", {}).get("is_typing", True)
                    await trip_ws_manager.broadcast(trip_id, "chat_typing", {
                        "trip_id": trip_id,
                        "user_id": user_id,
                        "username": username,
                        "is_typing": is_typing
                    })
            except Exception:
                pass
    except WebSocketDisconnect:
        trip_ws_manager.disconnect(trip_id, websocket)
        if user_id is not None:
            await trip_ws_manager.broadcast(trip_id, "presence", {"user_id": user_id, "status": "offline"})
        else:
            await trip_ws_manager.broadcast(trip_id, "presence", {"status": "offline"})
    finally:
        db.close()


@router.post("/trips/{trip_id}/itinerary/complete")
async def mark_destination_completed(
    trip_id: int,
    payload: ProgressionRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    # Require collaborator membership & edit rights
    service = CollaborationService(db)
    collaborator = service.require_member(trip_id, user_id)
    if collaborator.role not in [CollaboratorRole.OWNER, CollaboratorRole.EDITOR]:
        raise HTTPException(status_code=403, detail="Only owners or editors can update destination status.")

    # Fetch itinerary
    itinerary = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not itinerary:
        raise HTTPException(status_code=404, detail="Itinerary not found")

    daily_plans = itinerary.daily_plans
    if not isinstance(daily_plans, list) or len(daily_plans) == 0:
        raise HTTPException(status_code=400, detail="Itinerary daily plans are empty")

    # Normalize if not already done
    daily_plans = normalize_daily_plans(daily_plans)

    # Flatten activities to find current
    all_activities = []
    for day in daily_plans:
        if isinstance(day, dict) and "activities" in day:
            activities = day["activities"]
            if isinstance(activities, list):
                for act in activities:
                    if isinstance(act, dict):
                        all_activities.append(act)

    if len(all_activities) == 0:
        raise HTTPException(status_code=400, detail="No activities found in itinerary")

    # Find current activity
    cur_idx = -1
    for i, act in enumerate(all_activities):
        if act.get("status") == "current":
            cur_idx = i
            break

    if cur_idx == -1:
        raise HTTPException(status_code=400, detail="No active current destination exists for this trip.")

    current_act = all_activities[cur_idx]
    place_name = current_act.get("place_name", "Unknown Location")

    # Duplicate Protection check
    if place_name != payload.place_name:
        raise HTTPException(
            status_code=400,
            detail=f"Progression mismatch: '{payload.place_name}' is not the current active destination."
        )

    # Mark it as completed
    current_act["status"] = "completed"

    # Find the next upcoming activity to make current
    next_act = None
    for i in range(cur_idx + 1, len(all_activities)):
        if all_activities[i].get("status") == "upcoming":
            next_act = all_activities[i]
            break

    role_prefix = "👑 " if collaborator.role == CollaboratorRole.OWNER else ""
    actor_name = f"{role_prefix}{collaborator.user.username if collaborator.user else 'Unknown'}"

    if next_act:
        next_act["status"] = "current"
        next_place_name = next_act.get("place_name", "Unknown Location")
        system_message = f"{actor_name} completed {place_name}. Moving to {next_place_name}."
    else:
        system_message = f"{actor_name} completed {place_name}. Trip completed!"

    # Save to DB
    from sqlalchemy.orm.attributes import flag_modified
    itinerary.daily_plans = daily_plans
    flag_modified(itinerary, "daily_plans")
    db.add(itinerary)

    # Create system chat message
    db_msg = TripChatMessage(
        trip_id=trip_id,
        user_id=user_id,
        message=system_message,
        message_type="system",
        created_at=datetime.utcnow()
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)

    # Broadcast system chat message via WebSocket
    ws_payload = {
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
    await trip_ws_manager.broadcast(trip_id, "chat_message", ws_payload)

    # Broadcast progress update to reload itinerary UI
    await trip_ws_manager.broadcast(trip_id, "itinerary_progress_updated", {})

    return {"message": "Destination completed successfully", "daily_plans": daily_plans}


@router.post("/trips/{trip_id}/itinerary/skip")
async def skip_destination(
    trip_id: int,
    payload: ProgressionRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id)
):
    # Require collaborator membership & edit rights
    service = CollaborationService(db)
    collaborator = service.require_member(trip_id, user_id)
    if collaborator.role not in [CollaboratorRole.OWNER, CollaboratorRole.EDITOR]:
        raise HTTPException(status_code=403, detail="Only owners or editors can update destination status.")

    # Fetch itinerary
    itinerary = db.query(Itinerary).filter(Itinerary.id == trip_id).first()
    if not itinerary:
        raise HTTPException(status_code=404, detail="Itinerary not found")

    daily_plans = itinerary.daily_plans
    if not isinstance(daily_plans, list) or len(daily_plans) == 0:
        raise HTTPException(status_code=400, detail="Itinerary daily plans are empty")

    # Normalize if not already done
    daily_plans = normalize_daily_plans(daily_plans)

    # Flatten activities to find current
    all_activities = []
    for day in daily_plans:
        if isinstance(day, dict) and "activities" in day:
            activities = day["activities"]
            if isinstance(activities, list):
                for act in activities:
                    if isinstance(act, dict):
                        all_activities.append(act)

    if len(all_activities) == 0:
        raise HTTPException(status_code=400, detail="No activities found in itinerary")

    # Find current activity
    cur_idx = -1
    for i, act in enumerate(all_activities):
        if act.get("status") == "current":
            cur_idx = i
            break

    if cur_idx == -1:
        raise HTTPException(status_code=400, detail="No active current destination exists for this trip.")

    current_act = all_activities[cur_idx]
    place_name = current_act.get("place_name", "Unknown Location")

    # Duplicate Protection check
    if place_name != payload.place_name:
        raise HTTPException(
            status_code=400,
            detail=f"Progression mismatch: '{payload.place_name}' is not the current active destination."
        )

    # Mark it as skipped
    current_act["status"] = "skipped"

    # Find the next upcoming activity to make current
    next_act = None
    for i in range(cur_idx + 1, len(all_activities)):
        if all_activities[i].get("status") == "upcoming":
            next_act = all_activities[i]
            break

    role_prefix = "👑 " if collaborator.role == CollaboratorRole.OWNER else ""
    actor_name = f"{role_prefix}{collaborator.user.username if collaborator.user else 'Unknown'}"

    if next_act:
        next_act["status"] = "current"
        next_place_name = next_act.get("place_name", "Unknown Location")
        system_message = f"{actor_name} skipped {place_name}. Moving to {next_place_name}."
    else:
        system_message = f"{actor_name} skipped {place_name}. Trip completed!"

    # Save to DB
    from sqlalchemy.orm.attributes import flag_modified
    itinerary.daily_plans = daily_plans
    flag_modified(itinerary, "daily_plans")
    db.add(itinerary)

    # Create system chat message
    db_msg = TripChatMessage(
        trip_id=trip_id,
        user_id=user_id,
        message=system_message,
        message_type="system",
        created_at=datetime.utcnow()
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)

    # Broadcast system chat message via WebSocket
    ws_payload = {
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
    await trip_ws_manager.broadcast(trip_id, "chat_message", ws_payload)

    # Broadcast progress update to reload itinerary UI
    await trip_ws_manager.broadcast(trip_id, "itinerary_progress_updated", {})

    return {"message": "Destination skipped successfully", "daily_plans": daily_plans}

