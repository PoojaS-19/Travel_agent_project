import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./MainHome.css";

const MONTHS = [
  "Any Month",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CATEGORIES = [
  { name: "All", icon: "ALL" },
  { name: "Religious", icon: "REL" },
  { name: "Cultural", icon: "CUL" },
  { name: "Nature", icon: "NAT" },
  { name: "Food", icon: "FOD" },
  { name: "Festivals", icon: "FST" },
  { name: "Historical", icon: "HIS" },
  { name: "Shopping", icon: "SHP" },
  { name: "Beaches", icon: "SEA" },
  { name: "Mountains", icon: "MTN" },
  { name: "Outdoors", icon: "ADV" },
  { name: "Nightlife", icon: "NGT" },
  { name: "Luxury", icon: "LUX" },
];

const FROM_CITIES = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Pune",
  "Chennai",
  "Hyderabad",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
];

const PLACE_BATCH_SIZE = 8;

const PLACES = [
  {
    name: "Lonavala",
    state: "Maharashtra",
    country: "India",
    scope: "domestic",
    categories: ["Nature", "Outdoors", "Food"],
    image: "https://images.unsplash.com/photo-1625505826533-5c80aca7d157?auto=format&fit=crop&w=600&q=80",
    budget: 5000,
    travelHours: 2,
    weather: "rain",
    transport: { bus: "Rs 350", train: "Rs 180", car: "Rs 1,200" },
    hotel: "Rs 1,500/n",
    info: "A quick hill-station escape near Mumbai and Pune, known for monsoon views, caves, chikki, and easy weekend stays.",
  },
  {
    name: "Mulshi",
    state: "Maharashtra",
    country: "India",
    scope: "domestic",
    categories: ["Nature", "Outdoors"],
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=600&q=80",
    budget: 4000,
    travelHours: 2,
    weather: "rain",
    transport: { bus: "Rs 250", car: "Rs 900" },
    hotel: "Rs 2,000/n",
    info: "A calm lake-and-ghat destination near Pune, ideal for resorts, short drives, rain views, and quiet nature breaks.",
  },
  {
    name: "Vani",
    state: "Maharashtra",
    country: "India",
    scope: "domestic",
    categories: ["Religious", "Nature", "Historical"],
    image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80",
    budget: 3000,
    travelHours: 3,
    weather: "rain",
    transport: { bus: "Rs 400", car: "Rs 1,500" },
    hotel: "Rs 800/n",
    info: "A devotional trip base for Saptashrungi temple, surrounded by hills, local food stops, and peaceful rural scenery.",
  },
  {
    name: "Kolad",
    state: "Maharashtra",
    country: "India",
    scope: "domestic",
    categories: ["Outdoors", "Nature", "Beaches"],
    image: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80",
    budget: 5500,
    travelHours: 3,
    weather: "rain",
    transport: { bus: "Rs 450", train: "Rs 220", car: "Rs 1,400" },
    hotel: "Rs 1,800/n",
    info: "A rafting and adventure spot on the Kundalika river, good for camping, water sports, and monsoon weekend plans.",
  },
  {
    name: "Mussoorie",
    state: "Uttarakhand",
    country: "India",
    scope: "domestic",
    categories: ["Mountains", "Nature", "Shopping"],
    image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=600&q=80",
    budget: 12000,
    travelHours: 7,
    weather: "no-rain",
    transport: { bus: "Rs 850", train: "Rs 550", flight: "Rs 4,200" },
    hotel: "Rs 2,500/n",
    info: "A classic hill-station trip with mall road walks, viewpoints, cafes, colonial charm, and easy access from Dehradun.",
  },
  {
    name: "Manali",
    state: "Himachal Pradesh",
    country: "India",
    scope: "domestic",
    categories: ["Mountains", "Outdoors", "Nature", "Luxury"],
    image: "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=600&q=80",
    budget: 10000,
    travelHours: 10,
    weather: "no-rain",
    transport: { bus: "Rs 900", flight: "Rs 5,500" },
    hotel: "Rs 2,200/n",
    info: "A mountain favourite for snow views, cafes, river valleys, adventure sports, and relaxed Himachal stays.",
  },
  {
    name: "Goa",
    state: "Goa",
    country: "India",
    scope: "domestic",
    categories: ["Beaches", "Food", "Nightlife", "Luxury"],
    image: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=600&q=80",
    budget: 16000,
    travelHours: 2,
    weather: "no-rain",
    transport: { flight: "Rs 3,800", train: "Rs 650", bus: "Rs 1,200" },
    hotel: "Rs 2,800/n",
    info: "India's beach classic for seafood, nightlife, forts, churches, markets, and slow coastal days.",
  },
  {
    name: "Jaipur",
    state: "Rajasthan",
    country: "India",
    scope: "domestic",
    categories: ["Cultural", "Historical", "Shopping", "Food"],
    image: "https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80",
    budget: 11000,
    travelHours: 3,
    weather: "no-rain",
    transport: { flight: "Rs 3,200", train: "Rs 750", bus: "Rs 950" },
    hotel: "Rs 2,100/n",
    info: "The Pink City blends forts, palaces, bazaars, Rajasthani food, handicrafts, and colourful heritage walks.",
  },
  {
    name: "Udaipur",
    state: "Rajasthan",
    country: "India",
    scope: "domestic",
    categories: ["Cultural", "Historical", "Luxury", "Food"],
    image: "https://images.unsplash.com/photo-1598890777032-bde835ba27c2?auto=format&fit=crop&w=600&q=80",
    budget: 15000,
    travelHours: 5,
    weather: "no-rain",
    transport: { flight: "Rs 4,500", train: "Rs 900", bus: "Rs 1,100" },
    hotel: "Rs 3,000/n",
    info: "A romantic lake city with palaces, boat rides, rooftop dining, craft markets, and scenic luxury stays.",
  },
  {
    name: "Rishikesh",
    state: "Uttarakhand",
    country: "India",
    scope: "domestic",
    categories: ["Religious", "Nature", "Outdoors", "Food"],
    image: "https://images.unsplash.com/photo-1609947017136-9daf32a5eb16?auto=format&fit=crop&w=600&q=80",
    budget: 9000,
    travelHours: 6,
    weather: "no-rain",
    transport: { bus: "Rs 650", train: "Rs 500", car: "Rs 2,500" },
    hotel: "Rs 1,600/n",
    info: "A Ganga-side mix of yoga, temples, cafes, river rafting, evening aarti, and Himalayan foothill views.",
  },
  {
    name: "Varanasi",
    state: "Uttar Pradesh",
    country: "India",
    scope: "domestic",
    categories: ["Religious", "Cultural", "Historical", "Food"],
    image: "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?auto=format&fit=crop&w=600&q=80",
    budget: 9500,
    travelHours: 4,
    weather: "no-rain",
    transport: { flight: "Rs 4,200", train: "Rs 800" },
    hotel: "Rs 1,700/n",
    info: "One of India's oldest living cities, famous for ghats, Ganga aarti, temples, silk, music, and street food.",
  },
  {
    name: "Munnar",
    state: "Kerala",
    country: "India",
    scope: "domestic",
    categories: ["Nature", "Mountains", "Luxury", "Food"],
    image: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=600&q=80",
    budget: 14000,
    travelHours: 6,
    weather: "rain",
    transport: { flight: "Rs 5,000", bus: "Rs 900", car: "Rs 3,000" },
    hotel: "Rs 2,500/n",
    info: "A tea-garden hill escape in Kerala with misty viewpoints, waterfalls, spice routes, and resort stays.",
  },
  {
    name: "Pondicherry",
    state: "Puducherry",
    country: "India",
    scope: "domestic",
    categories: ["Beaches", "Cultural", "Food", "Shopping"],
    image: "https://images.unsplash.com/photo-1597074866923-dc0589150358?auto=format&fit=crop&w=600&q=80",
    budget: 12000,
    travelHours: 4,
    weather: "no-rain",
    transport: { bus: "Rs 700", train: "Rs 450", car: "Rs 2,200" },
    hotel: "Rs 2,200/n",
    info: "A coastal town with French quarters, beaches, bakeries, cafes, Auroville, and relaxed cycling routes.",
  },
  {
    name: "Hampi",
    state: "Karnataka",
    country: "India",
    scope: "domestic",
    categories: ["Historical", "Cultural", "Nature", "Outdoors"],
    image: "https://images.unsplash.com/photo-1571988042231-d39a9cc12a9a?auto=format&fit=crop&w=600&q=80",
    budget: 8500,
    travelHours: 7,
    weather: "no-rain",
    transport: { train: "Rs 650", bus: "Rs 850", car: "Rs 3,200" },
    hotel: "Rs 1,500/n",
    info: "A UNESCO heritage landscape of boulders, temples, ruins, river views, cycling trails, and sunset points.",
  },
  {
    name: "Darjeeling",
    state: "West Bengal",
    country: "India",
    scope: "domestic",
    categories: ["Mountains", "Nature", "Cultural", "Food"],
    image: "https://images.unsplash.com/photo-1544634076-a90160ddf864?auto=format&fit=crop&w=600&q=80",
    budget: 13000,
    travelHours: 6,
    weather: "rain",
    transport: { flight: "Rs 5,200", train: "Rs 900", car: "Rs 2,800" },
    hotel: "Rs 2,200/n",
    info: "A tea-and-mountain trip with toy train rides, Kanchenjunga views, monasteries, cafes, and colonial charm.",
  },
  {
    name: "Kochi",
    state: "Kerala",
    country: "India",
    scope: "domestic",
    categories: ["Cultural", "Food", "Historical", "Shopping"],
    image: "https://images.unsplash.com/photo-1590123732197-8dc3cf5b2b57?auto=format&fit=crop&w=600&q=80",
    budget: 12500,
    travelHours: 3,
    weather: "rain",
    transport: { flight: "Rs 4,300", train: "Rs 800", bus: "Rs 900" },
    hotel: "Rs 2,100/n",
    info: "A port city rich in spice history, Fort Kochi streets, art cafes, Chinese fishing nets, and seafood.",
  },
  {
    name: "Shillong",
    state: "Meghalaya",
    country: "India",
    scope: "domestic",
    categories: ["Nature", "Mountains", "Food", "Outdoors"],
    image: "https://images.unsplash.com/photo-1625826410017-9bd7ca07c39b?auto=format&fit=crop&w=600&q=80",
    budget: 17000,
    travelHours: 7,
    weather: "rain",
    transport: { flight: "Rs 6,000", car: "Rs 3,500" },
    hotel: "Rs 2,600/n",
    info: "A Northeast hill-city base for waterfalls, caves, living-root bridge trips, music cafes, and cloudy views.",
  },
  {
    name: "Kashmir",
    state: "Jammu and Kashmir",
    country: "India",
    scope: "domestic",
    categories: ["Mountains", "Nature", "Luxury", "Cultural"],
    image: "https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=600&q=80",
    budget: 22000,
    travelHours: 5,
    weather: "no-rain",
    transport: { flight: "Rs 6,500", car: "Rs 4,000" },
    hotel: "Rs 3,500/n",
    info: "A scenic valley trip for Dal Lake, gardens, snow views, houseboats, meadows, and slow mountain drives.",
  },
  {
    name: "Leh",
    state: "Ladakh",
    country: "India",
    scope: "domestic",
    categories: ["Mountains", "Outdoors", "Nature", "Cultural"],
    image: "https://images.unsplash.com/photo-1589793907316-f94025b46850?auto=format&fit=crop&w=600&q=80",
    budget: 28000,
    travelHours: 8,
    weather: "no-rain",
    transport: { flight: "Rs 7,500", car: "Rs 5,500" },
    hotel: "Rs 3,200/n",
    info: "A high-altitude adventure base for monasteries, Pangong Lake, Nubra Valley, passes, and stark Himalayan views.",
  },
  {
    name: "Amritsar",
    state: "Punjab",
    country: "India",
    scope: "domestic",
    categories: ["Religious", "Cultural", "Historical", "Food"],
    image: "https://images.unsplash.com/photo-1609948543911-7f01ff385be5?auto=format&fit=crop&w=600&q=80",
    budget: 9000,
    travelHours: 4,
    weather: "no-rain",
    transport: { flight: "Rs 4,200", train: "Rs 750", bus: "Rs 1,000" },
    hotel: "Rs 1,800/n",
    info: "A soulful city for the Golden Temple, Wagah border, Punjabi food, heritage streets, and night markets.",
  },
  {
    name: "Agra",
    state: "Uttar Pradesh",
    country: "India",
    scope: "domestic",
    categories: ["Historical", "Cultural", "Food", "Shopping"],
    image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80",
    budget: 8000,
    travelHours: 3,
    weather: "no-rain",
    transport: { train: "Rs 650", bus: "Rs 700", car: "Rs 2,000" },
    hotel: "Rs 1,700/n",
    info: "A heritage favourite for the Taj Mahal, Agra Fort, Mughal gardens, marble crafts, and petha stops.",
  },
  {
    name: "Jaisalmer",
    state: "Rajasthan",
    country: "India",
    scope: "domestic",
    categories: ["Historical", "Cultural", "Outdoors", "Festivals"],
    image: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=600&q=80",
    budget: 16000,
    travelHours: 8,
    weather: "no-rain",
    transport: { train: "Rs 950", bus: "Rs 1,400", flight: "Rs 6,000" },
    hotel: "Rs 2,500/n",
    info: "A desert trip for golden forts, havelis, camel safaris, dunes, folk music, and starry night camps.",
  },
  {
    name: "Ranthambore",
    state: "Rajasthan",
    country: "India",
    scope: "domestic",
    categories: ["Nature", "Outdoors", "Luxury", "Historical"],
    image: "https://images.unsplash.com/photo-1549366021-9f761d040a94?auto=format&fit=crop&w=600&q=80",
    budget: 18000,
    travelHours: 6,
    weather: "no-rain",
    transport: { train: "Rs 850", car: "Rs 3,500" },
    hotel: "Rs 3,200/n",
    info: "A wildlife getaway known for tiger safaris, forest drives, old fort views, and lodge-style stays.",
  },
  {
    name: "Ooty",
    state: "Tamil Nadu",
    country: "India",
    scope: "domestic",
    categories: ["Mountains", "Nature", "Food", "Shopping"],
    image: "https://images.unsplash.com/photo-1605540436563-5bca919ae766?auto=format&fit=crop&w=600&q=80",
    budget: 12000,
    travelHours: 6,
    weather: "rain",
    transport: { train: "Rs 600", bus: "Rs 850", car: "Rs 2,800" },
    hotel: "Rs 2,200/n",
    info: "A Nilgiri hill-station trip for tea gardens, toy train rides, lakes, viewpoints, and chocolate shops.",
  },
  {
    name: "Coorg",
    state: "Karnataka",
    country: "India",
    scope: "domestic",
    categories: ["Nature", "Mountains", "Food", "Luxury"],
    image: "https://images.unsplash.com/photo-1600100397608-f010a7e1f7c8?auto=format&fit=crop&w=600&q=80",
    budget: 15000,
    travelHours: 6,
    weather: "rain",
    transport: { bus: "Rs 900", car: "Rs 3,000" },
    hotel: "Rs 2,800/n",
    info: "A coffee-country escape with plantations, waterfalls, homestays, forest roads, and Kodava food.",
  },
  {
    name: "Gokarna",
    state: "Karnataka",
    country: "India",
    scope: "domestic",
    categories: ["Beaches", "Religious", "Nature", "Food"],
    image: "https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?auto=format&fit=crop&w=600&q=80",
    budget: 10000,
    travelHours: 7,
    weather: "no-rain",
    transport: { train: "Rs 700", bus: "Rs 900", car: "Rs 3,200" },
    hotel: "Rs 1,900/n",
    info: "A laid-back beach town with temple visits, cliff walks, cafes, clean beaches, and slower coastal energy.",
  },
  {
    name: "Mahabaleshwar",
    state: "Maharashtra",
    country: "India",
    scope: "domestic",
    categories: ["Mountains", "Nature", "Food", "Shopping"],
    image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80",
    budget: 8000,
    travelHours: 5,
    weather: "rain",
    transport: { bus: "Rs 600", car: "Rs 2,200" },
    hotel: "Rs 2,000/n",
    info: "A popular Western Ghats break for viewpoints, strawberries, boating, forest roads, and family resorts.",
  },
  {
    name: "Nashik",
    state: "Maharashtra",
    country: "India",
    scope: "domestic",
    categories: ["Religious", "Food", "Cultural", "Nature"],
    image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80",
    budget: 7000,
    travelHours: 3,
    weather: "no-rain",
    transport: { train: "Rs 250", bus: "Rs 450", car: "Rs 1,600" },
    hotel: "Rs 1,500/n",
    info: "A mix of temples, vineyards, river ghats, caves, and relaxed food-and-drive itineraries from Mumbai or Pune.",
  },
  {
    name: "Alibaug",
    state: "Maharashtra",
    country: "India",
    scope: "domestic",
    categories: ["Beaches", "Food", "Nature", "Luxury"],
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
    budget: 9000,
    travelHours: 3,
    weather: "no-rain",
    transport: { bus: "Rs 450", car: "Rs 2,000" },
    hotel: "Rs 2,400/n",
    info: "A quick coastal break near Mumbai with beaches, forts, seafood, villas, ferries, and easy weekend routes.",
  },
  {
    name: "Kodaikanal",
    state: "Tamil Nadu",
    country: "India",
    scope: "domestic",
    categories: ["Mountains", "Nature", "Food", "Shopping"],
    image: "https://images.unsplash.com/photo-1579689189009-874f5cac2db5?auto=format&fit=crop&w=600&q=80",
    budget: 12000,
    travelHours: 7,
    weather: "rain",
    transport: { bus: "Rs 900", train: "Rs 700", car: "Rs 3,200" },
    hotel: "Rs 2,200/n",
    info: "A misty hill-station pick for lake walks, pine forests, cafes, homemade chocolates, and cool weather.",
  },
  {
    name: "Madurai",
    state: "Tamil Nadu",
    country: "India",
    scope: "domestic",
    categories: ["Religious", "Cultural", "Historical", "Food"],
    image: "https://images.unsplash.com/photo-1621427863027-4f84ff43f3b7?auto=format&fit=crop&w=600&q=80",
    budget: 9500,
    travelHours: 4,
    weather: "no-rain",
    transport: { flight: "Rs 4,500", train: "Rs 750", bus: "Rs 850" },
    hotel: "Rs 1,700/n",
    info: "A temple city famous for Meenakshi Amman Temple, jasmine, local markets, heritage streets, and South Indian food.",
  },
  {
    name: "Rameswaram",
    state: "Tamil Nadu",
    country: "India",
    scope: "domestic",
    categories: ["Religious", "Beaches", "Historical", "Nature"],
    image: "https://images.unsplash.com/photo-1582972236019-ea4af5ffe587?auto=format&fit=crop&w=600&q=80",
    budget: 11000,
    travelHours: 7,
    weather: "no-rain",
    transport: { train: "Rs 850", bus: "Rs 950", car: "Rs 3,500" },
    hotel: "Rs 1,900/n",
    info: "A spiritual coastal journey for Ramanathaswamy Temple, Pamban bridge, Dhanushkodi, and sea-view drives.",
  },
  {
    name: "Khajuraho",
    state: "Madhya Pradesh",
    country: "India",
    scope: "domestic",
    categories: ["Historical", "Cultural", "Festivals", "Shopping"],
    image: "https://images.unsplash.com/photo-1603262110263-fb0112e7cc33?auto=format&fit=crop&w=600&q=80",
    budget: 12000,
    travelHours: 6,
    weather: "no-rain",
    transport: { flight: "Rs 5,500", train: "Rs 850" },
    hotel: "Rs 2,000/n",
    info: "A UNESCO temple-town experience with detailed stone carvings, heritage walks, dance festivals, and quiet stays.",
  },
  {
    name: "Pachmarhi",
    state: "Madhya Pradesh",
    country: "India",
    scope: "domestic",
    categories: ["Nature", "Mountains", "Historical", "Outdoors"],
    image: "https://images.unsplash.com/photo-1518002054494-3a6f94352e9d?auto=format&fit=crop&w=600&q=80",
    budget: 10000,
    travelHours: 7,
    weather: "rain",
    transport: { train: "Rs 750", car: "Rs 3,200" },
    hotel: "Rs 2,000/n",
    info: "A green central-India hill retreat with caves, waterfalls, viewpoints, forest roads, and easy nature trails.",
  },
];

