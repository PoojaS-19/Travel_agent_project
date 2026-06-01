import { useState, useRef, useEffect } from "react";
import API from "../api";
import "../App.css";

// --- DATA CONSTANTS ---
const CITY_DATA = [
  { code: "BOM", name: "Mumbai, India" },
  { code: "DEL", name: "New Delhi, India" },
  { code: "BLR", name: "Bengaluru, India" },
  { code: "MAA", name: "Chennai, India" },
  { code: "CCU", name: "Kolkata, India" },
  { code: "HYD", name: "Hyderabad, India" },
  { code: "GOI", name: "Goa, India" },
  { code: "DXB", name: "Dubai, UAE" },
  { code: "LHR", name: "London, UK" },
  { code: "JFK", name: "New York, USA" },
  { code: "SIN", name: "Singapore" },
  { code: "BKK", name: "Bangkok, Thailand" },
];

const AIRLINE_MAP = {
  "AI": "Air India",
  "6E": "Indigo",
  "UK": "Vistara",
  "SG": "SpiceJet",
  "QP": "Akasa Air",
  "IX": "Air India Express",
};

// --- AUTOCOMPLETE COMPONENT ---
function AutocompleteInput({ placeholder, value, onChange }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCities = CITY_DATA.filter((city) =>
    city.name.toLowerCase().includes(value.toLowerCase()) ||
    city.code.toLowerCase().includes(value.toLowerCase())
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
          {filteredCities.length > 0 ? (
            filteredCities.map((city) => (
              <div
                key={city.code}
                className="suggestion-item"
                onClick={() => {
                  onChange(city.code);
                  setShowSuggestions(false);
                }}
              >
                <div className="city-name">{city.name}</div>
                <div className="city-code">{city.code}</div>
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

// --- MAIN PAGE ---
export default function FlightsPage() {
  const [form, setForm] = useState({
    source: "",
    destination: "",
    departure: "",
    // return_date removed from UI state, calculated on submit
  });

  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchFlights = async () => {
    if (!form.source || !form.destination || !form.departure) {
      alert("Please fill in Source, Destination and Date");
      return;
    }
    setLoading(true);
    try {
      // Auto-calculate return date (e.g. +2 days) for backend requirement
      const depDate = new Date(form.departure);
      const retDate = new Date(depDate);
      retDate.setDate(depDate.getDate() + 2);
      const retDateStr = retDate.toISOString().split('T')[0];

      const q = `source=${form.source}&destination=${form.destination}&departure=${form.departure}&return_date=${retDateStr}`;
      const res = await API.get(`/flights?${q}`);
      setFlights(Array.isArray(res.data) ? res.data : []);
    } catch {
      alert("Error fetching flights");
    }
    setLoading(false);
  };

  // Helper to format duration or specific times if missing
  const getDuration = (start, end) => {
    // Mock logic for display if data is simple string
    if (start && end && start.includes("T") && end.includes("T")) {
      const t1 = new Date(start);
      const t2 = new Date(end);
      const diffMs = t2 - t1;
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffMins = Math.round((diffMs % 3600000) / 60000);
      return `${diffHrs}h ${diffMins}m`;
    }
    return "2h 30m";
  };

  const formatTime = (isoString) => {
    if (!isoString) return "--:--";
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAirlineName = (code) => AIRLINE_MAP[code] || code;

  return (
    <div className="flights-page">

      {/* HERO SECTION */}
      <div className="flight-hero">
        <h1>Book Your Flights</h1>
        <p>Find the best airfare deals worldwide with premium comfort.</p>

        <div className="flight-search-container">

          <div className="input-with-icon">
            <span className="input-icon">🛫</span>
            <AutocompleteInput
              placeholder="From (e.g. BOM)"
              value={form.source}
              onChange={(val) => setForm({ ...form, source: val })}
            />
          </div>

          <div className="input-with-icon">
            <span className="input-icon">🛬</span>
            <AutocompleteInput
              placeholder="To (e.g. DEL)"
              value={form.destination}
              onChange={(val) => setForm({ ...form, destination: val })}
            />
          </div>

          <div className="input-with-icon">
            <span className="input-icon">📅</span>
            <input
              type="date"
              className="date-input"
              value={form.departure}
              onChange={(e) => setForm({ ...form, departure: e.target.value })}
            />
          </div>

          <button className="search-btn-enhanced" onClick={searchFlights}>
            {loading ? "Searching..." : "Search Flights"}
          </button>
        </div>
      </div>

      {/* RESULTS SECTION */}
      <div className="flight-results-enhanced">
        {flights.map((f, i) => (
          <div className="flight-card-enhanced" key={i}>
            {/* Header: Airline & Price */}
            <div className="card-header-row">
              <div className="airline-info">
                <div className="airline-logo-placeholder">
                  {/* Logo / Code fallback */}
                  {f.airline}
                </div>
                <div className="airline-name">
                  {getAirlineName(f.airline)}
                </div>
              </div>
              <div className="flight-price">
                ₹{f.price}
              </div>
            </div>

            {/* Route Info */}
            <div className="flight-route-row">
              <div className="route-point">
                <span className="route-time">{formatTime(f.departure)}</span>
                <span className="route-city">{form.source || "Origin"}</span>
              </div>

              <div className="route-line">
                <span className="plane-icon">✈</span>
              </div>

              <div className="route-point">
                <span className="route-time">{formatTime(f.arrival)}</span>
                <span className="route-city">{form.destination || "Dest"}</span>
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="flight-actions">
              <button className="book-btn-small">Select Flight</button>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
