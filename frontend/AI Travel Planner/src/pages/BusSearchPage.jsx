import { useState, useRef, useEffect } from "react";
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
          {filteredCities.length > 0 ? (
            filteredCities.map((city) => (
              <div
                key={city.code}
                className="suggestion-item"
                onClick={() => {
                  onChange(city.name);
                  setShowSuggestions(false);
                }}
              >
                <div className="city-name">{city.name}</div>
                <div className="city-code">{city.code}</div>
              </div>
            ))
          ) : (
            <div className="suggestion-item" style={{ cursor: "default" }}>
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
  const [form, setForm] = useState({
    source: "",
    destination: "",
    departure: "",
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
    // Generate fake ticket ID
    setTicketId("BUS" + Math.floor(100000 + Math.random() * 900000));
    setShowConfirmation(true);
  };

  const redirectToRedbus = () => {
    window.open("https://www.redbus.in", "_blank");
  };

  // Helper to generate seat grid (2x2 layout)
  const renderSeatMap = () => {
    const rows = 10;
    const seats = [];
    
    for (let r = 1; r <= rows; r++) {
      let rowSeats = [];
      // Left side
      for (let c = 1; c <= 2; c++) {
        const seatNo = `${r}${String.fromCharCode(64 + c)}`; // 1A, 1B
        // Randomly mark some seats as booked for demo
        const isBooked = (r * c) % 5 === 0; 
        const isSelected = selectedSeats.includes(seatNo);
        
        rowSeats.push(
          <div 
            key={seatNo}
            className={`bus-seat ${isBooked ? 'booked' : isSelected ? 'selected' : 'available'}`}
            onClick={() => !isBooked && toggleSeat(seatNo)}
          >
            {seatNo}
          </div>
        );
      }
      
      // Aisle space
      rowSeats.push(<div key={`aisle-${r}`} className="bus-aisle"></div>);
      
      // Right side
      for (let c = 3; c <= 4; c++) {
        const seatNo = `${r}${String.fromCharCode(64 + c)}`; // 1C, 1D
        const isBooked = (r + c) % 4 === 0;
        const isSelected = selectedSeats.includes(seatNo);
        
        rowSeats.push(
          <div 
            key={seatNo}
            className={`bus-seat ${isBooked ? 'booked' : isSelected ? 'selected' : 'available'}`}
            onClick={() => !isBooked && toggleSeat(seatNo)}
          >
            {seatNo}
          </div>
        );
      }
      
      seats.push(<div key={`row-${r}`} className="bus-seat-row">{rowSeats}</div>);
    }
    
    return <div className="bus-seat-map">{seats}</div>;
  };

  return (
    <div className="flights-page">

      {/* HERO SECTION - Resusing Flight Hero styling */}
      <div className="flight-hero" style={{ backgroundImage: "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80')" }}>
        <h1>Book Your Bus Tickets</h1>
        <p>Find comfortable and affordable bus journeys</p>

        <div className="flight-search-container">

          <div className="input-with-icon">
            <span className="input-icon">📍</span>
            <AutocompleteInput
              placeholder="From (e.g. Mumbai)"
              value={form.source}
              onChange={(val) => setForm({ ...form, source: val })}
            />
          </div>

          <div className="input-with-icon">
            <span className="input-icon">🎯</span>
            <AutocompleteInput
              placeholder="To (e.g. Pune)"
              value={form.destination}
              onChange={(val) => setForm({ ...form, destination: val })}
            />
          </div>

          <div className="input-with-icon">
            <span className="input-icon">📅</span>
            <input
              type="date"
              className="date-input"
              value={form.departure}
              onChange={(e) => setForm({ ...form, departure: e.target.value })}
            />
          </div>

          <button className="search-btn-enhanced" onClick={searchBuses}>
            {loading ? "Searching..." : "Search Buses"}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="bus-main-content">
        
        {/* RESULTS SECTION */}
        <div className="flight-results-enhanced bus-results-container">
          {buses.length > 0 && !selectedBus && <h3 style={{marginBottom: "20px"}}>Available Buses</h3>}
          {buses.length === 0 && !loading && form.departure && (
             <div style={{textAlign: "center", padding: "40px", color: "#666"}}>No buses found for this route.</div>
          )}
          
          {!selectedBus && buses.map((b, i) => (
            <div className="flight-card-enhanced" key={i}>
              <div className="card-header-row">
                <div className="airline-info">
                  <div className="airline-logo-placeholder">🚌</div>
                  <div className="airline-name">{b.name}</div>
                </div>
                <div className="flight-price">₹{b.price}</div>
              </div>

              <div className="flight-route-row">
                <div className="route-point">
                  <span className="route-time">{formatTime(b.departure)}</span>
                  <span className="route-city">{form.source || "Origin"}</span>
                </div>

                <div className="route-line bus-route-line">
                  <span className="duration-text">{b.duration}</span>
                  <div className="line"></div>
                </div>

                <div className="route-point">
                  <span className="route-time">{formatTime(b.arrival)}</span>
                  <span className="route-city">{form.destination || "Dest"}</span>
                </div>
              </div>

              <div className="flight-actions bus-actions">
                <span className="seats-available-text">{b.seats_available} Seats Available</span>
                <button className="book-btn-small" onClick={() => handleSelectBus(b)}>Select Seats</button>
              </div>
            </div>
          ))}
        </div>

        {/* SEAT SELECTION & BOOKING SECTION */}
        {selectedBus && !showConfirmation && (
          <div className="seat-selection-container">
             <div className="seat-selection-header">
                <h3>Select Seats for {selectedBus.name}</h3>
                <button className="close-btn" onClick={() => setSelectedBus(null)}>✕ Back to results</button>
             </div>
             
             <div className="seat-selection-layout">
                <div className="seat-map-wrapper">
                    <div className="driver-wheel">🛞 Driver</div>
                    {renderSeatMap()}
                    <div className="seat-legend">
                        <div className="legend-item"><span className="seat-box available"></span> Available</div>
                        <div className="legend-item"><span className="seat-box booked"></span> Booked</div>
                        <div className="legend-item"><span className="seat-box selected"></span> Selected</div>
                    </div>
                </div>
                
                <div className="booking-summary">
                    <h4>Booking Summary</h4>
                    <p><strong>Route:</strong> {form.source} to {form.destination}</p>
                    <p><strong>Date:</strong> {form.departure}</p>
                    <p><strong>Selected Seats:</strong> {selectedSeats.length > 0 ? selectedSeats.join(", ") : "None"}</p>
                    
                    <div className="total-price-calc">
                       <span>Total Price:</span>
                       <span className="total-amt">₹{selectedSeats.length * selectedBus.price}</span>
                    </div>

                    <div className="passenger-input-group">
                       <label>Passenger Name:</label>
                       <input 
                         type="text" 
                         value={passengerName} 
                         onChange={e => setPassengerName(e.target.value)} 
                         placeholder="Enter full name" 
                         className="passenger-input"
                       />
                    </div>
                    
                    <button className="proceed-book-btn" onClick={handleBook}>Proceed to Book</button>
                </div>
             </div>
          </div>
        )}

        {/* CONFIRMATION SECTION */}
        {showConfirmation && (
          <div className="booking-confirmation">
            <div className="success-icon">✅</div>
            <h2>Booking Confirmed!</h2>
            <div className="ticket-details">
              <p><strong>Ticket ID:</strong> {ticketId}</p>
              <p><strong>Passenger:</strong> {passengerName}</p>
              <p><strong>Bus:</strong> {selectedBus.name}</p>
              <p><strong>Route:</strong> {form.source} ➔ {form.destination}</p>
              <p><strong>Date:</strong> {form.departure}</p>
              <p><strong>Seats:</strong> {selectedSeats.join(", ")}</p>
              <p><strong>Total Paid:</strong> ₹{selectedSeats.length * selectedBus.price}</p>
            </div>
            
            <div className="confirmation-actions">
               <button className="book-btn-small" onClick={() => {
                   setShowConfirmation(false);
                   setSelectedBus(null);
                   setBuses([]);
               }}>Book Another Bus</button>
               
               <div className="real-booking-prompt">
                 <p>Want to make a real booking?</p>
                 <button className="redbus-btn" onClick={redirectToRedbus}>Continue on redBus</button>
               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