function RangeSlider({ min, max, value, onChange, formatLabel, step = 1 }) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="range-slider-container">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="range-slider-input"
        style={{
          background: `linear-gradient(to right, #ec5b24 0%, #ec5b24 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`,
        }}
      />
      <div className="range-slider-labels">
        <span>{formatLabel(min)}</span>
        <span className="range-current-value">{formatLabel(value)}</span>
        <span>{formatLabel(max)}</span>
      </div>
    </div>
  );
}

function PlaceDetailPanel({ place, activeTab, onTabChange, onPlanTrip, onClose }) {
  const tabs = ["Overview", "Places to Stay", "Things to do", "How to Reach", "More"];

  const tabContent = {
    Overview: (
      <p>{place.info}</p>
    ),
    "Places to Stay": (
      <div className="place-detail-list">
        <span>Budget stays from {place.hotel}</span>
        <span>Boutique hotels and homestays near central attractions</span>
        <span>Family-friendly stays with easy transport access</span>
      </div>
    ),
    "Things to do": (
      <div className="place-detail-list">
        {place.categories.map((category) => (
          <span key={category}>{category} experiences</span>
        ))}
        <span>Local food stops, photo points, markets, and relaxed evening walks</span>
      </div>
    ),
    "How to Reach": (
      <div className="place-detail-list">
        {Object.entries(place.transport).map(([mode, price]) => (
          <span key={mode}>{mode[0].toUpperCase() + mode.slice(1)} options from {price}</span>
        ))}
        <span>Approx travel time: {place.travelHours >= 12 ? "12h+" : `${place.travelHours}h`}</span>
      </div>
    ),
    More: (
      <div className="place-detail-list">
        <span>Suggested budget: Rs {place.budget.toLocaleString("en-IN")}</span>
        <span>Best for: {place.categories.join(", ")}</span>
        <span>Weather preference: {place.weather === "rain" ? "Great in monsoon" : "Best in clear weather"}</span>
      </div>
    ),
  };

  return (
    <section className="place-detail-panel">
      <div
        className="place-detail-hero"
        style={{ backgroundImage: `url('${place.image}')` }}
      >
        <div className="place-detail-card">
          <button className="place-detail-close" onClick={onClose} aria-label="Close place details">
            x
          </button>
          <h2>{place.name}, {place.state}, {place.country}</h2>
          <p>{place.info}</p>
          <div className="place-detail-badges">
            <span>{place.travelHours >= 12 ? "12h+" : `${place.travelHours}h`} travel</span>
            <span>From Rs {place.budget.toLocaleString("en-IN")}</span>
            <span>{place.categories[0]}</span>
          </div>
        </div>
      </div>

      <div className="place-detail-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`place-detail-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => onTabChange(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="place-detail-body">
        <div className="place-detail-copy">
          <h3>{activeTab}</h3>
          {tabContent[activeTab]}
        </div>
        <button className="place-detail-plan-btn" onClick={() => onPlanTrip(place)}>
          Plan itinerary for {place.name}
        </button>
      </div>
    </section>
  );
}

