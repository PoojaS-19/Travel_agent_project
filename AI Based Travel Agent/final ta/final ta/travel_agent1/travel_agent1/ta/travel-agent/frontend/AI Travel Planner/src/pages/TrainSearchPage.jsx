import { useState, useRef, useEffect } from "react";
import API from "../api";
import "../App.css";
import { ALL_STATIONS } from "../data/stations";

// --- AUTOCOMPLETE COMPONENT (Local copy for speed/independence) ---
function StationAutocomplete({ placeholder, value, onChange }) {
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

  const filteredStations = ALL_STATIONS.filter((st) =>
    st.name.toLowerCase().includes(value.toLowerCase()) ||
    st.code.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
      />
      {showSuggestions && value.length > 0 && (
        <div className="suggestions-dropdown">
          {filteredStations.length > 0 ? (
            filteredStations.map((st) => (
              <div
                key={st.code}
                className="suggestion-item"
                onClick={() => {
                  onChange(st.code);
                  setShowSuggestions(false);
                }}
              >
                <div className="city-name">{st.name}</div>
                <div className="city-code">{st.code}</div>
              </div>
            ))
          ) : (
            <div className="suggestion-item" style={{ cursor: "default" }}>
              No stations found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrainSearchPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    setLoading(true);
    setError("");
    setTrains([]);
    try {
      // Pass from/to codes directly
      const res = await API.get("/trains", {
        params: { from_code: from, to_code: to, date },
      });

      const data = res.data;
      const list = data.trains || data.data || [];
      setTrains(list);
    } catch (err) {
      setError("Failed to fetch trains.");
      console.error(err);
    }
    setLoading(false);
  };

  const getStationName = (code) => {
    const st = ALL_STATIONS.find(s => s.code === code);
    return st ? st.name : code;
  };

  return (
    <div className="train-page-modern">
      {/* (Using a wrapper class if needed, or just rely on global body styles. 
          The flight page used .flights-page wrapper with bg image. 
          Let's use a div with matching hero logic.) */}

      {/* HERO SECTION */}
      <div className="train-hero">
        <h1>Search Trains</h1>
        <p>Book train tickets seamlessly across the country.</p>

        <div className="flight-search-container">
          <div className="input-with-icon">
            <span className="input-icon">🚉</span>
            <StationAutocomplete
              placeholder="From (e.g. CSTM)"
              value={from}
              onChange={setFrom}
            />
          </div>

          <div className="input-with-icon">
            <span className="input-icon">🏁</span>
            <StationAutocomplete
              placeholder="To (e.g. NDLS)"
              value={to}
              onChange={setTo}
            />
          </div>

          <div className="input-with-icon">
            <span className="input-icon">📅</span>
            <input
              type="date"
              className="date-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <button className="search-btn-enhanced" onClick={search} style={{ background: "linear-gradient(135deg, #ff5722 0%, #d84315 100%)", boxShadow: "0 8px 20px rgba(216, 67, 21, 0.3)" }}>
            {loading ? "Searching..." : "Find Trains"}
          </button>
        </div>
      </div>

      {/* RESULTS SECTION */}
      <div className="train-results-enhanced">
        {error && <div className="error" style={{ textAlign: "center", width: "100%" }}>{error}</div>}

        {trains.map((t, i) => (
          <div className="train-card-enhanced" key={i}>
            {/* Header */}
            <div className="card-header-row">
              <div className="airline-info">
                <div className="train-icon-placeholder">
                  🚆
                </div>
                <div>
                  <div className="airline-name">{t.train_name}</div>
                  <div style={{ fontSize: "14px", color: "#888" }}>#{t.train_no}</div>
                </div>
              </div>
              <div className="train-price">
                {t.price || "₹--"}
              </div>
            </div>

            {/* Route Info */}
            <div className="flight-route-row">
              <div className="route-point">
                <span className="route-time">{t.departure}</span>
                <span className="route-city">{getStationName(t.from)}</span>
              </div>

              <div className="route-line">
                <span className="duration-badge">{t.duration}</span>
              </div>

              <div className="route-point">
                <span className="route-time">{t.arrival}</span>
                <span className="route-city">{getStationName(t.to)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="train-meta">
              <span>Class: SL, 3A, 2A, 1A</span>
              <span style={{ color: "#4caf50", fontWeight: "bold" }}>Available</span>
            </div>

            <div className="flight-actions" style={{ marginTop: "20px" }}>
              <button className="book-btn-small" style={{ backgroundColor: "#ff5722" }}>Book Ticket</button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
