import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import api from "../api";
import ActivityRanking from "../components/collaboration/ActivityRanking";
import DecisionSummary from "../components/collaboration/DecisionSummary";
import InviteMembersModal from "../components/collaboration/InviteMembersModal";
import SuggestionFeed from "../components/collaboration/SuggestionFeed";
import VotingBoard from "../components/collaboration/VotingBoard";
import useTripCollaboration from "../hooks/useTripCollaboration";
import "./CollaborationDashboard.css";

// Fix default Leaflet icon paths for Vite builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom red marker for the leader's location
const leaderIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Helper component to dynamically fly/recenter the Leaflet map
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 13);
    }
  }, [center, map]);
  return null;
}

export default function CollaborationDashboard() {
  const { tripId } = useParams();
  const [inviteOpen, setInviteOpen] = useState(false);
  const {
    dashboard,
    suggestions,
    groupedSuggestions,
    decisions,
    expensesData,
    leaderLocation,
    expensePromptPlace,
    setExpensePromptPlace,
    itinerary,
    loading,
    error,
    actions
  } = useTripCollaboration(tripId);

  // Modal / Form States
  const [promptAmount, setPromptAmount] = useState("");
  const [promptDesc, setPromptDesc] = useState("");

  const [manualPlace, setManualPlace] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDesc, setManualDesc] = useState("");

  const [selectedSimPlaceIndex, setSelectedSimPlaceIndex] = useState(0);

  const [followers, setFollowers] = useState([
    { email: "", invited: false, verified: false, otp: "", message: "", error: "", loadingInvite: false, loadingVerify: false }
  ]);
  const [showFollowersCard, setShowFollowersCard] = useState(false);

  const addFollowerField = () => {
    setFollowers([...followers, { email: "", invited: false, verified: false, otp: "", message: "", error: "", loadingInvite: false, loadingVerify: false }]);
  };

  const handleFollowerEmailChange = (index, value) => {
    const updated = [...followers];
    updated[index].email = value;
    setFollowers(updated);
  };

  const handleFollowerOtpChange = (index, value) => {
    const updated = [...followers];
    updated[index].otp = value;
    setFollowers(updated);
  };

  const handleSendInvite = async (index) => {
    const follower = followers[index];
    if (!follower.email) {
      const updated = [...followers];
      updated[index].error = "Please enter a valid email address.";
      setFollowers(updated);
      return;
    }
    const updated = [...followers];
    updated[index].loadingInvite = true;
    updated[index].error = "";
    updated[index].message = "";
    setFollowers(updated);

    try {
      await actions.inviteMembers([follower.email], "follower");
      const updatedSuccess = [...followers];
      updatedSuccess[index].invited = true;
      updatedSuccess[index].message = "Verification code sent to email.";
      updatedSuccess[index].loadingInvite = false;
      setFollowers(updatedSuccess);
    } catch (err) {
      console.error("Invite follower error:", err);
      const updatedErr = [...followers];
      updatedErr[index].error = err.response?.data?.detail || "Could not send invite.";
      updatedErr[index].loadingInvite = false;
      setFollowers(updatedErr);
    }
  };

  const handleVerifyOtp = async (index) => {
    const follower = followers[index];
    if (follower.otp.length !== 6) {
      const updated = [...followers];
      updated[index].error = "Please enter a 6-digit verification code.";
      setFollowers(updated);
      return;
    }

    const updated = [...followers];
    updated[index].loadingVerify = true;
    updated[index].error = "";
    updated[index].message = "";
    setFollowers(updated);

    try {
      await api.post("/api/collaboration/invitations/accept-otp", {
        otp_code: follower.otp
      });
      const updatedSuccess = [...followers];
      updatedSuccess[index].verified = true;
      updatedSuccess[index].message = "Follower linked successfully!";
      updatedSuccess[index].loadingVerify = false;
      setFollowers(updatedSuccess);
      actions.reload();
    } catch (err) {
      console.error("Verify OTP error:", err);
      const updatedErr = [...followers];
      updatedErr[index].error = err.response?.data?.detail || "Invalid code or user not registered.";
      updatedErr[index].loadingVerify = false;
      setFollowers(updatedErr);
    }
  };

  const handleDoneFinalizing = () => {
    setShowFollowersCard(false);
    alert("Followers linking process finished.");
  };

  const canEdit = dashboard?.my_role === "owner" || dashboard?.my_role === "editor";
  const isOwner = dashboard?.my_role === "owner";
  const activities = useMemo(() => groupedSuggestions.activity || [], [groupedSuggestions]);

  // Extract all activities that have lat/lon coordinates from itinerary
  const mapPlaces = useMemo(() => {
    if (!itinerary?.daily_plans) return [];
    const list = [];
    itinerary.daily_plans.forEach((day) => {
      (day.activities || []).forEach((act) => {
        if (act.place_name && act.lat !== undefined && act.lon !== undefined && act.lat !== null && act.lon !== null) {
          list.push({
            place_name: act.place_name,
            lat: Number(act.lat),
            lon: Number(act.lon),
            day: day.day,
            time: act.time || "Flexible"
          });
        }
      });
    });
    return list;
  }, [itinerary]);

  // Determine center of map: leader location or first itinerary activity
  const mapCenter = useMemo(() => {
    if (leaderLocation) return [leaderLocation.lat, leaderLocation.lon];
    if (mapPlaces.length > 0) return [mapPlaces[0].lat, mapPlaces[0].lon];
    return [19.0760, 72.8777]; // Mumbai
  }, [leaderLocation, mapPlaces]);

  // Form Submissions
  const handlePromptExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!promptAmount || isNaN(promptAmount)) return;
    try {
      await actions.addExpense(expensePromptPlace, Number(promptAmount), promptDesc);
      setPromptAmount("");
      setPromptDesc("");
      setExpensePromptPlace(null);
    } catch (err) {
      console.error(err);
      alert("Failed to submit expense");
    }
  };

  const handleManualExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!manualPlace || !manualAmount || isNaN(manualAmount)) return;
    try {
      await actions.addExpense(manualPlace, Number(manualAmount), manualDesc);
      setManualPlace("");
      setManualAmount("");
      setManualDesc("");
    } catch (err) {
      console.error(err);
      alert("Failed to submit expense");
    }
  };

  // Simulation controls
  const handleSimulateArrive = async () => {
    const place = mapPlaces[selectedSimPlaceIndex];
    if (!place) return;
    try {
      await actions.updateLeaderLocation(place.lat, place.lon);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateLeave = async () => {
    const place = mapPlaces[selectedSimPlaceIndex];
    if (!place) return;
    try {
      // Teleport leader 1km away from coordinates to simulate leaving the location
      await actions.updateLeaderLocation(place.lat + 0.01, place.lon + 0.01);
    } catch (err) {
      console.error(err);
    }
  };

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

      {/* 1. Real-time Proximity Expense Prompt Modal */}
      {expensePromptPlace && (
        <div className="collab-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="collab-modal" style={{ border: "2px solid #2563eb" }}>
            <div className="collab-modal-header">
              <h2>💰 Expense Prompt</h2>
              <button className="icon-button" onClick={() => setExpensePromptPlace(null)}>×</button>
            </div>
            <p>Leader left <strong>{expensePromptPlace}</strong>. How many rupees did you spend here?</p>
            <form onSubmit={handlePromptExpenseSubmit}>
              <label>
                Amount (in Rs.)
                <input
                  type="number"
                  required
                  placeholder="e.g. 500"
                  value={promptAmount}
                  onChange={(e) => setPromptAmount(e.target.value)}
                />
              </label>
              <label>
                Description
                <input
                  type="text"
                  placeholder="e.g. Lunch, snacks, souvenirs"
                  value={promptDesc}
                  onChange={(e) => setPromptDesc(e.target.value)}
                />
              </label>
              <div className="collab-modal-actions">
                <button type="submit" className="saved-trip-primary-btn">Submit Expense</button>
                <button type="button" onClick={() => setExpensePromptPlace(null)} className="saved-trip-secondary-btn" style={{ background: "#64748b" }}>Skip</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="collab-hero">
        <div>
          <span className="live-pill">Live room - Trip #{tripId}</span>
          <h1>Plan & Travel together</h1>
          <p>Invite buddies, vote on ideas, track leader location in real-time, and log expenses easily.</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => setInviteOpen(true)} disabled={!isOwner}>Invite Buddies</button>
          {isOwner && (
            <>
              <button onClick={() => setShowFollowersCard(true)} style={{ background: "#10b981" }}>Link Followers</button>
              <button onClick={() => actions.setVotingLocked(!dashboard?.voting_locked)}>
                {dashboard?.voting_locked ? "Unlock voting" : "Lock voting"}
              </button>
            </>
          )}
        </div>
      </section>

      {error && <p className="collab-error">{error}</p>}
      {loading && <div className="collab-loading">Syncing collaboration room...</div>}

      {/* Members rail */}
      <section className="member-rail">
        {(dashboard?.members || []).map((member) => (
          <div className="member-chip" key={member.id}>
            <span style={{ background: member.role === "owner" ? "#fee2e2" : "#dbeafe", color: member.role === "owner" ? "#b91c1c" : "#1e3a8a" }}>
              {member.role === "owner" ? "👑" : member.username?.slice(0, 1).toUpperCase() || member.email?.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{member.username || member.email}</strong>
              <small>{member.role === "owner" ? "Leader" : member.role === "follower" ? "Buddy (Follower)" : member.role}</small>
            </div>
          </div>
        ))}
        {(dashboard?.pending_invitations || []).map((invite) => (
          <div className="member-chip pending" key={invite.id}>
            <span>✉️</span>
            <div>
              <strong>{invite.email}</strong>
              <small>pending {invite.role === "follower" ? "buddy" : invite.role}</small>
            </div>
          </div>
        ))}
      </section>

      {showFollowersCard && isOwner && (
        <section className="collab-section" style={{ maxWidth: "1180px", margin: "0 auto 18px" }}>
          <div className="link-follower-card" style={{
            maxWidth: "650px",
            margin: "20px auto",
            background: "rgba(255, 255, 255, 0.95)",
            padding: "25px",
            borderRadius: "16px",
            boxShadow: "0 6px 30px rgba(0, 0, 0, 0.15)",
            border: "1px solid #e2e8f0"
          }}>
            <h3 style={{ marginTop: 0, color: "#1e293b", fontSize: "20px", fontWeight: "600", marginBottom: "10px", textAlign: "center" }}>Link Follower (Optional)</h3>
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px", textAlign: "center" }}>
              Add travel buddies to your trip. They will be linked as followers. Send the invite code to their email, enter the code below to verify them, and click **Done** when finished.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "20px" }}>
              {followers.map((follower, index) => (
                <div key={index} style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                  position: "relative"
                }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", color: "#334155" }}>Buddy #{index + 1}</h4>
                  
                  {/* Email Input row */}
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="email"
                      placeholder="Follower's Email Address"
                      value={follower.email}
                      onChange={(e) => handleFollowerEmailChange(index, e.target.value)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px"
                      }}
                      disabled={follower.invited}
                      required
                    />
                    {!follower.invited && (
                      <button
                        type="button"
                        disabled={follower.loadingInvite}
                        onClick={() => handleSendInvite(index)}
                        className="saved-trip-primary-btn"
                        style={{ padding: "10px 18px", fontSize: "13px" }}
                      >
                        {follower.loadingInvite ? "Sending..." : "Send Invite"}
                      </button>
                    )}
                  </div>

                  {/* Verification Row (only visible if invited and not verified) */}
                  {follower.invited && !follower.verified && (
                    <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="6-digit OTP Code"
                        maxLength={6}
                        value={follower.otp}
                        onChange={(e) => handleFollowerOtpChange(index, e.target.value.replace(/\D/g, ""))}
                        style={{
                          width: "140px",
                          padding: "10px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px"
                        }}
                        disabled={follower.loadingVerify}
                      />
                      <button
                        type="button"
                        disabled={follower.loadingVerify}
                        onClick={() => handleVerifyOtp(index)}
                        className="saved-trip-primary-btn"
                        style={{ padding: "10px 18px", fontSize: "13px", background: "#10b981" }}
                      >
                        {follower.loadingVerify ? "Verifying..." : "Verify Code"}
                      </button>
                    </div>
                  )}

                  {/* Status / Success Messages */}
                  {follower.message && (
                    <div style={{ marginTop: "10px", color: "#16a34a", fontSize: "13px", fontWeight: "500" }}>
                      ✓ {follower.message}
                    </div>
                  )}
                  {follower.error && (
                    <div style={{ marginTop: "10px", color: "#dc2626", fontSize: "13px", fontWeight: "500" }}>
                      ⚠ {follower.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={addFollowerField}
                className="saved-trip-secondary-btn"
                style={{ padding: "10px 18px" }}
              >
                + Add More Buddy
              </button>
              
              <button
                type="button"
                onClick={handleDoneFinalizing}
                className="saved-trip-primary-btn"
                style={{ padding: "10px 24px", background: "#4f46e5" }}
              >
                Done
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 2. Live Location Map & Leader Location Simulator */}
      <section className="map-container-wrapper">
        <h3>📍 Leader Live Tracking Map</h3>
        <p style={{ fontSize: "14px", color: "#64748b", margin: "-6px 0 14px 0" }}>
          Red marker indicates the Leader's live location. Blue markers represent planned itinerary activities.
        </p>

        <MapContainer center={mapCenter} zoom={13}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          <ChangeMapView center={mapCenter} />

          {/* Activities plan markers */}
          {mapPlaces.map((place, idx) => (
            <Marker key={idx} position={[place.lat, place.lon]}>
              <Popup>
                <strong>{place.place_name}</strong><br />
                Day {place.day} - {place.time}
              </Popup>
            </Marker>
          ))}

          {/* Leader Marker */}
          {leaderLocation && (
            <Marker position={[leaderLocation.lat, leaderLocation.lon]} icon={leaderIcon}>
              <Popup>
                <strong>👑 Leader Location</strong><br />
                Last active: {new Date(leaderLocation.updated_at).toLocaleTimeString()}
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* Location Simulator Panel (Only visible to the leader) */}
        {isOwner && (
          <div className="simulator-panel">
            <h4>⚙️ Leader Location Simulator Panel</h4>
            <p style={{ fontSize: "12px", color: "#475569", margin: "-6px 0 10px 0" }}>
              Test proximity tracking: Teleport to place (triggers "arrival" broadcast) and simulation of moving away (triggers "left place" broadcast and expense logging modal).
            </p>
            {mapPlaces.length === 0 ? (
              <p style={{ color: "#ef4444", fontSize: "13px" }}>No places with coordinates are in the itinerary. Please edit saved trip to add coordinates first!</p>
            ) : (
              <div className="simulator-controls">
                <label style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  Destination:
                  <select
                    value={selectedSimPlaceIndex}
                    onChange={(e) => setSelectedSimPlaceIndex(Number(e.target.value))}
                    style={{ padding: "4px 8px" }}
                  >
                    {mapPlaces.map((place, idx) => (
                      <option key={idx} value={idx}>
                        Day {place.day}: {place.place_name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={handleSimulateArrive} className="saved-trip-primary-btn" style={{ padding: "6px 12px", background: "#059669" }}>
                  Teleport (Arrive)
                </button>
                <button type="button" onClick={handleSimulateLeave} className="saved-trip-danger-btn" style={{ padding: "6px 12px" }}>
                  Move Away (Leave)
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Expense Log & splits settlement table */}
      <section className="expense-section">
        <h3>💰 Trip Expenses & Bills Settlement</h3>
        <div className="expense-grid">
          
          {/* Expenses List */}
          <div className="expense-list-container">
            <h4>Logged Expenses</h4>
            <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
              <table className="expense-table">
                <thead>
                  <tr>
                    <th>Who</th>
                    <th>Where</th>
                    <th>Amount</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {(expensesData.expenses || []).length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", color: "#64748b" }}>No expenses logged yet.</td>
                    </tr>
                  ) : (
                    expensesData.expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td><strong>{exp.username}</strong></td>
                        <td>{exp.place_name}</td>
                        <td>Rs. {exp.amount}</td>
                        <td style={{ color: "#64748b", fontSize: "12px" }}>{exp.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Manual expense submission */}
            <form onSubmit={handleManualExpenseSubmit} className="expense-form">
              <h4>Log Custom Expense</h4>
              <div className="expense-form-row">
                <input
                  type="text"
                  placeholder="Place Name"
                  required
                  value={manualPlace}
                  onChange={(e) => setManualPlace(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Amount (Rs.)"
                  required
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                />
              </div>
              <input
                type="text"
                placeholder="Description (Optional)"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
              />
              <button type="submit" className="saved-trip-primary-btn" style={{ alignSelf: "flex-end" }}>Add Expense</button>
            </form>
          </div>

          {/* Expense Split & settlement calculations */}
          <div className="expense-split-container">
            <h4>Bill Split Summary</h4>
            <div className="split-summary-box">
              <div className="split-summary-item">
                <span>Total Spent</span>
                <strong>Rs. {expensesData.total_spent || 0}</strong>
              </div>
              <div className="split-summary-item">
                <span>Per-Person Share</span>
                <strong>Rs. {expensesData.share_per_person || 0}</strong>
              </div>
            </div>

            <h4>How to Settle the Bills</h4>
            {(expensesData.splits || []).length === 0 ? (
              <p style={{ color: "#059669", fontStyle: "italic", fontSize: "14px", marginTop: "10px" }}>
                Everyone is even! No transactions required.
              </p>
            ) : (
              <ul className="splits-list">
                {expensesData.splits.map((split, idx) => (
                  <li key={idx}>
                    <strong>{split.from_username}</strong> owes <strong>{split.to_username}</strong> Rs. {split.amount}
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </section>

      {/* Decision strips and suggestion components */}
      <DecisionSummary decisions={decisions} />
      <VotingBoard groupedSuggestions={groupedSuggestions} onVote={actions.vote} onReact={actions.react} onFinalize={actions.finalize} canFinalize={isOwner} />
      {canEdit && <SuggestionFeed suggestions={suggestions} onAddSuggestion={actions.addSuggestion} onComment={actions.comment} />}
      <ActivityRanking activities={activities} onRank={actions.rank} />
    </main>
  );
}
