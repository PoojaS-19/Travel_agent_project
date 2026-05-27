import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const fetchTrips = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await API.get("/itineraries");
      const loadedTrips = response.data.itineraries || [];
      setTrips(loadedTrips);
      setSelectedTrip((current) => {
        if (!loadedTrips.length) return null;
        if (!current) return loadedTrips[0];
        return loadedTrips.find((trip) => trip.id === current.id) || loadedTrips[0];
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
                    <span>{trip.start_city || "Starting city not set"}</span>
                    <small>{new Date(trip.created_at).toLocaleDateString()}</small>
                  </button>
                  <button
                    type="button"
                    className="saved-trip-card-collaborate"
                    onClick={() => navigate(`/collaborate/${trip.id}`)}
                  >
                    Collaborate
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
                  <p>
                    From {selectedTrip.start_city || "not specified"} · Saved{" "}
                    {new Date(selectedTrip.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="saved-trip-actions">
                  <button
                    onClick={() => startEditing(selectedTrip)}
                    className="saved-trip-primary-btn"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => navigate(`/collaborate/${selectedTrip.id}`)}
                    className="saved-trip-secondary-btn"
                  >
                    Collaborate
                  </button>
                  <button
                    onClick={() => deleteTrip(selectedTrip.id)}
                    className="saved-trip-danger-btn"
                  >
                    Delete
                  </button>
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

                              {editingActivity?.dayIndex === selectedTrip.daily_plans.indexOf(day)
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
