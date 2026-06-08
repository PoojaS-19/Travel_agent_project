import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../api";
import "../App.css";

export default function RestaurantsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);

  const getRestaurants = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    if (!city) return;
    setLoading(true);
    try {
      const res = await API.get(`/restaurants?city=${encodeURIComponent(city)}`);
      setRestaurants(Array.isArray(res.data) ? res.data : []);
      setSearchParams({ city });
    } catch {
      alert("Failed to load restaurants");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (city.trim()) {
      getRestaurants();
    }
  }, []);

  return (
    <div className="w-full min-h-screen bg-brand-bg pb-12">
      {/* COMPACT SEARCH DECK */}
      <div className="w-full bg-[#0a2240] text-white py-6 px-4 md:px-8 border-b border-slate-200/10 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 bg-white rounded-xl shadow-inner border border-slate-200 overflow-hidden w-full">
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Explore City Food Scene</label>
              <input
                placeholder="Enter city (e.g. Mumbai)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-base font-extrabold text-slate-900 focus:ring-0 outline-none placeholder-slate-400"
              />
            </div>
          </div>
          <button 
            onClick={getRestaurants}
            className="w-full md:w-48 py-3 bg-brand-accent hover:bg-orange-600 text-white font-extrabold rounded-xl text-sm uppercase tracking-wider shadow-md shadow-orange-500/10 cursor-pointer transition-all border-none"
          >
            {loading ? "Searching..." : "Search Places"}
          </button>
        </div>
      </div>

      {/* RESULTS */}
      <div className="max-w-4xl mx-auto px-4 mt-8">
        {restaurants.length === 0 && !loading && city.trim() && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
            No restaurants found for this city.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {restaurants.map((r, i) => (
            <div
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6 cursor-pointer"
              key={i}
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name + " " + (r.formatted_address || r.vicinity))}`, "_blank")}
              title="View on Google Maps"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 border border-orange-100 text-brand-accent font-black rounded-xl flex items-center justify-center text-sm shrink-0">
                  🍽️
                </div>
                <div className="text-left">
                  <h3 className="text-slate-900 font-extrabold text-base leading-snug">{r.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-normal">{r.formatted_address || r.vicinity}</p>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 gap-2 w-full md:w-auto mt-4 md:mt-0">
                {r.rating && (
                  <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 self-start md:self-auto">
                    ⭐ {r.rating} Rating
                  </span>
                )}
                <span className="text-xs text-brand-secondary font-bold hover:underline">
                  View Location ➔
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
