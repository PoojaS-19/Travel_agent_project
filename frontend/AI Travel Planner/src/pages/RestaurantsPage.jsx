import { useState } from "react";
import API from "../api";
import "../App.css";

export default function RestaurantsPage() {
  const [city, setCity] = useState("");
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);

  const getRestaurants = async () => {
    if (!city) return;
    setLoading(true);
    try {
      const res = await API.get(`/restaurants?city=${encodeURIComponent(city)}`);
      setRestaurants(Array.isArray(res.data) ? res.data : []);
    } catch {
      alert("Failed to load restaurants");
    }
    setLoading(false);
  };

  return (
    <div className="restaurants-page">

      {/* HERO SECTION */}
      <div className="restaurant-hero">
        <h1>Discover Best Restaurants</h1>
        <p>Find top rated restaurants in your city</p>

        <div className="search-bar">
          <input
            placeholder="Enter city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button onClick={getRestaurants}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* RESULTS */}
      <div className="restaurant-list">
        {restaurants.map((r, i) => (
          <div className="restaurant-card" key={i}>
            <h3>{r.name}</h3>
            <p>{r.formatted_address || r.vicinity}</p>
            {r.rating && <span className="rating">⭐ {r.rating}</span>}
          </div>
        ))}
      </div>

    </div>
  );
}
