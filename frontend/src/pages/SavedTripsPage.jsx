import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../api";
import "../App.css";

const emptyEditForm = {
  start_city: "",
  destination: "",
  itinerary_text: "",
  language: "English"
};

const emptyActivityForm = {
  time: "",
  place_name: "",
  category: "Attraction",
  description: "",
  cost: "",
  lat: "",
  lon: ""
};

export default function SavedTripsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tripIdFromUrl = searchParams.get("id");
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [activityForm, setActivityForm] = useState(emptyActivityForm);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const tripStats = useMemo(() => {
    const days = selectedTrip?.daily_plans?.length || 0;
    const activities = selectedTrip?.daily_plans?.reduce(
      (total, day) => total + (day.activities?.length || 0),
      0
    ) || 0;
    return { days, activities };
  }, [selectedTrip]);

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleJoinTripWithOTP = async () => {
    if (otpCode.length !== 6) {
      setOtpError("Please enter a 6-digit code.");
      return;
    }
    setOtpError("");
    setOtpLoading(true);
    try {
      const response = await API.post("/api/collaboration/invitations/accept-otp", { otp_code: otpCode });
      const tripId = response.data.trip_id;
      setMessage("Joined trip successfully!");
      setOtpCode("");
      await fetchTrips();
      navigate(`/collaborate/${tripId}`);
    } catch (err) {
      console.error(err);
      setOtpError(err.response?.data?.detail || "Could not verify code.");
    } finally {
      setOtpLoading(false);
    }
  };

  const fetchTrips = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await API.get("/itineraries");
      const loadedTrips = response.data.itineraries || [];
      setTrips(loadedTrips);
      setSelectedTrip((current) => {
        if (!loadedTrips.length) return null;
        if (tripIdFromUrl) {
          const found = loadedTrips.find((trip) => trip.id === Number(tripIdFromUrl));
          if (found) return found;
        }
        if (current) {
          return loadedTrips.find((trip) => trip.id === current.id) || null;
        }
        return null;
      });
    } catch (err) {
      console.error("Saved trips error:", err);
      setError(err.response?.data?.detail || "Please login to view saved trips.");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (trip) => {
    setSelectedTrip(trip);
    setEditForm({
      start_city: trip.start_city || "",
      destination: trip.destination || "",
      itinerary_text: trip.itinerary_text || "",
      language: trip.language || "English"
    });
    setMessage("");
    setError("");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm(emptyEditForm);
  };

  const startEditingActivity = (dayIndex, activityIndex, activity) => {
    setEditingActivity({ dayIndex, activityIndex });
    setActivityForm({
      time: activity.time || "",
      place_name: activity.place_name || "",
      category: activity.category || "Attraction",
      description: activity.description || "",
      cost: activity.cost || "",
      lat: activity.lat ?? "",
      lon: activity.lon ?? ""
    });
    setError("");
    setMessage("");
  };

  const cancelEditingActivity = () => {
    setEditingActivity(null);
    setActivityForm(emptyActivityForm);
  };

  const saveTrip = async (e) => {
    e.preventDefault();
    if (!selectedTrip) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await API.put(`/itineraries/${selectedTrip.id}`, editForm);
      const updatedTrip = response.data;
      setTrips((current) => current.map((trip) => (
        trip.id === updatedTrip.id ? updatedTrip : trip
      )));
      setSelectedTrip(updatedTrip);
      setIsEditing(false);
      setMessage("Trip updated successfully.");
    } catch (err) {
      console.error("Update trip error:", err);
      setError(err.response?.data?.detail || "Could not update this trip.");
    } finally {
      setSaving(false);
    }
  };

  const deleteTrip = async (tripId) => {
    const shouldDelete = window.confirm("Delete this saved trip?");
    if (!shouldDelete) return;

    setError("");
    setMessage("");

    try {
      await API.delete(`/itineraries/${tripId}`);
      const remainingTrips = trips.filter((trip) => trip.id !== tripId);
      setTrips(remainingTrips);
      setSelectedTrip(remainingTrips[0] || null);
      setIsEditing(false);
      setMessage("Trip deleted successfully.");
    } catch (err) {
      console.error("Delete trip error:", err);
      setError(err.response?.data?.detail || "Could not delete this trip.");
    }
  };

  const saveActivity = async (e) => {
    e.preventDefault();
    if (!selectedTrip || !editingActivity) return;

    const updatedDailyPlans = (selectedTrip.daily_plans || []).map((day, dayIndex) => {
      if (dayIndex !== editingActivity.dayIndex) return day;

      return {
        ...day,
        activities: (day.activities || []).map((activity, activityIndex) => {
          if (activityIndex !== editingActivity.activityIndex) return activity;

          return {
            ...activity,
            ...activityForm,
            lat: activityForm.lat === "" ? null : Number(activityForm.lat),
            lon: activityForm.lon === "" ? null : Number(activityForm.lon)
          };
        })
      };
    });

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await API.put(`/itineraries/${selectedTrip.id}`, {
        daily_plans: updatedDailyPlans
      });
      const updatedTrip = response.data;
      setTrips((current) => current.map((trip) => (
        trip.id === updatedTrip.id ? updatedTrip : trip
      )));
      setSelectedTrip(updatedTrip);
      cancelEditingActivity();
      setMessage("Place updated successfully.");
    } catch (err) {
      console.error("Update place error:", err);
      setError(err.response?.data?.detail || "Could not update this place.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="saved-trips-page">
      <div className="saved-trips-shell">
        <section className="saved-trips-sidebar">
          <div className="saved-trips-heading">
            <h1>Saved Trips</h1>
            <button onClick={fetchTrips} className="saved-trip-secondary-btn">
              Refresh
            </button>
          </div>

          <div className="join-trip-otp-card" style={{ marginBottom: "20px", padding: "12px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", background: "rgba(255,255,255,0.05)" }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "14px" }}>Join Trip with Invite Code</h4>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="6-digit OTP"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                style={{ flex: 1, padding: "6px 10px", fontSize: "13px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white" }}
              />
              <button
                type="button"
                onClick={handleJoinTripWithOTP}
                disabled={otpLoading}
                className="saved-trip-primary-btn"
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                {otpLoading ? "Joining..." : "Join"}
              </button>
            </div>
            {otpError && <p style={{ color: "#ef4444", fontSize: "11px", margin: "4px 0 0 0" }}>{otpError}</p>}
          </div>

          {loading ? (
            <p className="saved-trip-muted">Loading your trips...</p>
          ) : trips.length === 0 ? (
            <div className="saved-trip-empty">
              <h3>No saved trips yet</h3>
              <p>Generate an itinerary while logged in and it will appear here.</p>
            </div>
          ) : (
            <div className="saved-trip-list">
              {trips.map((trip) => (
                <div
                  key={trip.id}
                  className={`saved-trip-list-item ${selectedTrip?.id === trip.id ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="saved-trip-list-main"
                    onClick={() => {
                      setSelectedTrip(trip);
                      setIsEditing(false);
                      cancelEditingActivity();
                      setMessage("");
                    }}
                  >
                    <strong>{trip.destination || "Untitled Trip"}</strong>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="saved-trip-detail">
          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          {!selectedTrip ? (
            <div className="saved-trip-empty large">
              <h2>Select a trip</h2>
              <p>Your trip details, day plan, edit tools, and delete action will show here.</p>
            </div>
          ) : (
            <>
              <div className="saved-trip-detail-header">
                <div>
                  <p className="saved-trip-kicker">{selectedTrip.language || "English"} itinerary</p>
                  <h2>{selectedTrip.destination || "Untitled Trip"}</h2>
                  {selectedTrip.is_shared && (
                    <p className="saved-trip-shared-note">
                      Shared with you as {selectedTrip.collaboration_role}. Open Collaborate to plan with the group.
                    </p>
                  )}
                  {selectedTrip.members && selectedTrip.members.length > 0 && (
                    <div className="saved-trip-members" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px", marginBottom: "12px" }}>
                      {selectedTrip.members.map((member, idx) => (
                        <div 
                          key={idx} 
                          className="trip-member-chip" 
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            background: "rgba(255, 255, 255, 0.08)",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            border: "1px solid rgba(255, 255, 255, 0.15)",
                            fontSize: "13px",
                            color: "white"
                          }}
                        >
                          <span style={{ 
                            background: member.role.toLowerCase() === "owner" ? "#fee2e2" : "#dbeafe", 
                            color: member.role.toLowerCase() === "owner" ? "#b91c1c" : "#1e3a8a",
                            borderRadius: "50%",
                            width: "24px",
                            height: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                            fontSize: "12px",
                            flexShrink: 0
                          }}>
                            {member.role.toLowerCase() === "owner" ? "👑" : (member.username?.slice(0, 1).toUpperCase() || member.email?.slice(0, 1).toUpperCase())}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                            <strong style={{ fontWeight: "600", color: "white" }}>
                              {member.username || member.email || "Unknown User"}
                            </strong>
                            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
                              {member.role.toLowerCase() === "owner" ? "Leader" : member.role.toLowerCase() === "follower" ? "Buddy (Follower)" : member.role.toLowerCase() === "editor" ? "Editor" : member.role}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p>
                    From {selectedTrip.start_city || "not specified"} · Saved{" "}
                    {new Date(selectedTrip.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="saved-trip-actions">
                  {selectedTrip.can_edit !== false && (
                    <button
                      onClick={() => startEditing(selectedTrip)}
                      className="saved-trip-primary-btn"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/collaborate/${selectedTrip.id}`)}
                    className="saved-trip-secondary-btn"
                  >
                    Collaborate
                  </button>
                  {selectedTrip.can_edit !== false && (
                    <button
                      onClick={() => deleteTrip(selectedTrip.id)}
                      className="saved-trip-danger-btn"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="saved-trip-stats">
                <div>
                  <strong>{tripStats.days}</strong>
                  <span>Days</span>
                </div>
                <div>
                  <strong>{tripStats.activities}</strong>
                  <span>Activities</span>
                </div>
                <div>
                  <strong>{selectedTrip.start_city || "Any"}</strong>
                  <span>Start</span>
                </div>
              </div>

              {isEditing ? (
                <form onSubmit={saveTrip} className="saved-trip-edit-form">
                  <div className="saved-trip-form-row">
                    <label>
                      Starting City
                      <input
                        value={editForm.start_city}
                        onChange={(e) => setEditForm({ ...editForm, start_city: e.target.value })}
                        placeholder="Mumbai"
                      />
                    </label>
                    <label>
                      Destination
                      <input
                        value={editForm.destination}
                        onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })}
                        placeholder="Goa"
                      />
                    </label>
                  </div>

                  <label>
                    Language
                    <select
                      value={editForm.language}
                      onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                    >
                      <option value="English">English</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Marathi">Marathi</option>
                    </select>
                  </label>

                  <label>
                    Trip Summary
                    <textarea
                      value={editForm.itinerary_text}
                      onChange={(e) => setEditForm({ ...editForm, itinerary_text: e.target.value })}
                      rows={7}
                      placeholder="Update your trip summary"
                    />
                  </label>

                  <div className="saved-trip-actions">
                    <button type="submit" disabled={saving} className="saved-trip-primary-btn">
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button type="button" onClick={cancelEditing} className="saved-trip-secondary-btn">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="saved-trip-summary">
                  <h3>Trip Summary</h3>
                  <p>{selectedTrip.itinerary_text || "No summary saved for this trip."}</p>
                </div>
              )}

              <div className="saved-trip-days">
                <h3>Day Details</h3>
                {selectedTrip.daily_plans?.length ? (
                  selectedTrip.daily_plans.map((day) => (
                    <article key={day.day} className="saved-trip-day-card">
                      <h4>Day {day.day}{day.date ? ` · ${day.date}` : ""}</h4>
                      <div className="saved-trip-activity-list">
                        {(day.activities || []).map((activity, index) => (
                          <div key={`${day.day}-${index}`} className="saved-trip-activity">
                            <span>{activity.time || "Flexible"}</span>
                            <div>
                              <strong>{activity.place_name || "Activity"}</strong>
                              <p>{activity.description || "No description available."}</p>
                              <small>{activity.category || "Travel"}{activity.cost ? ` · ${activity.cost}` : ""}</small>
                              {selectedTrip.can_edit !== false && (
                                <button
                                  type="button"
                                  className="saved-trip-inline-btn"
                                  onClick={() => startEditingActivity(
                                    selectedTrip.daily_plans.indexOf(day),
                                    index,
                                    activity
                                  )}
                                >
                                  Edit Place
                                </button>
                              )}

                              {selectedTrip.can_edit !== false
                                && editingActivity?.dayIndex === selectedTrip.daily_plans.indexOf(day)
                                && editingActivity?.activityIndex === index && (
                                <form onSubmit={saveActivity} className="saved-place-edit-form">
                                  <div className="saved-trip-form-row">
                                    <label>
                                      Time
                                      <input
                                        value={activityForm.time}
                                        onChange={(e) => setActivityForm({ ...activityForm, time: e.target.value })}
                                        placeholder="09:00 AM"
                                      />
                                    </label>
                                    <label>
                                      Place Name
                                      <input
                                        value={activityForm.place_name}
                                        onChange={(e) => setActivityForm({ ...activityForm, place_name: e.target.value })}
                                        placeholder="Gateway of India"
                                      />
                                    </label>
                                  </div>

                                  <div className="saved-trip-form-row">
                                    <label>
                                      Category
                                      <select
                                        value={activityForm.category}
                                        onChange={(e) => setActivityForm({ ...activityForm, category: e.target.value })}
                                      >
                                        <option value="Food">Food</option>
                                        <option value="Attraction">Attraction</option>
                                        <option value="Travel">Travel</option>
                                        <option value="Relax">Relax</option>
                                        <option value="Shopping">Shopping</option>
                                        <option value="History">History</option>
                                      </select>
                                    </label>
                                    <label>
                                      Cost
                                      <input
                                        value={activityForm.cost}
                                        onChange={(e) => setActivityForm({ ...activityForm, cost: e.target.value })}
                                        placeholder="Rs. 500"
                                      />
                                    </label>
                                  </div>

                                  <label>
                                    Description
                                    <textarea
                                      value={activityForm.description}
                                      onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                                      rows={4}
                                      placeholder="Describe the updated place or activity"
                                    />
                                  </label>

                                  <div className="saved-trip-form-row">
                                    <label>
                                      Latitude
                                      <input
                                        type="number"
                                        step="any"
                                        value={activityForm.lat}
                                        onChange={(e) => setActivityForm({ ...activityForm, lat: e.target.value })}
                                        placeholder="18.9220"
                                      />
                                    </label>
                                    <label>
                                      Longitude
                                      <input
                                        type="number"
                                        step="any"
                                        value={activityForm.lon}
                                        onChange={(e) => setActivityForm({ ...activityForm, lon: e.target.value })}
                                        placeholder="72.8347"
                                      />
                                    </label>
                                  </div>

                                  <div className="saved-trip-actions">
                                    <button type="submit" disabled={saving} className="saved-trip-primary-btn">
                                      {saving ? "Saving..." : "Save Place"}
                                    </button>
                                    <button type="button" onClick={cancelEditingActivity} className="saved-trip-secondary-btn">
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="saved-trip-muted">No day-wise plan saved for this trip.</p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
