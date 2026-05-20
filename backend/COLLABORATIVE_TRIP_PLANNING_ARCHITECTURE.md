# Collaborative Trip Planning Architecture

## 1. System Architecture

The existing `itineraries` table is the trip aggregate. `itineraries.user_id` remains the trip owner, and collaboration data is attached through trip-scoped tables:

- `TripCollaborator`: membership, role, voting lock/finalization flags.
- `TripInvitation`: secure email invite lifecycle with hashed tokens and 7-day expiry.
- `TripSuggestion`: proposed destination/hotel/restaurant/activity items.
- `SuggestionVote`: one user vote per suggestion, supporting up/down vote and ranking.
- `SuggestionReaction`: one emoji reaction per user per suggestion per emoji.
- `SuggestionComment`: threaded comments through `parent_id`.
- `TripNotification`: in-app notifications, with email hooks.

The backend follows a clean module split:

- Router: HTTP/WebSocket contract and dependency wiring.
- Service: authorization, transaction boundaries, decisions, side effects.
- Repository: focused SQLAlchemy queries.
- WebSocket manager: trip rooms and event fanout.
- Email service: provider boundary; console fallback in development.

## 2. Database Schema Design

Core constraints:

- `TripCollaborator(trip_id, user_id)` is unique to prevent duplicate joins.
- `TripInvitation(trip_id, email)` is indexed for active invite lookup.
- `TripInvitation.token_hash` is unique; raw tokens are never stored.
- `SuggestionVote(suggestion_id, user_id)` is unique to enforce one vote per user per item.
- `SuggestionReaction(suggestion_id, user_id, emoji)` is unique to prevent fake duplicate reactions.
- Comments cascade when a suggestion is deleted, and child comments cascade through `parent_id`.

Important indexes:

- `(trip_id, role)`, `(trip_id, created_at)`, `(trip_id, suggestion_type, created_at)`.
- `(suggestion_id, vote_value)`, `(suggestion_id, ranking)`, `(recipient_user_id, read_at)`.

This keeps dashboard, board, notification, and decision-summary queries bounded by trip or user.

## 3. API Flow

Invitation flow:

1. Owner calls `POST /api/trips/{trip_id}/collaboration/invitations` with email addresses and a role.
2. The system creates secure tokens, stores hashes, and sends invite links.
3. Invitee opens the link and authenticates/signs up.
4. Client calls `POST /api/collaboration/invitations/accept` with the token.
5. Service verifies token, email match, expiry, revocation, and attaches the user.
6. Trip room receives `member_joined`; owner gets a notification.

Voting/suggestion flow:

1. Editor/owner creates suggestions.
2. Members vote, rank, react, and comment.
3. Service enforces role access, voting lock, and uniqueness.
4. Aggregates are returned in list/detail APIs and emitted over WebSockets.

Decision flow:

1. Client calls `GET /api/trips/{trip_id}/collaboration/decisions`.
2. Service calculates weighted scores:
   `score = upvotes*3 - downvotes*2 + hearts*2 + fire*2 + likes + ranking_score + budget_score`.
3. Results are grouped by destination, hotel, restaurant, and activity.

## 4. Real-Time Event Architecture

WebSocket endpoint:

- `ws://host/ws/trips/{trip_id}?token=<jwt>`

Authentication and authorization run during connection setup. Each trip has an in-memory room keyed by `trip_id`.

Events:

- `member_joined`
- `member_removed`
- `invite_sent`
- `suggestion_added`
- `vote_updated`
- `reaction_updated`
- `comment_added`
- `trip_updated`
- `trip_finalized`
- `notification_created`

For one server this in-memory room manager is enough. For production horizontal scaling, replace the fanout internals with Redis Pub/Sub while keeping the same event contract.

## 5. Frontend Structure

Recommended structure:

- `pages/CollaborationDashboard.jsx`
- `components/collaboration/InviteMembersModal.jsx`
- `components/collaboration/VotingBoard.jsx`
- `components/collaboration/SuggestionFeed.jsx`
- `components/collaboration/DecisionSummary.jsx`
- `components/collaboration/ActivityRanking.jsx`
- `hooks/useTripCollaboration.js`

State strategy:

- REST fetch for initial state and pagination.
- Optimistic local updates for votes/reactions/comments.
- WebSocket events reconcile server truth.
- Notification badges come from `/api/collaboration/notifications`.

## 6. Security And Production Notes

- Store only invite token hashes.
- Validate invite acceptance against authenticated user email.
- Enforce role permissions in the service layer, not only the router.
- Add provider-backed email delivery and domain rate limiting before launch.
- Add Redis-backed WebSocket fanout and API cache for high-traffic trips.
- Move from startup `create_all` to Alembic migrations for repeatable deployment.
