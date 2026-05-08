import { useState, useRef, useEffect } from "react";
import API from "../api";
import "../App.css";

export default function TrainSearchPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const search = async () => {
    setLoading(true);
    setError("");
    setTrains([]);
    
    if (!from || !to) {
      setError("Please fill in both From and To fields.");
      setLoading(false);
      return;
    }

    try {
      const res = await API.get("/trains", {
        params: { 
          source: from, 
          destination: to, 
          date: date,
          type: type || undefined,
          sort: "departure"
        },
      });

      const data = res.data;
      if (data.trains && data.trains.length > 0) {
        setTrains(data.trains);
      } else {
        setError("No trains found for this route.");
      }
    } catch (err) {
      setError("Failed to fetch trains. Backend might be unavailable.");
      console.error(err);
    }
    setLoading(false);
  };

  const handleBookClick = () => {
    setShowModal(true);
  };

  const handleContinue = () => {
    localStorage.setItem("trainSearchData", JSON.stringify({ from, to, date, type }));
    window.open("https://www.irctc.co.in/nget/train-search", "_blank");
    setShowModal(false);
  };

  return (
    <div className="train-page-modern">
      {/* HERO SECTION */}
      <div className="train-hero">
        <h1>Book Your Train Tickets</h1>
        <p>Find best trains across India</p>

        <div className="flight-search-container" style={{ flexWrap: "wrap", justifyContent: "center" }}>
          <div className="input-with-icon">
            <span className="input-icon">🚉</span>
            <input 
              type="text"
              placeholder="From (e.g. Mumbai)"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", width: "100%" }}
            />
          </div>

          <div className="input-with-icon">
            <span className="input-icon">🏁</span>
            <input 
              type="text"
              placeholder="To (e.g. Delhi)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", width: "100%" }}
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
          
          <div className="input-with-icon" style={{ minWidth: "150px" }}>
            <span className="input-icon">🚆</span>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", width: "100%", padding: "5px" }}
            >
              <option value="">All Types</option>
              <option value="Express">Express</option>
              <option value="Passenger">Passenger</option>
              <option value="Superfast">Superfast</option>
            </select>
          </div>

          <button className="search-btn-enhanced" onClick={search} style={{ background: "linear-gradient(135deg, #ff5722 0%, #d84315 100%)", boxShadow: "0 8px 20px rgba(216, 67, 21, 0.3)" }}>
            {loading ? "Searching..." : "Search Trains"}
          </button>
        </div>
      </div>

      {/* RESULTS SECTION */}
      <div className="train-results-enhanced" style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
        {loading && <div style={{ textAlign: "center", padding: "20px", fontSize: "18px" }}>Loading...</div>}
        
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

        {!loading && trains.map((t, i) => (
          <div className="train-card-enhanced" key={i} style={{ 
            background: "white", 
            borderRadius: "12px", 
            padding: "20px", 
            marginBottom: "20px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: "15px"
          }}>
            {/* Header */}
            <div className="card-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="airline-info" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <div className="train-icon-placeholder" style={{ fontSize: "24px" }}>
                  🚆
                </div>
                <div>
                  <div className="airline-name" style={{ fontSize: "18px", fontWeight: "bold" }}>{t.name}</div>
                  <div style={{ fontSize: "14px", color: "#888" }}>#{t.train_no}</div>
                </div>
              </div>
              <div style={{ background: "#e3f2fd", color: "#1976d2", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold" }}>
                {t.type}
              </div>
            </div>

            {/* Route Info */}
            <div className="flight-route-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
              <div className="route-point" style={{ textAlign: "left", flex: 1 }}>
                <div className="route-time" style={{ fontSize: "20px", fontWeight: "bold" }}>{t.departure}</div>
                <div className="route-city" style={{ fontSize: "14px", color: "#666" }}>{t.source}</div>
              </div>

              <div className="route-line" style={{ flex: 1, textAlign: "center", position: "relative" }}>
                <div style={{ borderBottom: "2px dashed #ccc", width: "100%", margin: "10px 0" }}></div>
                <span className="duration-badge" style={{ background: "#f5f5f5", padding: "4px 10px", borderRadius: "10px", fontSize: "12px", color: "#666" }}>{t.duration}</span>
              </div>

              <div className="route-point" style={{ textAlign: "right", flex: 1 }}>
                <div className="route-time" style={{ fontSize: "20px", fontWeight: "bold" }}>{t.arrival}</div>
                <div className="route-city" style={{ fontSize: "14px", color: "#666" }}>{t.destination}</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <button 
                className="book-btn-small" 
                onClick={handleBookClick}
                style={{ 
                  backgroundColor: "#ff5722", 
                  color: "white", 
                  border: "none", 
                  padding: "10px 20px", 
                  borderRadius: "8px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                Book Now
              </button>
            </div>
          </div>
        ))}
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
