import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
    <div className="autocomplete-wrapper w-full relative" ref={wrapperRef}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        className="w-full bg-transparent border-none p-0 text-base font-extrabold text-slate-900 focus:ring-0 outline-none placeholder-slate-400"
      />
      {showSuggestions && value.length > 0 && (
        <div className="suggestions-dropdown absolute left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
          {filteredCities.length > 0 ? (
            filteredCities.map((city) => (
              <div
                key={city.code}
                className="suggestion-item px-4 py-3 hover:bg-slate-50 text-slate-700 hover:text-slate-900 cursor-pointer transition-colors text-sm font-semibold border-b border-slate-100 last:border-none flex justify-between items-center"
                onClick={() => {
                  onChange(city.code);
                  setShowSuggestions(false);
                }}
              >
                <div className="city-name font-bold">{city.name}</div>
                <div className="city-code text-xs bg-sky-50 border border-sky-100 text-brand-secondary px-2 py-0.5 rounded font-bold">{city.code}</div>
              </div>
            ))
          ) : (
            <div className="suggestion-item px-4 py-3 text-slate-400 text-sm" style={{ cursor: "default" }}>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState({
    source: searchParams.get("source") || "",
    destination: searchParams.get("destination") || "",
    departure: searchParams.get("departure") || "",
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
      
      // Update browser search parameters
      setSearchParams({
        source: form.source,
        destination: form.destination,
        departure: form.departure
      });
    } catch {
      alert("Error fetching flights");
    }
    setLoading(false);
  };

  // Run search on page load if search parameters are present in URL
  useEffect(() => {
    if (form.source && form.destination && form.departure) {
      searchFlights();
    }
  }, []);

  const getDuration = (start, end) => {
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
    <div className="w-full min-h-screen bg-brand-bg pb-12">
      {/* COMPACT TOP EDIT SEARCH BANNER */}
      <div className="w-full bg-[#0a2240] text-white py-6 px-4 md:px-8 border-b border-slate-200/10 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 items-center justify-between">
          {/* horizontal search grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 bg-white rounded-xl shadow-inner border border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden flex-1 w-full">
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">From</label>
              <AutocompleteInput
                placeholder="From (e.g. BOM)"
                value={form.source}
                onChange={(val) => setForm({ ...form, source: val })}
              />
            </div>
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">To</label>
              <AutocompleteInput
                placeholder="To (e.g. DEL)"
                value={form.destination}
                onChange={(val) => setForm({ ...form, destination: val })}
              />
            </div>
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Departure Date</label>
              <input
                type="date"
                value={form.departure}
                onChange={(e) => setForm({ ...form, departure: e.target.value })}
                className="w-full bg-transparent border-none p-0 text-base font-extrabold text-slate-900 focus:ring-0 outline-none placeholder-slate-400"
              />
            </div>
          </div>
          
          <button 
            className="w-full lg:w-48 py-3 bg-brand-accent hover:bg-orange-600 text-white font-extrabold rounded-xl text-sm uppercase tracking-wider shadow-md shadow-orange-500/10 cursor-pointer transition-all border-none"
            onClick={searchFlights}
          >
            {loading ? "Searching..." : "Search Flights"}
          </button>
        </div>
      </div>

      {/* RESULTS SECTION */}
      <div className="flights-page max-w-5xl mx-auto px-4 mt-8">
        <div className="flight-results-enhanced">
          {flights.length === 0 && !loading && (
            <>
              {form.departure ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
                  No flights found for this route and date.
                </div>
              ) : (
                <div className="empty-state-content py-6 md:py-10 text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl shadow-sm">✈️</div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Popular Flight Destinations</h2>
                  </div>
                  <p className="text-slate-500 mb-8 max-w-2xl leading-relaxed text-sm md:text-base">Explore top flight routes and popular travel destinations across the globe.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { dest: "Dubai, UAE", code: "DXB", price: "₹18,500", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&h=400&fit=crop", airline: "Emirates" },
                      { dest: "London, UK", code: "LHR", price: "₹45,000", image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&h=400&fit=crop", airline: "British Airways" },
                      { dest: "Singapore", code: "SIN", price: "₹22,000", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=600&h=400&fit=crop", airline: "Singapore Airlines" }
                    ].map((flight, idx) => (
                      <div 
                        key={idx} 
                        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col"
                      >
                        <div className="h-40 overflow-hidden relative shrink-0">
                          <img src={flight.image} alt={flight.dest} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold text-slate-800 shadow-sm flex items-center gap-1 uppercase tracking-wider">
                            {flight.code}
                          </div>
                        </div>
                        <div className="p-5 flex flex-col flex-1">
                          <h4 className="font-extrabold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors mb-2">{flight.dest}</h4>
                          <p className="text-xs text-slate-500 mb-4 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">✈️</span> {flight.airline}
                          </p>
                          <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">One-way from</span>
                            <span className="text-brand-accent font-black">{flight.price}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {flights.map((f, i) => (
            <div className="flight-card-enhanced bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-center gap-6" key={i}>
              {/* Header: Airline & Price */}
              <div className="card-header-row flex items-center justify-between w-full md:w-auto gap-8">
                <div className="airline-info flex items-center gap-4">
                  <div className="airline-logo-placeholder w-12 h-12 bg-sky-50 border border-sky-100 text-brand-secondary font-black rounded-xl flex items-center justify-center text-sm tracking-wider uppercase shrink-0">
                    {f.airline}
                  </div>
                  <div>
                    <div className="airline-name text-slate-900 font-extrabold text-base text-left">
                      {getAirlineName(f.airline)}
                    </div>
                    <div className="text-left text-xs text-slate-400 font-semibold">{f.airline}-{i+100}</div>
                  </div>
                </div>
              </div>

              {/* Route Info */}
              <div className="flight-route-row flex items-center justify-center gap-8 w-full md:w-auto flex-1 px-8">
                <div className="route-point flex flex-col gap-0.5 text-center min-w-[80px]">
                  <span className="route-time text-lg font-black text-slate-900">{formatTime(f.departure)}</span>
                  <span className="route-city text-xs text-slate-400 font-semibold uppercase tracking-wider">{form.source || "Origin"}</span>
                </div>

                <div className="route-line w-32 flex flex-col items-center justify-center relative">
                  <span className="duration-badge bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-0.5 rounded-full text-[10px] font-bold z-10 mb-1">
                    {getDuration(f.departure, f.arrival)}
                  </span>
                  <div className="w-full h-[2px] bg-slate-200 relative">
                    <span className="plane-icon absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-secondary text-xs bg-white px-2 z-10">✈</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-semibold mt-1">Non-stop</span>
                </div>

                <div className="route-point flex flex-col gap-0.5 text-center min-w-[80px]">
                  <span className="route-time text-lg font-black text-slate-900">{formatTime(f.arrival)}</span>
                  <span className="route-city text-xs text-slate-400 font-semibold uppercase tracking-wider">{form.destination || "Dest"}</span>
                </div>
              </div>

              {/* Footer / Actions */}
              <div className="flight-actions flex flex-col items-end gap-2 w-full md:w-auto">
                <div className="flight-price text-2xl font-black text-brand-accent">
                  ₹{f.price}
                </div>
                <button className="book-btn-small w-full md:w-40 py-2.5 bg-gradient-to-r from-brand-accent to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-lg text-xs font-black transition-all cursor-pointer border-none shadow-sm shadow-orange-600/10 hover:shadow-orange-600/20">
                  Book Now
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
