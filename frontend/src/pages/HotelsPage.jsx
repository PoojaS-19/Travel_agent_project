import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../api";
import "../App.css";

export default function HotelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);

  const getHotels = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

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
      setSearchParams({ city });
    } catch (err) {
      console.error(err);
      alert("Error fetching hotels");
      setHotels([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (city.trim()) {
      getHotels();
    }
  }, []);

  return (
    <div className="w-full min-h-screen bg-brand-bg pb-12">
      {/* COMPACT EDIT SEARCH BANNER */}
      <div className="w-full bg-[#0a2240] text-white py-6 px-4 md:px-8 border-b border-slate-200/10 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 bg-white rounded-xl shadow-inner border border-slate-200 overflow-hidden w-full">
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Enter City / Destination</label>
              <input
                placeholder="Where do you want to stay? (e.g. Mumbai)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-base font-extrabold text-slate-900 focus:ring-0 outline-none placeholder-slate-400"
              />
            </div>
          </div>
          <button 
            onClick={getHotels}
            className="w-full md:w-48 py-3 bg-brand-accent hover:bg-orange-600 text-white font-extrabold rounded-xl text-sm uppercase tracking-wider shadow-md shadow-orange-500/10 cursor-pointer transition-all border-none"
          >
            {loading ? "Searching..." : "Search Hotels"}
          </button>
        </div>
      </div>

      {/* HOTEL RESULTS */}
      <div className="max-w-4xl mx-auto px-4 mt-8">
        {hotels.length === 0 && !loading && city.trim() && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm leading-relaxed">
            No hotels found for this city. Check your Google API / billing settings if the search keeps returning no results.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {hotels.map((h, i) => (
            <div
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6 cursor-pointer"
              key={i}
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + " " + (h.formatted_address || h.vicinity))}`, "_blank")}
              title="View on Google Maps"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-sky-50 border border-sky-100 text-brand-secondary font-black rounded-xl flex items-center justify-center text-sm shrink-0">
                  🏨
                </div>
                <div className="text-left">
                  <h3 className="text-slate-900 font-extrabold text-base leading-snug">{h.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-normal">{h.formatted_address || h.vicinity}</p>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 gap-2 w-full md:w-auto mt-4 md:mt-0">
                {h.rating && (
                  <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 self-start md:self-auto">
                    ⭐ {h.rating} Rating
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
