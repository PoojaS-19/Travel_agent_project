import { useState } from "react";
import API from "../api";
import "../App.css";

export default function HotelsPage() {
  const [city, setCity] = useState("");
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);

  const getHotels = async () => {
    if (!city.trim()) {
      alert("Please enter a city name.");
      return;
    }

    setLoading(true);
    try {
      const res = await API.get(`/hotels?city=${encodeURIComponent(city)}`);
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
            {h.rating && <span>⭐ {h.rating}</span>}
          </div>
        ))}
      </div>

    </div>
  );
}
