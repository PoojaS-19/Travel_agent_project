import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import API from "../api";
import "../App.css";
import ReviewsModal from "../components/ReviewsModal";

export default function HotelsPage() {
  const location = useLocation();
  const [city, setCity] = useState("");
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState(null);

  const getHotels = async (cityVal = city) => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    if (!cityVal.trim()) {
      alert("Please enter a city name.");
      return;
    }

    setLoading(true);
    try {
      const res = await API.get(`/hotels?city=${encodeURIComponent(cityVal.trim())}`);
      if (res.data?.error) {
        alert(res.data.error);
        setHotels([]);
      } else {
        setHotels(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error(err);
      alert("Error fetching hotels");
      setHotels([]);
    }
    setLoading(false);
  };

  // Prefill and execute search automatically on home console routing
  useEffect(() => {
    if (location.state && location.state.city) {
      const homeCity = location.state.city;
      setCity(homeCity);
      getHotels(homeCity);
    }
  }, [location.state]);

  return (
    <div className="hotels-page">

      {/* HERO TEXT ON IMAGE */}
      <div className="hotel-hero">
        <h1>Find Your Perfect Stay</h1>
        <p>Search the best hotels across the world</p>

        <div className="search-row">
          <input
            placeholder="Enter city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button onClick={getHotels}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* HOTEL RESULTS */}
      <div className="hotel-list">
        {hotels.length === 0 && !loading && city.trim() && (
          <p>No hotels found for this city. Check your Google API / billing settings if the search keeps returning no results.</p>
        )}
        {hotels.map((h, i) => (
          <div
            className="hotel-card"
            key={i}
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + " " + (h.formatted_address || h.vicinity))}`, "_blank")}
            style={{ cursor: "pointer" }}
            title="View on Main Map"
          >
            <h3>{h.name}</h3>
            <p>{h.formatted_address || h.vicinity}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
              {h.rating && <span style={{ fontWeight: 600 }}>⭐ {h.rating}</span>}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedHotel(h.name);
                }}
                className="saved-trip-primary-btn"
                style={{ padding: "6px 12px", fontSize: "12px", zIndex: 10 }}
              >
                💬 View Reviews
              </button>
            </div>
          </div>
        ))}
      </div>

      <ReviewsModal
        open={selectedHotel !== null}
        onClose={() => setSelectedHotel(null)}
        itemName={selectedHotel}
        reviewType="hotel"
      />

    </div>
  );
}
