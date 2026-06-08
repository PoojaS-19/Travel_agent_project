import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../api";
import "../App.css";

export default function TrainSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [from, setFrom] = useState(searchParams.get("source") || "");
  const [to, setTo] = useState(searchParams.get("destination") || "");
  const [date, setDate] = useState(searchParams.get("date") || "");
  const [type, setType] = useState(searchParams.get("type") || "");
  
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Autocomplete states
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const fetchSuggestions = async (query, setSuggestions) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    try {
      const res = await API.get("/api/trains/stations", {
        params: { query: query.trim() }
      });
      if (res.data && res.data.stations) {
        setSuggestions(res.data.stations);
      } else {
        setSuggestions([]);
      }
    } catch (err) {
      console.error("Error fetching station suggestions:", err);
      setSuggestions([]);
    }
  };

  const handleFromChange = (e) => {
    const val = e.target.value;
    setFrom(val);
    setShowFromDropdown(true);
    fetchSuggestions(val, setFromSuggestions);
  };

  const handleToChange = (e) => {
    const val = e.target.value;
    setTo(val);
    setShowToDropdown(true);
    fetchSuggestions(val, setToSuggestions);
  };

  const handleSelectFrom = (station) => {
    setFrom(`${station.name} (${station.code})`);
    setFromSuggestions([]);
    setShowFromDropdown(false);
  };

  const handleSelectTo = (station) => {
    setTo(`${station.name} (${station.code})`);
    setToSuggestions([]);
    setShowToDropdown(false);
  };

  const cleanSearchTerm = (val) => {
    if (val.includes(" (") && val.endsWith(")")) {
      const parts = val.split(" (");
      return parts[1].replace(")", "").trim();
    }
    return val;
  };

  const search = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    setError("");
    setTrains([]);
    
    if (!from || !to) {
      setError("Please fill in both From and To fields.");
      setLoading(false);
      return;
    }

    try {
      const res = await API.get("/api/trains", {
        params: { 
          source: cleanSearchTerm(from), 
          destination: cleanSearchTerm(to), 
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
      setSearchParams({
        source: from,
        destination: to,
        date,
        type
      });
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

  useEffect(() => {
    if (from && to) {
      search();
    }
  }, []);

  return (
    <div className="w-full min-h-screen bg-brand-bg pb-12">
      {/* COMPACT SEARCH DECK */}
      <div className="w-full bg-[#0a2240] text-white py-6 px-4 md:px-8 border-b border-slate-200/10 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="grid grid-cols-1 md:grid-cols-4 bg-white rounded-xl shadow-inner border border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden flex-1 w-full">
            
            {/* From Input */}
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">From Station</label>
              <input 
                type="text"
                placeholder="From (e.g. Mumbai)"
                value={from}
                onChange={handleFromChange}
                onFocus={() => {
                  if (from.length >= 2) setShowFromDropdown(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowFromDropdown(false), 200);
                }}
                className="w-full bg-transparent border-none p-0 text-base font-extrabold text-slate-900 focus:ring-0 outline-none placeholder-slate-400"
              />
              {showFromDropdown && fromSuggestions.length > 0 && (
                <div className="suggestions-dropdown absolute left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
                  {fromSuggestions.map((station, idx) => (
                    <div 
                      key={idx} 
                      className="suggestion-item px-4 py-3 hover:bg-slate-50 text-slate-700 hover:text-slate-900 cursor-pointer transition-colors text-sm font-semibold border-b border-slate-100 last:border-none flex justify-between items-center"
                      onMouseDown={() => handleSelectFrom(station)}
                    >
                      <span className="font-bold">{station.name}</span>
                      <span className="text-xs bg-sky-50 border border-sky-100 text-brand-secondary px-2 py-0.5 rounded font-bold">{station.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* To Input */}
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">To Station</label>
              <input 
                type="text"
                placeholder="To (e.g. Delhi)"
                value={to}
                onChange={handleToChange}
                onFocus={() => {
                  if (to.length >= 2) setShowToDropdown(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowToDropdown(false), 200);
                }}
                className="w-full bg-transparent border-none p-0 text-base font-extrabold text-slate-900 focus:ring-0 outline-none placeholder-slate-400"
              />
              {showToDropdown && toSuggestions.length > 0 && (
                <div className="suggestions-dropdown absolute left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
                  {toSuggestions.map((station, idx) => (
                    <div 
                      key={idx} 
                      className="suggestion-item px-4 py-3 hover:bg-slate-50 text-slate-700 hover:text-slate-900 cursor-pointer transition-colors text-sm font-semibold border-b border-slate-100 last:border-none flex justify-between items-center"
                      onMouseDown={() => handleSelectTo(station)}
                    >
                      <span className="font-bold">{station.name}</span>
                      <span className="text-xs bg-sky-50 border border-sky-100 text-brand-secondary px-2 py-0.5 rounded font-bold">{station.code}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Date Input */}
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Travel Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-base font-extrabold text-slate-900 focus:ring-0 outline-none placeholder-slate-400"
              />
            </div>

            {/* Train Type Select */}
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Train Class</label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-transparent border-none p-0 text-base font-extrabold text-slate-900 focus:ring-0 outline-none cursor-pointer"
              >
                <option value="">All Classes</option>
                <option value="Express">Express</option>
                <option value="Passenger">Passenger</option>
                <option value="Superfast">Superfast</option>
              </select>
            </div>

          </div>
          <button 
            className="w-full lg:w-48 py-3 bg-brand-accent hover:bg-orange-600 text-white font-extrabold rounded-xl text-sm uppercase tracking-wider shadow-md shadow-orange-500/10 cursor-pointer transition-all border-none"
            onClick={search}
          >
            {loading ? "Searching..." : "Search Trains"}
          </button>
        </div>
      </div>

      {/* RESULTS SECTION */}
      <div className="max-w-4xl mx-auto px-4 mt-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-orange-500/30 border-t-brand-accent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-400 font-bold mt-3">Fetching live train schedules...</span>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 font-bold p-4 rounded-xl text-center shadow-sm">
            {error}
          </div>
        )}

        {!loading && trains.map((t, i) => (
          <div 
            className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6"
            key={i}
          >
            {/* Train details */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-sky-50 border border-sky-100 text-brand-secondary font-black rounded-xl flex items-center justify-center text-sm shrink-0">
                🚆
              </div>
              <div className="text-left">
                <h3 className="text-slate-900 font-extrabold text-base leading-snug">{t.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Train #{t.train_number}</p>
                <span className="inline-block mt-2 text-[10px] bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-0.5 rounded-full font-bold uppercase">
                  {t.type}
                </span>
              </div>
            </div>

            {/* Route Info */}
            <div className="flex items-center justify-center gap-6 flex-1 px-4">
              <div className="text-left">
                <div className="text-base font-black text-slate-900">{t.departure}</div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t.source}</div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center relative">
                <span className="bg-slate-50 border border-slate-200 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold mb-1">
                  {t.duration}
                </span>
                <div className="w-full h-[1.5px] border-b border-dashed border-slate-300"></div>
              </div>

              <div className="text-right">
                <div className="text-base font-black text-slate-900">{t.arrival}</div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t.destination}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-end gap-2 justify-center shrink-0 mt-4 md:mt-0">
              <button 
                className="w-full md:w-36 py-2.5 bg-brand-accent hover:bg-orange-600 text-white rounded-lg text-xs font-black transition-all cursor-pointer border-none shadow-sm shadow-orange-600/10"
                onClick={handleBookClick}
              >
                Book Now
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* CONFIRMATION MODAL */}
      {showModal && (
        <div className="irctc-modal-overlay fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-[9999] px-4">
          <div className="irctc-modal bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl space-y-4">
            <div className="irctc-modal-icon w-14 h-14 bg-sky-50 border border-sky-100 text-brand-secondary text-2xl font-bold rounded-full flex items-center justify-center mx-auto mb-4">🎫</div>
            <h3 className="text-lg font-black text-slate-900">Secure IRCTC Booking</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              You will be redirected to the Official IRCTC website to complete your train ticket checkout.
            </p>
            <div className="modal-actions flex gap-3 mt-6 pt-4 border-t border-slate-100">
              <button 
                className="cancel-btn flex-1 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 text-xs font-bold rounded-lg transition-all" 
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button 
                className="continue-btn flex-1 py-2 bg-brand-accent hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all border-none cursor-pointer" 
                onClick={handleContinue}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
