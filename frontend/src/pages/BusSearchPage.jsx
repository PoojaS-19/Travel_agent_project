import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import API from "../api";
import "../App.css";

// --- DATA CONSTANTS ---
const CITY_DATA = [
  { code: "BOM", name: "Mumbai" },
  { code: "PUN", name: "Pune" },
  { code: "DEL", name: "New Delhi" },
  { code: "BLR", name: "Bengaluru" },
  { code: "MAA", name: "Chennai" },
  { code: "HYD", name: "Hyderabad" },
  { code: "GOI", name: "Goa" },
  { code: "AMD", name: "Ahmedabad" },
];

// --- AUTOCOMPLETE COMPONENT ---
function AutocompleteInput({ placeholder, value, onChange }) {
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
                  onChange(city.name);
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
export default function BusSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState({
    source: searchParams.get("source") || "",
    destination: searchParams.get("destination") || "",
    departure: searchParams.get("departure") || "",
  });

  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Seat Selection State
  const [selectedBus, setSelectedBus] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  
  // Confirmation State
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [passengerName, setPassengerName] = useState("");

  const searchBuses = async () => {
    if (!form.source || !form.destination || !form.departure) {
      alert("Please fill in Source, Destination and Date");
      return;
    }
    setLoading(true);
    try {
      const q = `source=${form.source}&destination=${form.destination}&date=${form.departure}`;
      const res = await API.get(`/buses?${q}`);
      setBuses(Array.isArray(res.data) ? res.data : []);
      setSelectedBus(null);
      setSelectedSeats([]);
      setShowConfirmation(false);
      
      setSearchParams({
        source: form.source,
        destination: form.destination,
        departure: form.departure
      });
    } catch {
      alert("Error fetching buses");
    }
    setLoading(false);
  };

  const formatTime = (isoString) => {
    if (!isoString) return "--:--";
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSelectBus = (bus) => {
    setSelectedBus(bus);
    setSelectedSeats([]);
  };

  const toggleSeat = (seatNo) => {
    if (selectedSeats.includes(seatNo)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatNo));
    } else {
      if (selectedSeats.length < 6) {
        setSelectedSeats([...selectedSeats, seatNo]);
      } else {
        alert("You can only select up to 6 seats");
      }
    }
  };

  const handleBook = () => {
    if (selectedSeats.length === 0) {
      alert("Please select at least one seat.");
      return;
    }
    if (!passengerName.trim()) {
      alert("Please enter passenger name.");
      return;
    }
    setTicketId("BUS" + Math.floor(100000 + Math.random() * 900000));
    setShowConfirmation(true);
  };

  const redirectToRedbus = () => {
    window.open("https://www.redbus.in", "_blank");
  };

  useEffect(() => {
    if (form.source && form.destination && form.departure) {
      searchBuses();
    }
  }, []);

  const renderSeatMap = () => {
    const rows = 10;
    const seats = [];
    
    for (let r = 1; r <= rows; r++) {
      let rowSeats = [];
      for (let c = 1; c <= 2; c++) {
        const seatNo = `${r}${String.fromCharCode(64 + c)}`;
        const isBooked = (r * c) % 5 === 0; 
        const isSelected = selectedSeats.includes(seatNo);
        
        rowSeats.push(
          <div 
            key={seatNo}
            className={`w-9 h-9 flex items-center justify-center text-xs font-bold border rounded-lg cursor-pointer transition-all ${
              isBooked 
                ? 'bg-rose-50 border-rose-200 text-rose-500 cursor-not-allowed' 
                : isSelected 
                  ? 'bg-emerald-500 border-emerald-600 text-white shadow' 
                  : 'bg-white border-slate-250 text-slate-700 hover:border-slate-400'
            }`}
            onClick={() => !isBooked && toggleSeat(seatNo)}
          >
            {seatNo}
          </div>
        );
      }
      
      rowSeats.push(<div key={`aisle-${r}`} className="w-8"></div>);
      
      for (let c = 3; c <= 4; c++) {
        const seatNo = `${r}${String.fromCharCode(64 + c)}`;
        const isBooked = (r + c) % 4 === 0;
        const isSelected = selectedSeats.includes(seatNo);
        
        rowSeats.push(
          <div 
            key={seatNo}
            className={`w-9 h-9 flex items-center justify-center text-xs font-bold border rounded-lg cursor-pointer transition-all ${
              isBooked 
                ? 'bg-rose-50 border-rose-200 text-rose-500 cursor-not-allowed' 
                : isSelected 
                  ? 'bg-emerald-500 border-emerald-600 text-white shadow' 
                  : 'bg-white border-slate-250 text-slate-700 hover:border-slate-400'
            }`}
            onClick={() => !isBooked && toggleSeat(seatNo)}
          >
            {seatNo}
          </div>
        );
      }
      
      seats.push(<div key={`row-${r}`} className="flex justify-center gap-2 mb-2">{rowSeats}</div>);
    }
    
    return <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">{seats}</div>;
  };

  return (
    <div className="w-full min-h-screen bg-brand-bg pb-12">
      {/* COMPACT SEARCH DECK */}
      <div className="w-full bg-[#0a2240] text-white py-6 px-4 md:px-8 border-b border-slate-200/10 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="grid grid-cols-1 md:grid-cols-3 bg-white rounded-xl shadow-inner border border-slate-200 divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden flex-1 w-full">
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">From City</label>
              <AutocompleteInput
                placeholder="From (e.g. Mumbai)"
                value={form.source}
                onChange={(val) => setForm({ ...form, source: val })}
              />
            </div>
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">To City</label>
              <AutocompleteInput
                placeholder="To (e.g. Pune)"
                value={form.destination}
                onChange={(val) => setForm({ ...form, destination: val })}
              />
            </div>
            <div className="mmt-input-segment px-4 py-2 hover:bg-sky-50/20 transition-colors flex flex-col text-left">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-0.5">Travel Date</label>
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
            onClick={searchBuses}
          >
            {loading ? "Searching..." : "Search Buses"}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="max-w-5xl mx-auto px-4 mt-8">
        
        {/* RESULTS SECTION */}
        {buses.length > 0 && !selectedBus && <h3 className="text-left font-black text-[#0a2240] text-lg mb-4">Available Bus Operators</h3>}
        
        {buses.length === 0 && !loading && !selectedBus && (
          <>
            {form.departure ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-sm">
                No buses found for this route.
              </div>
            ) : (
              <div className="empty-state-content py-6 md:py-10 text-left">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl shadow-sm">🚌</div>
                  <h2 className="text-2xl font-black text-slate-800 tracking-tight">Popular Bus Routes</h2>
                </div>
                <p className="text-slate-500 mb-8 max-w-2xl leading-relaxed text-sm md:text-base">Explore the most traveled bus routes for a comfortable and budget-friendly journey.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { route: "Mumbai to Pune", operator: "Neeta Travels", duration: "3h 15m", price: "₹450", image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&h=400&fit=crop" },
                    { route: "Delhi to Manali", operator: "Zingbus", duration: "12h 30m", price: "₹1,100", image: "https://images.unsplash.com/photo-1605649487212-4d43be6797a1?w=600&h=400&fit=crop" },
                    { route: "Bangalore to Goa", operator: "VRL Travels", duration: "14h 00m", price: "₹1,500", image: "https://images.unsplash.com/photo-1515091943-9d5c0ad475af?w=600&h=400&fit=crop" }
                  ].map((trip, idx) => (
                    <div key={idx} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col">
                      <div className="h-40 overflow-hidden relative shrink-0">
                        <img src={trip.image} alt={trip.route} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      </div>
                      <div className="p-5 flex flex-col flex-1 text-left">
                        <h4 className="font-extrabold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors mb-2">{trip.route}</h4>
                        <p className="text-xs text-slate-500 mb-2 font-bold">{trip.operator}</p>
                        <p className="text-xs text-slate-400 mb-4 flex items-center gap-1">⏱ {trip.duration}</p>
                        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Starts from</span>
                          <span className="text-brand-accent font-black">{trip.price}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        {!selectedBus && (
          <div className="grid grid-cols-1 gap-4">
            {buses.map((b, i) => (
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-center gap-6" key={i}>
                <div className="card-header-row flex items-center justify-between w-full md:w-auto gap-8">
                  <div className="airline-info flex items-center gap-4">
                    <div className="w-12 h-12 bg-sky-50 border border-sky-100 text-brand-secondary font-black rounded-xl flex items-center justify-center text-lg shrink-0">
                      🚌
                    </div>
                    <div className="text-left">
                      <div className="airline-name text-slate-900 font-extrabold text-base">{b.name}</div>
                      <div className="text-xs text-slate-400 font-semibold mt-0.5">AC Sleeper / Seater</div>
                    </div>
                  </div>
                </div>

                <div className="flight-route-row flex items-center justify-center gap-8 w-full md:w-auto flex-1 px-8">
                  <div className="route-point flex flex-col gap-0.5 text-center min-w-[80px]">
                    <span className="route-time text-lg font-black text-slate-900">{formatTime(b.departure)}</span>
                    <span className="route-city text-xs text-slate-400 font-semibold uppercase tracking-wider">{form.source || "Origin"}</span>
                  </div>

                  <div className="route-line w-32 flex flex-col items-center justify-center relative">
                    <span className="duration-badge bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-0.5 rounded-full text-[10px] font-bold z-10 mb-1">
                      {b.duration}
                    </span>
                    <div className="w-full h-[2px] bg-slate-200"></div>
                  </div>

                  <div className="route-point flex flex-col gap-0.5 text-center min-w-[80px]">
                    <span className="route-time text-lg font-black text-slate-900">{formatTime(b.arrival)}</span>
                    <span className="route-city text-xs text-slate-400 font-semibold uppercase tracking-wider">{form.destination || "Dest"}</span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto mt-4 md:mt-0">
                  <div className="flight-price text-2xl font-black text-brand-accent">₹{b.price}</div>
                  <span className="text-xs text-emerald-600 font-bold">{b.seats_available} Seats Available</span>
                  <button className="book-btn-small w-full md:w-40 py-2.5 bg-gradient-to-r from-brand-accent to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-lg text-xs font-black transition-all cursor-pointer border-none shadow-sm shadow-orange-600/10 hover:shadow-orange-600/20" onClick={() => handleSelectBus(b)}>
                    Select Seats
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SEAT SELECTION & BOOKING SECTION */}
        {selectedBus && !showConfirmation && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-md">
             <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
                <h3 className="text-lg font-black text-slate-900">Select Seats for {selectedBus.name}</h3>
                <button className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-lg text-xs font-bold transition-all cursor-pointer" onClick={() => setSelectedBus(null)}>✕ Back to results</button>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-6 flex flex-col items-center">
                    <div className="px-5 py-2 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg mb-4 w-fit flex items-center gap-1.5">🛞 Front / Driver Cabin</div>
                    {renderSeatMap()}
                    <div className="flex gap-4 mt-6 text-xs text-slate-500 font-semibold">
                        <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-250 bg-white rounded"></span> Available</div>
                        <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-rose-200 bg-rose-50 rounded"></span> Booked</div>
                        <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-emerald-600 bg-emerald-500 rounded"></span> Selected</div>
                    </div>
                </div>
                
                <div className="lg:col-span-6 border border-slate-200 rounded-2xl p-6 bg-slate-50/50 space-y-4 text-left">
                    <h4 className="font-extrabold text-slate-900 border-b border-slate-200 pb-2 mb-2">Booking Summary</h4>
                    <p className="text-xs text-slate-500 leading-relaxed"><strong>Route:</strong> {form.source} to {form.destination}</p>
                    <p className="text-xs text-slate-500 leading-relaxed"><strong>Date:</strong> {form.departure}</p>
                    <p className="text-xs text-slate-500 leading-relaxed"><strong>Selected Seats:</strong> {selectedSeats.length > 0 ? <span className="bg-sky-55 text-brand-secondary font-black">{selectedSeats.join(", ")}</span> : "None"}</p>
                    
                    <div className="flex justify-between items-center border-t border-slate-200 pt-4 my-2">
                       <span className="text-sm font-bold text-slate-650">Total Price:</span>
                       <span className="text-2xl font-black text-brand-accent">₹{selectedSeats.length * selectedBus.price}</span>
                    </div>

                    <div className="space-y-1.5">
                       <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Passenger Name:</label>
                       <input 
                         type="text" 
                         value={passengerName} 
                         onChange={e => setPassengerName(e.target.value)} 
                         placeholder="Enter full name" 
                         className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none transition-all"
                       />
                    </div>
                    
                    <button 
                      className="w-full py-3 bg-brand-accent hover:bg-orange-600 text-white font-extrabold text-sm rounded-xl transition-all cursor-pointer border-none shadow-md shadow-orange-500/10"
                      onClick={handleBook}
                    >
                      Proceed to Book
                    </button>
                </div>
             </div>
          </div>
        )}

        {/* CONFIRMATION SECTION */}
        {showConfirmation && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-lg mx-auto text-center shadow-lg space-y-6">
            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-500 text-3xl font-bold rounded-full flex items-center justify-center mx-auto">✅</div>
            <h2 className="text-2xl font-black text-slate-900">Booking Confirmed!</h2>
            <div className="border border-slate-200 rounded-xl bg-slate-50 p-5 space-y-3.5 text-left">
              <p className="text-sm text-slate-600 flex justify-between border-b border-slate-200/50 pb-2"><strong>Ticket ID:</strong> <span className="font-extrabold text-slate-900">{ticketId}</span></p>
              <p className="text-sm text-slate-600 flex justify-between border-b border-slate-200/50 pb-2"><strong>Passenger:</strong> <span className="font-extrabold text-slate-900">{passengerName}</span></p>
              <p className="text-sm text-slate-600 flex justify-between border-b border-slate-200/50 pb-2"><strong>Bus:</strong> <span className="font-extrabold text-slate-900">{selectedBus.name}</span></p>
              <p className="text-sm text-slate-600 flex justify-between border-b border-slate-200/50 pb-2"><strong>Route:</strong> <span className="font-extrabold text-slate-900">{form.source} ➔ {form.destination}</span></p>
              <p className="text-sm text-slate-600 flex justify-between border-b border-slate-200/50 pb-2"><strong>Date:</strong> <span className="font-extrabold text-slate-900">{form.departure}</span></p>
              <p className="text-sm text-slate-600 flex justify-between border-b border-slate-200/50 pb-2"><strong>Seats:</strong> <span className="font-extrabold text-slate-900">{selectedSeats.join(", ")}</span></p>
              <p className="text-sm text-slate-600 flex justify-between pt-1"><strong>Total Paid:</strong> <span className="font-black text-brand-accent text-lg">₹{selectedSeats.length * selectedBus.price}</span></p>
            </div>
            
            <div className="flex flex-col gap-3">
               <button 
                 className="w-full py-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 font-extrabold text-sm rounded-xl transition-all cursor-pointer"
                 onClick={() => {
                   setShowConfirmation(false);
                   setSelectedBus(null);
                   setBuses([]);
                 }}
               >
                 Book Another Bus
               </button>
               
               <div className="border-t border-slate-200 pt-4 mt-2">
                 <p className="text-xs text-slate-450 font-bold mb-2">Want to make a real booking?</p>
                 <button 
                   className="w-full py-3 bg-brand-secondary hover:bg-blue-600 text-white font-extrabold text-sm rounded-xl transition-all cursor-pointer border-none shadow-sm shadow-blue-500/10"
                   onClick={redirectToRedbus}
                 >
                   Continue on redBus
                 </button>
               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
