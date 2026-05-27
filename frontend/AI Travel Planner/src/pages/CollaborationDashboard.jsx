import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ActivityRanking from "../components/collaboration/ActivityRanking";
import DecisionSummary from "../components/collaboration/DecisionSummary";
import InviteMembersModal from "../components/collaboration/InviteMembersModal";
import SuggestionFeed from "../components/collaboration/SuggestionFeed";
import VotingBoard from "../components/collaboration/VotingBoard";
import useTripCollaboration from "../hooks/useTripCollaboration";
import "./CollaborationDashboard.css";

export default function CollaborationDashboard() {
  const { tripId } = useParams();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { dashboard, suggestions, groupedSuggestions, decisions, loading, error, actions } = useTripCollaboration(tripId);

  const canEdit = dashboard?.my_role === "owner" || dashboard?.my_role === "editor";
  const isOwner = dashboard?.my_role === "owner";
  const activities = useMemo(() => groupedSuggestions.activity || [], [groupedSuggestions]);

  if (!tripId) {
    return (
      <main className="collab-page">
        <section className="trip-picker">
          <h1>Invalid trip selected</h1>
          <p>Open collaboration from a saved itinerary.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="collab-page">
      <InviteMembersModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={actions.inviteMembers} />

      <section className="collab-hero">
        <div>
          <span className="live-pill">Live room - Trip #{tripId}</span>
          <h1>Plan together</h1>
          <p>Invite friends, vote on ideas, react to options, and finalize the group's preferred plan.</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => setInviteOpen(true)} disabled={!isOwner}>Invite</button>
          {isOwner && (
            <button onClick={() => actions.setVotingLocked(!dashboard?.voting_locked)}>
              {dashboard?.voting_locked ? "Unlock voting" : "Lock voting"}
            </button>
          )}
        </div>
      </section>

      {error && <p className="collab-error">{error}</p>}
      {loading && <div className="collab-loading">Syncing collaboration room...</div>}

      <section className="member-rail">
        {(dashboard?.members || []).map((member) => (
          <div className="member-chip" key={member.id}>
            <span>{member.username?.slice(0, 1).toUpperCase() || member.email?.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{member.username || member.email}</strong>
              <small>{member.role}</small>
            </div>
          </div>
        ))}
        {(dashboard?.pending_invitations || []).map((invite) => (
          <div className="member-chip pending" key={invite.id}>
            <span>?</span>
            <div>
              <strong>{invite.email}</strong>
              <small>pending {invite.role}</small>
            </div>
          </div>
        ))}
      </section>

      <DecisionSummary decisions={decisions} />
      <VotingBoard groupedSuggestions={groupedSuggestions} onVote={actions.vote} onReact={actions.react} onFinalize={actions.finalize} canFinalize={isOwner} />
      {canEdit && <SuggestionFeed suggestions={suggestions} onAddSuggestion={actions.addSuggestion} onComment={actions.comment} />}
      <ActivityRanking activities={activities} onRank={actions.rank} />
    </main>
  );
}