export default function MainHome() {
  const navigate = useNavigate();
  const categoryScrollRef = useRef(null);
  const fromRef = useRef(null);
  const loadMoreRef = useRef(null);

  const [fromCity, setFromCity] = useState("");
  const [travelMonth, setTravelMonth] = useState("Any Month");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [scope, setScope] = useState("all");
  const [budgetMax, setBudgetMax] = useState(100000);
  const [travelTimeMax, setTravelTimeMax] = useState(12);
  const [weatherFilter, setWeatherFilter] = useState("all");
  const [visiblePlaceCount, setVisiblePlaceCount] = useState(PLACE_BATCH_SIZE);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [activePlaceTab, setActivePlaceTab] = useState("Overview");

  useEffect(() => {
    const handler = (event) => {
      if (fromRef.current && !fromRef.current.contains(event.target)) {
        setShowFromDropdown(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredFromCities = useMemo(() => {
    if (!fromCity.trim()) return FROM_CITIES;
    return FROM_CITIES.filter((city) =>
      city.toLowerCase().includes(fromCity.toLowerCase()),
    );
  }, [fromCity]);

  const filteredPlaces = useMemo(() => {
    return PLACES.filter((place) => {
      if (activeCategory !== "All" && !place.categories.includes(activeCategory)) return false;
      if (scope === "nearby" && place.travelHours > 4) return false;
      if (scope === "weekend" && place.travelHours > 7) return false;
      if (scope === "long-trip" && place.travelHours <= 7) return false;
      if (place.budget > budgetMax) return false;
      if (place.travelHours > travelTimeMax) return false;
      if (weatherFilter !== "all" && place.weather !== weatherFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchable = `${place.name} ${place.state} ${place.country} ${place.categories.join(" ")}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      return true;
    });
  }, [activeCategory, budgetMax, scope, searchQuery, travelTimeMax, weatherFilter]);

  const visiblePlaces = useMemo(
    () => filteredPlaces.slice(0, visiblePlaceCount),
    [filteredPlaces, visiblePlaceCount],
  );

  const hasMorePlaces = visiblePlaceCount < filteredPlaces.length;

  useEffect(() => {
    setVisiblePlaceCount(PLACE_BATCH_SIZE);
  }, [activeCategory, budgetMax, scope, searchQuery, travelTimeMax, weatherFilter]);

  useEffect(() => {
    if (!hasMorePlaces || !loadMoreRef.current) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisiblePlaceCount((count) =>
            Math.min(count + PLACE_BATCH_SIZE, filteredPlaces.length),
          );
        }
      },
      { rootMargin: "350px 0px" },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [filteredPlaces.length, hasMorePlaces]);

  const handlePlanPlace = (place) => {
    navigate("/itinerary", {
      state: {
        start_city: fromCity,
        source: fromCity,
        destination: place.name,
        days: place.travelHours > 7 ? 5 : 3,
        interests: place.categories.join(", "),
        theme: place.categories[0] || "General",
        placeInfo: place.info,
      },
    });
  };

  const handlePlaceClick = (place) => {
    setSelectedPlace(place);
    setActivePlaceTab("Overview");
    window.requestAnimationFrame(() => {
      document.querySelector(".place-detail-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handlePlaceKeyDown = (event, place) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePlaceClick(place);
    }
  };

  const scrollCategories = (direction) => {
    categoryScrollRef.current?.scrollBy({
      left: direction * 200,
      behavior: "smooth",
    });
  };

  const resetFilters = () => {
    setScope("all");
    setBudgetMax(100000);
    setTravelTimeMax(12);
    setWeatherFilter("all");
    setActiveCategory("All");
    setSearchQuery("");
    setFromCity("");
    setTravelMonth("Any Month");
  };

  return (
    <div className="explore-page">
      <section className="explore-search-console">
        <div className="search-console-inner">
          <div className="console-field from-field" ref={fromRef}>
            <span className="console-field-icon">PIN</span>
            <div className="console-field-content">
              <label className="console-field-label">From</label>
              <input
                type="text"
                className="console-field-input"
                placeholder="Select city"
                value={fromCity}
                onChange={(event) => {
                  setFromCity(event.target.value);
                  setShowFromDropdown(true);
                }}
                onFocus={() => setShowFromDropdown(true)}
              />
            </div>
            {showFromDropdown && filteredFromCities.length > 0 && (
              <div className="console-dropdown">
                {filteredFromCities.map((city) => (
                  <button
                    type="button"
                    key={city}
                    className="console-dropdown-item"
                    onClick={() => {
                      setFromCity(city);
                      setShowFromDropdown(false);
                    }}
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="console-divider" />

          <div className="console-field month-field">
            <span className="console-field-icon">CAL</span>
            <div className="console-field-content">
              <label className="console-field-label">Travel Month</label>
              <select
                className="console-field-select"
                value={travelMonth}
                onChange={(event) => setTravelMonth(event.target.value)}
              >
                {MONTHS.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="console-divider" />

          <div className="console-field search-field">
            <span className="console-field-icon">GO</span>
            <div className="console-field-content">
              <input
                type="text"
                className="console-field-input search-main-input"
                placeholder="Search places..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>

          <button className="ai-trip-btn" onClick={() => navigate("/itinerary")}>
            <span className="ai-sparkle">AI</span>
            Create trip with AI
          </button>
        </div>
      </section>

      <div className="explore-content-layout">
        <aside className="explore-filters-sidebar">
          <div className="sidebar-header">
            <h3 className="sidebar-title">Filters</h3>
            <button className="reset-filters-btn" onClick={resetFilters}>
              Reset All
            </button>
          </div>

          <div className="filter-group">
            <h4 className="filter-group-title">Scope</h4>
            <div className="filter-chips">
              {[
                { key: "all", label: "All" },
                { key: "nearby", label: "Nearby" },
                { key: "weekend", label: "Weekend" },
                { key: "long-trip", label: "Long Trip" },
              ].map((item) => (
                <button
                  key={item.key}
                  className={`filter-chip ${scope === item.key ? "active" : ""}`}
                  onClick={() => setScope(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <h4 className="filter-group-title">Budget Range</h4>
            <RangeSlider
              min={0}
              max={100000}
              step={5000}
              value={budgetMax}
              onChange={setBudgetMax}
              formatLabel={(value) =>
                value >= 100000 ? "Rs 1L+" : `Rs ${(value / 1000).toFixed(0)}K`
              }
            />
          </div>

          <div className="filter-group">
            <h4 className="filter-group-title">Travel Time</h4>
            <RangeSlider
              min={0}
              max={12}
              step={1}
              value={travelTimeMax}
              onChange={setTravelTimeMax}
              formatLabel={(value) => (value >= 12 ? "12h+" : `${value}h`)}
            />
          </div>

          <div className="filter-group">
            <h4 className="filter-group-title">Weather</h4>
            <div className="filter-chips">
              {[
                { key: "all", label: "Any" },
                { key: "rain", label: "Rain" },
                { key: "no-rain", label: "No Rain" },
              ].map((item) => (
                <button
                  key={item.key}
                  className={`filter-chip ${weatherFilter === item.key ? "active" : ""}`}
                  onClick={() => setWeatherFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="explore-places-panel">
          {selectedPlace && (
            <PlaceDetailPanel
              place={selectedPlace}
              activeTab={activePlaceTab}
              onTabChange={setActivePlaceTab}
              onPlanTrip={handlePlanPlace}
              onClose={() => setSelectedPlace(null)}
            />
          )}

          <div className="category-pills-wrapper">
            <button className="pill-scroll-btn left" onClick={() => scrollCategories(-1)}>
              &lt;
            </button>
            <div className="category-pills-row" ref={categoryScrollRef}>
              {CATEGORIES.map((category) => (
                <button
                  key={category.name}
                  className={`category-pill ${activeCategory === category.name ? "active" : ""}`}
                  onClick={() => setActiveCategory(category.name)}
                >
                  <span className="pill-icon">{category.icon}</span>
                  <span className="pill-label">{category.name}</span>
                </button>
              ))}
            </div>
            <button className="pill-scroll-btn right" onClick={() => scrollCategories(1)}>
              &gt;
            </button>
          </div>

          <div className="trending-header">
            <h2 className="trending-title">
              Suggested Places
              {activeCategory !== "All" && (
                <span className="trending-category-tag">{activeCategory}</span>
              )}
            </h2>
            <span className="places-count">
              Showing {visiblePlaces.length} of {filteredPlaces.length} places
            </span>
          </div>

          {filteredPlaces.length > 0 ? (
            <>
              <div className="places-grid">
                {visiblePlaces.map((place) => (
                  <div
                    key={place.name}
                    className="place-card"
                    onClick={() => handlePlaceClick(place)}
                    onKeyDown={(event) => handlePlaceKeyDown(event, place)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View ${place.name}`}
                  >
                    <div
                      className="place-card-image"
                      style={{ backgroundImage: `url('${place.image}')` }}
                    >
                      <div className="place-card-overlay">
                        <h3 className="place-card-name">{place.name}</h3>
                        <span className="place-card-subtitle">
                          {place.subtitle || `${place.state}, ${place.country}`}
                        </span>
                      </div>
                      {place.visaFree && <span className="visa-free-badge">VISA FREE</span>}
                    </div>

                    {place.info && (
                      <p className="place-card-info">{place.info}</p>
                    )}

                    <div className="place-card-transport-strip">
                      {place.transport.bus && (
                        <div className="transport-chip">
                          <span className="transport-icon">Bus</span>
                          <span className="transport-price">{place.transport.bus}</span>
                        </div>
                      )}
                      {place.transport.flight && (
                        <div className="transport-chip">
                          <span className="transport-icon">Flight</span>
                          <span className="transport-price">{place.transport.flight}</span>
                        </div>
                      )}
                      {place.transport.train && (
                        <div className="transport-chip">
                          <span className="transport-icon">Train</span>
                          <span className="transport-price">{place.transport.train}</span>
                        </div>
                      )}
                      {place.transport.car && (
                        <div className="transport-chip">
                          <span className="transport-icon">Car</span>
                          <span className="transport-price">{place.transport.car}</span>
                        </div>
                      )}
                      <div className="transport-chip hotel-chip">
                        <span className="transport-icon">Stay</span>
                        <span className="transport-price">{place.hotel}</span>
                      </div>
                      <div className="transport-chip plan-chip">
                        <span className="transport-icon">Plan</span>
                        <span className="transport-price">Itinerary</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="load-more-sentinel" ref={loadMoreRef}>
                {hasMorePlaces ? (
                  <span>Loading more Indian destinations...</span>
                ) : (
                  <span>All suggested places loaded</span>
                )}
              </div>
            </>
          ) : (
            <div className="no-places-found">
              <span className="no-places-icon">No matches</span>
              <h3>No places match your filters</h3>
              <p>Try adjusting your filters or search query to discover more destinations.</p>
              <button className="reset-filters-inline-btn" onClick={resetFilters}>
                Reset All Filters
              </button>
            </div>
          )}
        </main>
      </div>

      <footer className="home-footer">
        <div className="footer-cols">
          <div className="footer-col">
            <h3>TripAI Travel</h3>
            <p>
              Crafting perfect vacations using advanced AI integrations. Search, select,
              book, and enjoy your journeys.
            </p>
          </div>
          <div className="footer-col">
            <h4>Quick Links</h4>
            <ul>
              <li><span onClick={() => navigate("/flights")} className="f-link">Book Flights</span></li>
              <li><span onClick={() => navigate("/trainsearch")} className="f-link">Search Trains</span></li>
              <li><span onClick={() => navigate("/bussearch")} className="f-link">Book Buses</span></li>
              <li><span onClick={() => navigate("/hotels")} className="f-link">Stays & Hotels</span></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <ul>
              <li><span className="f-link">24/7 Helpline</span></li>
              <li><span className="f-link">FAQ</span></li>
              <li><span className="f-link">Refund Status</span></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>Copyright 2026 TripAI Travel. Inspired by Ixigo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
