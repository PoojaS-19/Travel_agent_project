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
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");

  const handleSearchClick = () => {
    setError("");
    if (!from || !to || !date) {
      setError("Please fill in all fields (From, To, and Date).");
      return;
    }
    setShowModal(true);
  };

  const handleContinue = () => {
    localStorage.setItem("trainSearchData", JSON.stringify({ from, to, date }));
    window.open("https://www.irctc.co.in/nget/train-search", "_blank");
    setShowModal(false);
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

          <button className="search-btn-enhanced" onClick={handleSearchClick} style={{ background: "linear-gradient(135deg, #ff5722 0%, #d84315 100%)", boxShadow: "0 8px 20px rgba(216, 67, 21, 0.3)" }}>
            Find Trains
          </button>
        </div>
      </div>

      {/* RESULTS SECTION */}
      <div className="train-results-enhanced" style={{ maxWidth: "600px", margin: "0 auto" }}>
        {error && (
          <div className="error" style={{ 
            textAlign: "center", 
            width: "100%", 
            padding: "15px", 
            background: "rgba(255, 87, 34, 0.1)", 
            color: "#d84315",
            borderRadius: "8px", 
            fontWeight: "bold",
            border: "1px solid rgba(255, 87, 34, 0.3)",
            marginTop: "20px"
          }}>
            {error}
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {showModal && (
        <div className="irctc-modal-overlay">
          <div className="irctc-modal">
            <div className="irctc-modal-icon">🎫</div>
            <h3>Secure Booking</h3>
            <p>You will be redirected to IRCTC for secure booking.</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="continue-btn" onClick={handleContinue}>Continue</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
