import { useState, useEffect, useRef } from "react";
import API from "../api";
import "../App.css";
import MapComponent from "../components/MapComponent";
import { CITIES } from "../data/cities";

// --- AUTOCOMPLETE COMPONENT ---
function CityAutocomplete({ placeholder, value, onChange }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCities = CITIES.filter((c) =>
    c.name.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef} style={{ width: "100%", marginBottom: "15px" }}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd" }}
      />
      {showSuggestions && value.length > 0 && (
        <div className="suggestions-dropdown">
          {filteredCities.length > 0 ? (
            filteredCities.map((c, i) => (
              <div
                key={i}
                className="suggestion-item"
                onClick={() => {
                  onChange(c.name);
                  setShowSuggestions(false);
                }}
              >
                <div className="city-name">{c.name}</div>
              </div>
            ))
          ) : (
            <div className="suggestion-item" style={{ cursor: "default" }}>
              No cities found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const renderActivityIcon = (category) => {
  const icons = {
    "Food": "🍽️",
    "Attraction": "🎡",
    "Travel": "🚗",
    "Relax": "🏖️",
    "Shopping": "🛍️",
    "History": "castle",
  };
  // Fallback
  const icon = icons[category] || "📍";

  // Return a styled span 
  return (
    <div className="activity-icon-box">
      <span className="activity-icon">{icon}</span>
    </div>
  );
};

export default function ItineraryPage({ language, chatItinerary, chatDailyPlans }) {

  const [form, setForm] = useState({
    start_city: "",
    destination: "",
    days: "",
    theme: "",
    preferences: "",
  });

  const [result, setResult] = useState("");
  const [dailyPlans, setDailyPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const printRef = useRef();

  useEffect(() => {
    if (chatItinerary) {
      setResult(chatItinerary);
    }
  }, [chatItinerary]);

  useEffect(() => {
    if (chatDailyPlans && chatDailyPlans.length > 0) {
      setDailyPlans(chatDailyPlans);
    }
  }, [chatDailyPlans]);

  const submit = async () => {
    setLoading(true);
    setResult("");
    setDailyPlans([]);

    try {
      const res = await API.post("/itinerary", {
        ...form,
        language
      });

      const data = res.data;
      if (data.daily_plans) {
        setResult(data.itinerary_text);
        setDailyPlans(data.daily_plans);
      } else {
        // Fallback for old format or error
        setResult(data.itinerary || data);
      }

    } catch {
      setResult("Error generating itinerary.");
    }
    setLoading(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(result);
    alert("Copied!");
  };

  const downloadText = () => {
    const blob = new Blob([result], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "itinerary.txt";
    a.click();
  };

  return (
    <div className="itinerary-page">

      <h2 className="page-title">AI Travel Itinerary Planner</h2>

      {/* FORM */}
      <div className="itinerary-form">

        {/* Replaced Input with CityAutocomplete */}
        <CityAutocomplete
          placeholder="Starting City (e.g. Mumbai)"
          value={form.start_city}
          onChange={(val) => setForm({ ...form, start_city: val })}
        />

        <CityAutocomplete
          placeholder="Destination (e.g. Paris)"
          value={form.destination}
          onChange={(val) => setForm({ ...form, destination: val })}
        />

        <div className="row">
          <input
            type="number"
            placeholder="Days"
            value={form.days}
            onChange={(e) => setForm({ ...form, days: e.target.value })}
          />

          <input
            placeholder="Theme"
            value={form.theme}
            onChange={(e) => setForm({ ...form, theme: e.target.value })}
          />
        </div>

        <textarea
          placeholder="Preferences"
          value={form.preferences}
          onChange={(e) => setForm({ ...form, preferences: e.target.value })}
        />

        <button onClick={submit}>
          {loading ? "Generating..." : "Generate Itinerary"}
        </button>
      </div>

      {/* ACTIONS */}
      {result && (
        <div className="result-actions">
          <button onClick={copyToClipboard}>Copy</button>
          <button onClick={downloadText}>Download</button>
        </div>
      )}

      {/* OUTPUT BOARD */}
      <div className="output-section">
        <div className="output-board" ref={printRef}>
          {result && dailyPlans.length > 0 ? (
            <div className="itinerary-timeline">
              {dailyPlans.map((dayPlan, index) => (
                <div key={index} className="day-section">
                  <h3 className="day-header">Day {dayPlan.day}</h3>

                  <div className="activities-list">
                    {dayPlan.activities.map((activity, actIndex) => (
                      <div key={actIndex} className="activity-card">

                        <div className="activity-time-col">
                          <span className="activity-time">{activity.time}</span>
                          <div className="time-connector"></div>
                        </div>

                        <div className="activity-content">
                          <div className="activity-header">
                            {renderActivityIcon(activity.category)}
                            <h4>{activity.place_name}</h4>
                          </div>

                          <p className="activity-description">{activity.description}</p>

                          <div className="activity-footer">
                            {activity.cost && <span className="activity-cost">{activity.cost}</span>}
                            <a
                              href={`https://www.google.com/search?q=${encodeURIComponent(activity.place_name + " " + form.destination)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="book-tour-btn"
                            >
                              <i className="fas fa-ticket-alt"></i> Book a Tour
                            </a>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>

                  {/* Map for this day */}
                  <div className="day-map-container">
                    <MapComponent activities={dayPlan.activities} />
                  </div>

                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              {result ? <pre className="output-text">{result}</pre> : "Your generated itinerary will appear here."}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
