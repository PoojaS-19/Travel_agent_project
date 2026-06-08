import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Bed, Utensils, Train, Plane, Bus, Calendar, MapPin, Search, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  { code: "PUN", name: "Pune, India" },
  { code: "AMD", name: "Ahmedabad, India" }
];

const POPULAR_DESTINATIONS = [
  { name: "Goa", image: "https://images.unsplash.com/photo-1506461883276-594a12b11cc3?auto=format&fit=crop&w=600&q=80", count: "12k+ bookings" },
  { name: "Dubai", image: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80", count: "25k+ bookings" },
  { name: "Bali", image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80", count: "18k+ bookings" },
  { name: "Singapore", image: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=600&q=80", count: "22k+ bookings" },
  { name: "Switzerland", image: "https://images.unsplash.com/photo-1502784444187-359ac186c5bb?auto=format&fit=crop&w=600&q=80", count: "15k+ bookings" },
  { name: "Paris", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80", count: "30k+ bookings" },
  { name: "Tokyo", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80", count: "20k+ bookings" }
];

const FEATURES = [
  { 
    title: "Live Buddy Collaboration", 
    image: "https://images.unsplash.com/photo-1539635278303-d4002c07eae3?auto=format&fit=crop&w=400&q=80", 
    desc: "Create a group workspace, share access pins, exchange voting decisions, track locations, and plan multi-user expenses seamlessly." 
  },
  { 
    title: "AI Itinerary Planner", 
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=400&q=80", 
    desc: "Generate structured, daily travel schedules mapped dynamically on interactive Leaflet maps in real time." 
  },
  { 
    title: "Expense Splitter", 
    image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=400&q=80", 
    desc: "Manage group trip finances, split bills dynamically, track individual balances, and generate transparent reports." 
  },
  { 
    title: "Smart Reviews", 
    image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=400&q=80", 
    desc: "View detailed category ratings, historical traveler insights, alternative recommendations, and maps overlays." 
  }
];

const TESTIMONIALS = [
  {
    name: "Sarah Jenkins",
    role: "Adventure Enthusiast",
    text: "TripAI travel plan took all the friction out of our family vacation. The live expense splitting and mapping are game changers!",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
  },
  {
    name: "Rajesh Kumar",
    role: "Solo Backpacker",
    text: "The chatbot guide is incredibly smart. It helped me find the nearest hospital during a minor medical issue and re-routed my itinerary instantly.",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"
  },
  {
    name: "Elena Rostova",
    role: "Digital Nomad",
    text: "Collaboration features are gold. We could dynamically plan routes, vote on places, and coordinate without leaving the app.",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80"
  }
];

function AutocompleteCell({ label, placeholder, value, onChange, icon: Icon }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = CITY_DATA.filter((city) =>
    city.name.toLowerCase().includes(query.toLowerCase()) ||
    city.code.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mmt-input-segment relative hover:bg-white/5 transition-colors" ref={wrapperRef}>
      <label className="flex items-center gap-1 text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">
        {Icon && <Icon className="w-3.5 h-3.5 text-white/60" />}
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        className="w-full bg-transparent border-none p-0 text-base font-extrabold text-white focus:ring-0 outline-none placeholder-white/40"
      />
      {showSuggestions && query.length > 0 && (
        <div className="absolute left-0 w-full mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto text-left">
          {filtered.length > 0 ? (
            filtered.map((city) => (
              <div
                key={city.code}
                className="px-4 py-3 hover:bg-white/10 text-white/90 cursor-pointer transition-colors text-sm font-semibold border-b border-white/5 last:border-none flex justify-between items-center"
                onClick={() => {
                  onChange(city.code);
                  setQuery(city.code);
                  setShowSuggestions(false);
                }}
              >
                <div>{city.name}</div>
                <div className="text-xs bg-white/10 border border-white/20 text-cyan-400 px-2 py-0.5 rounded font-bold">{city.code}</div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-white/60 text-sm">No cities found</div>
          )}
        </div>
      )}
    </div>
  );
}

function TypewriterHeadline() {
  const words = [
    "Discover Beaches ✈️",
    "Discover Mountains 🏔️",
    "Discover Cities 🌆",
    "Discover Adventures 🚀"
  ];
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [blink, setBlink] = useState(true);
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    if (subIndex === words[index].length + 1 && !reverse) {
      setTimeout(() => setReverse(true), 1500);
      return;
    }

    if (subIndex === 0 && reverse) {
      setReverse(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (reverse ? -1 : 1));
    }, reverse ? 75 : 150);

    return () => clearTimeout(timeout);
  }, [subIndex, index, reverse]);

  useEffect(() => {
    const timeout2 = setInterval(() => {
      setBlink((prev) => !prev);
    }, 500);
    return () => clearInterval(timeout2);
  }, []);

  return (
    <span className="text-brand-secondary">
      {words[index].substring(0, subIndex)}
      <span className={blink ? "opacity-100" : "opacity-0"}>|</span>
    </span>
  );
}

function AnimatedCount({ value, duration = 2000 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value.substring(0, value.length - 1)) || parseInt(value);
    if (start === end) return;

    let totalMiliseconds = duration;
    let incrementTime = Math.abs(Math.floor(totalMiliseconds / end));
    if (incrementTime < 10) incrementTime = 10;

    let timer = setInterval(() => {
      start += 1;
      setCount(start);
      if (start >= end) {
        clearInterval(timer);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{count}{value.replace(/[0-9]/g, '')}</span>;
}

function FloatingElements() {
  const elements = [
    { emoji: "✈️", x: "10%", y: "20%", delay: 0 },
    { emoji: "🌍", x: "85%", y: "15%", delay: 1.5 },
    { emoji: "🏝️", x: "15%", y: "75%", delay: 0.8 },
    { emoji: "🧳", x: "80%", y: "70%", delay: 2.2 }
  ];

  return (
    <>
      {elements.map((el, i) => (
        <motion.div
          key={i}
          className="absolute text-3xl opacity-20 pointer-events-none select-none z-0 hidden md:block"
          style={{ left: el.x, top: el.y }}
          animate={{
            y: [0, -20, 0]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: el.delay,
            ease: "easeInOut"
          }}
        >
          {el.emoji}
        </motion.div>
      ))}
    </>
  );
}

export default function MainHome() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("itinerary");

  // Form states
  const [startCity, setStartCity] = useState("");
  const [destination, setDestination] = useState("");
  const [days, setDays] = useState("");
  const [theme, setTheme] = useState("");
  const [preferences, setPreferences] = useState("");

  const [flightFrom, setFlightFrom] = useState("");
  const [flightTo, setFlightTo] = useState("");
  const [flightDate, setFlightDate] = useState("");

  const [hotelCity, setHotelCity] = useState("");

  const [restaurantCity, setRestaurantCity] = useState("");

  const [trainFrom, setTrainFrom] = useState("");
  const [trainTo, setTrainTo] = useState("");
  const [trainDate, setTrainDate] = useState("");
  const [trainType, setTrainType] = useState("");

  const [busFrom, setBusFrom] = useState("");
  const [busTo, setBusTo] = useState("");
  const [busDate, setBusDate] = useState("");

  const tabs = [
    { id: "itinerary", label: "AI Planner", icon: Sparkles },
    { id: "flights", label: "Flights", icon: Plane },
    { id: "hotels", label: "Hotels", icon: Bed },
    { id: "restaurants", label: "Restaurants", icon: Utensils },
    { id: "trains", label: "Trains", icon: Train },
    { id: "buses", label: "Buses", icon: Bus }
  ];

  const handleSearch = () => {
    if (activeTab === "itinerary") {
      if (!destination || !days) {
        alert("Please enter at least destination and duration");
        return;
      }
      navigate(`/itinerary?start_city=${encodeURIComponent(startCity)}&destination=${encodeURIComponent(destination)}&days=${encodeURIComponent(days)}&theme=${encodeURIComponent(theme)}&preferences=${encodeURIComponent(preferences)}`);
    } else if (activeTab === "flights") {
      if (!flightFrom || !flightTo || !flightDate) {
        alert("Please fill in source, destination and date");
        return;
      }
      navigate(`/flights?source=${encodeURIComponent(flightFrom)}&destination=${encodeURIComponent(flightTo)}&departure=${encodeURIComponent(flightDate)}`);
    } else if (activeTab === "hotels") {
      if (!hotelCity) {
        alert("Please enter a city name");
        return;
      }
      navigate(`/hotels?city=${encodeURIComponent(hotelCity)}`);
    } else if (activeTab === "restaurants") {
      if (!restaurantCity) {
        alert("Please enter a city name");
        return;
      }
      navigate(`/restaurants?city=${encodeURIComponent(restaurantCity)}`);
    } else if (activeTab === "trains") {
      if (!trainFrom || !trainTo || !trainDate) {
        alert("Please fill in source, destination and date");
        return;
      }
      navigate(`/trainsearch?source=${encodeURIComponent(trainFrom)}&destination=${encodeURIComponent(trainTo)}&date=${encodeURIComponent(trainDate)}&type=${encodeURIComponent(trainType)}`);
    } else if (activeTab === "buses") {
      if (!busFrom || !busTo || !busDate) {
        alert("Please fill in source, destination and date");
        return;
      }
      navigate(`/bussearch?source=${encodeURIComponent(busFrom)}&destination=${encodeURIComponent(busTo)}&departure=${encodeURIComponent(busDate)}`);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-73px)] bg-brand-bg flex flex-col items-center overflow-x-hidden">
      {/* Full-Screen Hero Section */}
      <div 
        className="relative min-h-screen w-full bg-cover bg-center flex flex-col items-center justify-center pt-24 pb-28 px-4 overflow-hidden"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e')"
        }}
      >
        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          poster="https://images.unsplash.com/photo-1507525428034-b723cf961d3e"
        >
          <source src="https://assets.mixkit.co/videos/preview/mixkit-travel-by-airplane-above-the-clouds-39856-large.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] z-0" />

        {/* Floating animated elements */}
        <FloatingElements />

        {/* Hero Content Area */}
        <div className="relative z-10 w-full max-w-5xl flex flex-col items-center text-center space-y-6">
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight"
          >
            Explore The World With <span className="bg-gradient-to-r from-cyan-400 to-brand-secondary bg-clip-text text-transparent">AI</span>
          </motion.h1>

          <h2 className="text-xl md:text-2xl font-bold text-slate-200">
            <TypewriterHeadline />
          </h2>

          {/* Floating Search Panel */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="w-full mt-8"
          >
            {/* Navigation Tabs (Glassmorphism) */}
            <div className="flex justify-center flex-wrap gap-2 mb-3 bg-white/10 backdrop-blur-xl p-2.5 rounded-t-2xl border-x border-t border-white/20 shadow-lg">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                      isActive
                        ? "bg-white/25 text-white shadow-inner border border-white/30"
                        : "text-white/70 hover:text-white bg-transparent border border-transparent"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-white animate-pulse" : "text-white/60"}`} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Input Cards Container (Glassmorphism) */}
            <div className="mmt-search-card shadow-2xl relative bg-white/10 backdrop-blur-xl p-6 rounded-b-2xl border-x border-b border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] text-left z-20">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === "itinerary" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 border border-white/20 rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/20 bg-white/5 backdrop-blur-md shadow-inner">
                        <AutocompleteCell
                          label="Starting City"
                          placeholder="e.g. BOM"
                          value={startCity}
                          onChange={setStartCity}
                          icon={MapPin}
                        />
                        <AutocompleteCell
                          label="Destination"
                          placeholder="e.g. DXB"
                          value={destination}
                          onChange={setDestination}
                          icon={MapPin}
                        />
                        <div className="mmt-input-segment hover:bg-white/5 transition-colors">
                          <label className="flex items-center gap-1 text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">
                            <Calendar className="w-3.5 h-3.5 text-white/60" />
                            Duration
                          </label>
                          <input
                            type="number"
                            placeholder="Days"
                            value={days}
                            onChange={(e) => setDays(e.target.value)}
                            className="w-full bg-transparent border-none p-0 text-base font-extrabold text-white focus:ring-0 outline-none placeholder-white/40"
                          />
                        </div>
                        <div className="mmt-input-segment hover:bg-white/5 transition-colors">
                          <label className="flex items-center gap-1 text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-white/60" />
                            Theme
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Adventure, Relax"
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="w-full bg-transparent border-none p-0 text-base font-extrabold text-white focus:ring-0 outline-none placeholder-white/40"
                          />
                        </div>
                      </div>
                      <textarea
                        placeholder="Additional preferences (e.g. vegetarian, low walking, museums, budget)"
                        value={preferences}
                        onChange={(e) => setPreferences(e.target.value)}
                        rows={2}
                        className="w-full border border-white/20 bg-white/5 backdrop-blur-md rounded-xl px-4 py-3 mt-4 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none text-white placeholder-white/40 text-sm"
                      />
                    </div>
                  )}

                  {activeTab === "flights" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 border border-white/20 rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/20 bg-white/5 backdrop-blur-md shadow-inner">
                      <AutocompleteCell
                        label="From"
                        placeholder="e.g. BOM"
                        value={flightFrom}
                        onChange={setFlightFrom}
                        icon={MapPin}
                      />
                      <AutocompleteCell
                        label="To"
                        placeholder="e.g. DEL"
                        value={flightTo}
                        onChange={setFlightTo}
                        icon={MapPin}
                      />
                      <div className="mmt-input-segment col-span-1 md:col-span-2 hover:bg-white/5 transition-colors">
                        <label className="flex items-center gap-1 text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">
                          <Calendar className="w-3.5 h-3.5 text-white/60" />
                          Departure Date
                        </label>
                        <input
                          type="date"
                          value={flightDate}
                          onChange={(e) => setFlightDate(e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-base font-extrabold text-white focus:ring-0 outline-none placeholder-white/40 cursor-pointer [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === "hotels" && (
                    <div className="grid grid-cols-1 border border-white/20 rounded-xl overflow-hidden bg-white/5 backdrop-blur-md shadow-inner">
                      <AutocompleteCell
                        label="Enter City"
                        placeholder="Where to stay? (e.g. Mumbai)"
                        value={hotelCity}
                        onChange={setHotelCity}
                        icon={MapPin}
                      />
                    </div>
                  )}

                  {activeTab === "restaurants" && (
                    <div className="grid grid-cols-1 border border-white/20 rounded-xl overflow-hidden bg-white/5 backdrop-blur-md shadow-inner">
                      <AutocompleteCell
                        label="Enter City"
                        placeholder="Find culinary options (e.g. Mumbai)"
                        value={restaurantCity}
                        onChange={setRestaurantCity}
                        icon={MapPin}
                      />
                    </div>
                  )}

                  {activeTab === "trains" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 border border-white/20 rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/20 bg-white/5 backdrop-blur-md shadow-inner">
                      <AutocompleteCell
                        label="From Station"
                        placeholder="e.g. BOM"
                        value={trainFrom}
                        onChange={setTrainFrom}
                        icon={MapPin}
                      />
                      <AutocompleteCell
                        label="To Station"
                        placeholder="e.g. DEL"
                        value={trainTo}
                        onChange={setTrainTo}
                        icon={MapPin}
                      />
                      <div className="mmt-input-segment hover:bg-white/5 transition-colors">
                        <label className="flex items-center gap-1 text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">
                          <Calendar className="w-3.5 h-3.5 text-white/60" />
                          Travel Date
                        </label>
                        <input
                          type="date"
                          value={trainDate}
                          onChange={(e) => setTrainDate(e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-base font-extrabold text-white focus:ring-0 outline-none placeholder-white/40 cursor-pointer [color-scheme:dark]"
                        />
                      </div>
                      <div className="mmt-input-segment hover:bg-white/5 transition-colors">
                        <label className="flex items-center gap-1 text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">
                          <Train className="w-3.5 h-3.5 text-white/60" />
                          Train Class
                        </label>
                        <select
                          value={trainType}
                          onChange={(e) => setTrainType(e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-base font-extrabold text-white focus:ring-0 outline-none cursor-pointer [color-scheme:dark]"
                        >
                          <option value="" className="bg-slate-900 text-white">All Classes</option>
                          <option value="Express" className="bg-slate-900 text-white">Express</option>
                          <option value="Passenger" className="bg-slate-900 text-white">Passenger</option>
                          <option value="Superfast" className="bg-slate-900 text-white">Superfast</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {activeTab === "buses" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 border border-white/20 rounded-xl overflow-hidden divide-y md:divide-y-0 md:divide-x divide-white/20 bg-white/5 backdrop-blur-md shadow-inner">
                      <AutocompleteCell
                        label="From City"
                        placeholder="Source city"
                        value={busFrom}
                        onChange={setBusFrom}
                        icon={MapPin}
                      />
                      <AutocompleteCell
                        label="To City"
                        placeholder="Destination city"
                        value={busTo}
                        onChange={setBusTo}
                        icon={MapPin}
                      />
                      <div className="mmt-input-segment col-span-1 md:col-span-2 hover:bg-white/5 transition-colors">
                        <label className="flex items-center gap-1 text-[10px] font-black text-white/70 uppercase tracking-wider mb-1">
                          <Calendar className="w-3.5 h-3.5 text-white/60" />
                          Travel Date
                        </label>
                        <input
                          type="date"
                          value={busDate}
                          onChange={(e) => setBusDate(e.target.value)}
                          className="w-full bg-transparent border-none p-0 text-base font-extrabold text-white focus:ring-0 outline-none placeholder-white/40 cursor-pointer [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Hanging Modern Cyan-Blue Gradient Search CTA Button */}
              <motion.button
                onClick={handleSearch}
                whileHover={{ scale: 1.05 }}
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-12 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-extrabold text-base rounded-full shadow-xl shadow-blue-500/20 transition-all uppercase tracking-wider z-10 shrink-0 border-none cursor-pointer flex items-center gap-2 justify-center"
              >
                <Search className="w-4 h-4 text-white" />
                Search
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Popular Destinations Section */}
      <div className="w-full max-w-5xl px-4 py-16 text-left">
        <h2 className="text-3xl font-black text-[#0a2240] tracking-tight mb-2">
          Popular Destinations
        </h2>
        <p className="text-slate-500 text-sm mb-8 font-medium">Most recommended getaways based on AI planner search history.</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {POPULAR_DESTINATIONS.map((dest, i) => (
            <motion.div
              key={i}
              whileHover={{
                scale: 1.05,
                y: -10
              }}
              className="relative rounded-2xl overflow-hidden shadow-md cursor-pointer group h-64 border border-slate-200/50 bg-white"
              onClick={() => {
                setDestination(dest.name);
                setActiveTab("itinerary");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <img 
                src={dest.image} 
                alt={dest.name} 
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute bottom-4 left-4 text-white">
                <h3 className="font-extrabold text-lg tracking-tight">{dest.name}</h3>
                <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">{dest.count}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Parallax Background Divider */}
      <div 
        className="relative w-full h-[300px] bg-fixed bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1600&q=80')" }}
      >
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" />
        <div className="relative z-10 text-center text-white px-4">
          <h3 className="text-3xl md:text-4xl font-black mb-3">Adventure Awaits, Go Find It</h3>
          <p className="text-sm text-slate-200 max-w-xl mx-auto leading-relaxed">
            Generate your custom daily travel routes, coordinate live with friends, split budgets transparently, and download complete itinerary books offline.
          </p>
        </div>
      </div>

      {/* Statistics Banner */}
      <div className="w-full bg-[#0a2240] py-16 text-white text-center border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="space-y-1">
            <h4 className="text-3xl md:text-4xl font-black text-cyan-400">
              <AnimatedCount value="50K+" />
            </h4>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Happy Travelers</p>
          </div>
          <div className="space-y-1">
            <h4 className="text-3xl md:text-4xl font-black text-cyan-400">
              <AnimatedCount value="120+" />
            </h4>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Destinations Covered</p>
          </div>
          <div className="space-y-1">
            <h4 className="text-3xl md:text-4xl font-black text-cyan-400">
              <AnimatedCount value="4.9" />
            </h4>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Rating Scores</p>
          </div>
          <div className="space-y-1">
            <h4 className="text-3xl md:text-4xl font-black text-cyan-400">
              <span>24/7</span>
            </h4>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">AI Assistant Guide</p>
          </div>
        </div>
      </div>

      {/* Why Choose Us Features Section */}
      <div className="w-full max-w-5xl px-4 py-16 text-left">
        <h2 className="text-3xl font-black text-[#0a2240] tracking-tight mb-2 text-center md:text-left">
          Why Plan With TripAI Travel?
        </h2>
        <p className="text-slate-500 text-sm mb-12 text-center md:text-left font-medium">Next-generation workspace tools designed for collaborative planning.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {FEATURES.map((feature, i) => (
            <div 
              key={i} 
              className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-stretch"
            >
              <div className="w-full md:w-2/5 h-48 md:h-auto relative shrink-0">
                <img 
                  src={feature.image} 
                  alt={feature.title} 
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex flex-col justify-center text-left">
                <h3 className="font-extrabold text-slate-900 text-lg mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-secondary" />
                  {feature.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="w-full bg-slate-50 py-16 border-t border-slate-200/50">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-black text-[#0a2240] tracking-tight mb-2">
            What Our Travelers Say
          </h2>
          <p className="text-slate-500 text-sm mb-12 font-medium">Real reviews from our community who coordinated group plans.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div 
                key={i} 
                className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all text-left flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex text-amber-500 gap-0.5">
                    {Array.from({ length: t.rating }).map((_, idx) => (
                      <span key={idx}>⭐</span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 italic leading-relaxed font-medium">
                    "{t.text}"
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-6 border-t border-slate-100 pt-4">
                  <img 
                    src={t.avatar} 
                    alt={t.name} 
                    className="w-9 h-9 rounded-full object-cover bg-slate-100"
                  />
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs leading-none">{t.name}</h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 inline-block">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full bg-[#0a2240] text-slate-400 py-16 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 text-left">
          <div className="space-y-4">
            <h4 className="text-white font-extrabold text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-secondary" />
              <span>TripAI Travel</span>
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Your next-generation generative AI travel assistant. Plan, collaborate, budget, and explore like never before.
            </p>
          </div>
          <div>
            <h5 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">Services</h5>
            <ul className="space-y-2 text-xs text-slate-400 list-none p-0">
              <li><a href="#" className="hover:text-white transition-colors">AI Itineraries</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Flight Booking</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Hotels & Stays</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Local Dinings</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">Resources</h5>
            <ul className="space-y-2 text-xs text-slate-400 list-none p-0">
              <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Travel Guides</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-white font-bold text-sm mb-4 uppercase tracking-wider">Contact</h5>
            <ul className="space-y-2 text-xs text-slate-400 list-none p-0">
              <li>Email: contact@tripai.travel</li>
              <li>Support: +1 (800) 555-TRIP</li>
              <li>Location: San Francisco, CA</li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 mt-12 pt-8 border-t border-white/5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} TripAI Travel Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
