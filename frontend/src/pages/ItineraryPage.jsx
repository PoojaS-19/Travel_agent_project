import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import API, { API_BASE_URL } from "../api";
import "../App.css";
import MapComponent from "../components/MapComponent";
import TravelJournal from "../components/TravelJournal";
import { CITIES } from "../data/cities";
import html2pdf from "html2pdf.js";
import { 
  Sparkles, MapPin, Calendar, FileText, Check, Copy, Download, 
  Plus, X, Star, Navigation, Heart, ChevronLeft, ChevronRight, Info,
  ChevronDown, Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- AUTOCOMPLETE COMPONENT ---
function CityAutocomplete({ placeholder, value, onChange }) {
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

  const filteredCities = CITIES.filter((c) =>
    c.name.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative flex items-center">
        <MapPin className="absolute left-3 w-5 h-5 text-brand-secondary" />
        <input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none transition-all text-sm"
        />
      </div>
      {showSuggestions && (
        <div className="absolute left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50 max-h-60 overflow-y-auto">
          {value.length === 0 && (
             <div
               className="px-4 py-3 hover:bg-slate-50 text-brand-primary cursor-pointer transition-colors text-sm font-semibold border-b border-slate-100 flex items-center gap-2"
               onClick={() => {
                 onChange("Current Location");
                 setShowSuggestions(false);
               }}
             >
               <Navigation className="w-4 h-4" /> Use Current Location
             </div>
          )}
          {filteredCities.length > 0 ? (
            filteredCities.map((c, i) => (
              <div
                key={i}
                className="px-4 py-3 hover:bg-slate-50 text-slate-700 hover:text-slate-900 cursor-pointer transition-colors text-sm font-semibold border-b border-slate-100 last:border-none"
                onClick={() => {
                  onChange(c.name);
                  setShowSuggestions(false);
                }}
              >
                {c.name}
              </div>
            ))
          ) : value.length > 0 ? (
             <div
               className="px-4 py-3 hover:bg-slate-50 text-slate-700 hover:text-slate-900 cursor-pointer transition-colors text-sm font-semibold border-b border-slate-100 last:border-none"
               onClick={() => {
                 setShowSuggestions(false);
               }}
             >
               Use "{value}"
             </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

const renderActivityIcon = (category) => {
  const icons = {
    "Food": "🍽️",
    "Attraction": "🎡",
    "Travel": "🚗",
    "Relax": "🏖️",
    "Shopping": "🛍️",
    "History": "🏰",
  };
  const icon = icons[category] || "📍";
  return (
    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-sm shrink-0">
      <span>{icon}</span>
    </div>
  );
};

// --- IMAGE CAROUSEL WITH LIGHTBOX ---
function ImageCarousel({ placeName, destination }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageCount, setImageCount] = useState(1);
  const [loadedImages, setLoadedImages] = useState([true]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxClosing, setLightboxClosing] = useState(false);
  const [hidden, setHidden] = useState(false);

  const baseQuery = encodeURIComponent(placeName + " " + destination);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/place-image-count?place=${baseQuery}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.count) {
          setImageCount(Math.min(data.count, 3));
          setLoadedImages(new Array(Math.min(data.count, 3)).fill(true));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [baseQuery]);

  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen]);

  const handleImageError = (index) => {
    setLoadedImages(prev => {
      const updated = [...prev];
      updated[index] = false;
      if (updated.every(v => v === false)) {
        setHidden(true);
      }
      return updated;
    });
  };

  const goTo = (idx) => {
    if (idx >= 0 && idx < imageCount) {
      setCurrentIndex(idx);
    }
  };

  const goPrev = (e) => {
    e.stopPropagation();
    const prev = (currentIndex - 1 + imageCount) % imageCount;
    goTo(prev);
  };

  const goNext = (e) => {
    e.stopPropagation();
    const next = (currentIndex + 1) % imageCount;
    goTo(next);
  };

  const openLightbox = () => {
    setLightboxClosing(false);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxClosing(true);
    setTimeout(() => {
      setLightboxOpen(false);
      setLightboxClosing(false);
    }, 280);
  };

  if (hidden) return null;

  const currentSrc = `${API_BASE_URL}/place-image?place=${baseQuery}&index=${currentIndex}`;

  const lightboxPortal = lightboxOpen ? createPortal(
    <div
      className={`fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-[9999] transition-opacity duration-300 ${lightboxClosing ? 'opacity-0' : 'opacity-100'}`}
      onClick={closeLightbox}
    >
      <div
        className={`relative max-w-4xl w-full mx-4 flex flex-col items-center justify-center transition-all duration-300 ${lightboxClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="absolute top-4 right-4 p-2 bg-slate-900 border border-slate-800 text-white rounded-full hover:bg-slate-800 transition-colors" 
          onClick={closeLightbox}
        >
          <X className="w-5 h-5" />
        </button>
        <img
          src={currentSrc}
          alt={`${placeName} - Full View`}
          className="max-h-[80vh] max-w-full rounded-2xl border border-slate-800 shadow-2xl object-contain"
        />
        <p className="mt-4 text-lg font-bold text-slate-100">{placeName}</p>

        {imageCount > 1 && (
          <>
            <button 
              className="absolute left-4 p-3 bg-slate-900/80 border border-slate-800/85 hover:bg-slate-800 text-white rounded-full transition-all" 
              onClick={goPrev}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              className="absolute right-4 p-3 bg-slate-900/80 border border-slate-800/85 hover:bg-slate-800 text-white rounded-full transition-all" 
              onClick={goNext}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="flex gap-1.5 mt-4">
              {Array.from({ length: imageCount }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full cursor-pointer transition-all ${i === currentIndex ? "bg-indigo-500 w-4" : "bg-slate-700 hover:bg-slate-600"}`}
                  onClick={(e) => { e.stopPropagation(); goTo(i); }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className="relative w-full h-48 md:h-60 rounded-xl overflow-hidden group shadow-sm border border-slate-200 mb-4 bg-slate-100">
        {/* Main image */}
        <div className="w-full h-full cursor-pointer relative" onClick={openLightbox} title="Click to view full image">
          <img
            src={currentSrc}
            alt={`${placeName} - Photo ${currentIndex + 1}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => handleImageError(currentIndex)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
            <span className="text-xs font-bold px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 shadow">
              🔍 View Full Image
            </span>
          </div>
        </div>

        {imageCount > 1 && (
          <>
            <button 
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-slate-900/80 border border-slate-800 hover:bg-slate-800 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300" 
              onClick={goPrev} 
              aria-label="Previous image"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-slate-900/80 border border-slate-800 hover:bg-slate-800 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300" 
              onClick={goNext} 
              aria-label="Next image"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {imageCount > 1 && (
          <div className="absolute bottom-3 right-3 px-2 py-1 bg-slate-900/90 border border-slate-800/80 rounded-md text-[10px] font-bold text-slate-300">
            {currentIndex + 1} / {imageCount}
          </div>
        )}
      </div>

      {lightboxPortal}
    </>
  );
}

function ReviewForm({ place, destination, onClose }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [tripType, setTripType] = useState("");
  const [mood, setMood] = useState("");
  const [loading, setLoading] = useState(false);

  const submitReview = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    try {
      await API.post("/api/reviews", {
        place_name: place.place_name,
        destination: destination,
        rating: rating,
        review: review || null,
        category: place.category,
        trip_type: tripType || null,
        mood: mood || null,
        lat: place.lat,
        lon: place.lon
      });
      alert("Thank you for your review!");
      onClose();
    } catch (error) {
      alert("Failed to submit review. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 text-left">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(star => (
            <span
              key={star}
              className={`text-2xl cursor-pointer transition-transform hover:scale-110 ${rating >= star ? 'opacity-100' : 'opacity-30'}`}
              onClick={() => setRating(star)}
            >
              ⭐
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 text-left">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Review (optional)</label>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share your experience..."
          rows={3}
          className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 text-left">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trip Type</label>
          <select 
            value={tripType} 
            onChange={(e) => setTripType(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary outline-none"
          >
            <option value="">Select...</option>
            <option value="solo">Solo</option>
            <option value="friends">Friends</option>
            <option value="family">Family</option>
            <option value="couple">Couple</option>
            <option value="business">Business</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mood</label>
          <select 
            value={mood} 
            onChange={(e) => setMood(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary outline-none"
          >
            <option value="">Select...</option>
            <option value="chill">Chill</option>
            <option value="adventure">Adventure</option>
            <option value="cultural">Cultural</option>
            <option value="romantic">Romantic</option>
            <option value="exciting">Exciting</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button 
          onClick={onClose} 
          className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm cursor-pointer"
        >
          Cancel
        </button>
        <button 
          onClick={submitReview} 
          disabled={loading} 
          className="px-4 py-2 bg-brand-accent hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl text-sm font-semibold border-none cursor-pointer"
        >
          {loading ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </div>
  );
}

const PREFERENCE_SUGGESTIONS = [
  "Vegetarian diet",
  "Low walking intensity",
  "Museums first",
  "Kid friendly",
  "Senior friendly",
  "Budget friendly",
  "Photography spots",
  "Local cuisine",
  "Shopping hotspots"
];

export default function ItineraryPage({ language, chatItinerary, chatDailyPlans }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [savedTripId, setSavedTripId] = useState(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [followers, setFollowers] = useState([
    { email: "", invited: false, verified: false, otp: "", message: "", error: "", loadingInvite: false, loadingVerify: false }
  ]);

  const [form, setForm] = useState({
    start_city: searchParams.get("start_city") || "",
    destination: searchParams.get("destination") || "",
    days: searchParams.get("days") || "",
    theme: searchParams.get("theme") || "",
    preferences: searchParams.get("preferences") || "",
    route_strategy: searchParams.get("route_strategy") || "Fastest Route",
  });

  useEffect(() => {
    if (form.destination && form.days) {
      submit();
    }
  }, []);

  const [result, setResult] = useState("");
  const [dailyPlans, setDailyPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [altModal, setAltModal] = useState({ isOpen: false, place: "", loading: false, text: "" });
  const [savedItineraries, setSavedItineraries] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [communitySuggestions, setCommunitySuggestions] = useState([]);
  const [reviewModal, setReviewModal] = useState({ isOpen: false, place: null });
  const printRef = useRef();

  useEffect(() => {
    if (chatItinerary) {
      setResult(chatItinerary);
    }
  }, [chatItinerary]);

  useEffect(() => {
    if (chatDailyPlans && chatDailyPlans.length > 0) {
      setDailyPlans(chatDailyPlans);
    }
  }, [chatDailyPlans]);

  const submit = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    setResult("");
    setDailyPlans([]);

    try {
      const res = await API.post("/itinerary", {
        ...form,
        language
      });

      const data = res.data;
      if (data.error) {
        setResult(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      } else if (data.daily_plans) {
        setResult(data);
        setDailyPlans(data.daily_plans);
      } else {
        const fallback = data.itinerary || data;
        setResult(fallback);
      }

      if (data.id) {
        setSavedTripId(data.id);
      } else {
        setSavedTripId(null);
      }
      setSearchParams({
        start_city: form.start_city,
        destination: form.destination,
        days: form.days,
        theme: form.theme,
        preferences: form.preferences
      });
      setIsFinalized(false);

      // Fetch personalized recommendations
      try {
        const recRes = await API.get("/recommendations", { params: { language } });
        setRecommendations(recRes.data.recommendations || []);
      } catch (recError) {
        console.log("Could not fetch recommendations:", recError);
        setRecommendations([]);
      }

      // Fetch community suggestions
      try {
        const commRes = await API.post("/api/reviews/community-recommendations", {
          destination: form.destination,
          theme: form.theme,
          preferences: form.preferences
        });
        setCommunitySuggestions(commRes.data.suggestions || []);
      } catch (commError) {
        console.log("Could not fetch community suggestions:", commError);
        setCommunitySuggestions([]);
      }

    } catch {
      setResult("Error generating itinerary.");
    }
    setLoading(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(result);
    alert("Copied!");
  };

  const buildGoogleMapsUrl = (activities) => {
    const valid = activities.filter(a => a.lat && a.lon && !isNaN(a.lat) && !isNaN(a.lon));
    if (valid.length === 0) return null;
    if (valid.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${valid[0].lat},${valid[0].lon}`;
    }
    const origin = valid[0];
    const dest   = valid[valid.length - 1];
    const wps    = valid.slice(1, -1);
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${dest.lat},${dest.lon}&travelmode=driving`;
    if (wps.length > 0) url += `&waypoints=${wps.map(p => `${p.lat},${p.lon}`).join('|')}`;
    return url;
  };

  const buildStaticMapImg = (activities, width = 800, height = 350) => {
    const valid = activities.filter(a => a.lat && a.lon && !isNaN(a.lat) && !isNaN(a.lon));
    if (valid.length === 0) return null;
    const lats = valid.map(a => parseFloat(a.lat));
    const lons = valid.map(a => parseFloat(a.lon));
    const minLat = Math.min(...lats) - 0.02;
    const maxLat = Math.max(...lats) + 0.02;
    const minLon = Math.min(...lons) - 0.02;
    const maxLon = Math.max(...lons) + 0.02;
    const bbox   = `${minLon},${minLat},${maxLon},${maxLat}`;
    return `https://staticmap.openstreetmap.de/staticmap.php?bbox=${bbox}&size=${width}x${height}&maptype=mapnik&markers=${valid.map((a,i)=>`${a.lat},${a.lon},ol-marker-red`).join('|')}`;
  };

  const downloadPDF = async () => {
    const element = printRef.current;
    if (!element) return;

    const mapContainers = element.querySelectorAll('.leaflet-container');
    const restorations  = [];

    const allActivitiesForDays = dailyPlans;

    mapContainers.forEach((mapEl, idx) => {
      const parent = mapEl.parentElement;

      let activities = [];
      let googleUrl  = "";
      let label      = "";

      if (idx === 0 && element.querySelector('.master-map-container')?.contains(mapEl)) {
        activities = allActivitiesForDays.flatMap(d => d.activities);
        label = "🗺️ View Full Trip on Google Maps";
      } else {
        const allDayMaps = [...element.querySelectorAll('.day-map-container .leaflet-container')];
        const dayIdx     = allDayMaps.indexOf(mapEl);
        if (dayIdx >= 0 && allActivitiesForDays[dayIdx]) {
          activities = allActivitiesForDays[dayIdx].activities;
          label = `📍 Open Day ${allActivitiesForDays[dayIdx].day} Route on Google Maps`;
        } else {
          activities = allActivitiesForDays.flatMap(d => d.activities);
          label = "📍 Open Route on Google Maps";
        }
      }

      googleUrl = buildGoogleMapsUrl(activities) || "https://maps.google.com";
      const imgSrc = buildStaticMapImg(activities);

      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        width: 100%;
        background: #0f172a;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #1e293b;
        margin-bottom: 15px;
        font-family: inherit;
      `;
      placeholder.innerHTML = `
        <a href="${googleUrl}" target="_blank" rel="noopener noreferrer"
           style="display:block; text-decoration:none; color:inherit;">
          ${
            imgSrc
              ? `<img src="${imgSrc}" alt="Map" crossorigin="anonymous"
                      style="width:100%; height:300px; object-fit:cover; display:block;" />`
              : `<div style="height:160px; background: linear-gradient(135deg,#0f172a,#1e1b4b);
                             display:flex; align-items:center; justify-content:center; color:white; font-size:18px;">
                   🗺️ Map Preview
                 </div>`
          }
          <div style="
            padding: 14px 20px;
            background: #6366f1;
            color: white;
            font-size: 15px;
            font-weight: 600;
            text-align: center;
          ">
            ${label} ↗
          </div>
        </a>
      `;

      parent.insertBefore(placeholder, mapEl);
      parent.removeChild(mapEl);
      restorations.push({ parent, placeholder, original: mapEl });
    });

    const opt = {
      margin:      10,
      filename:    `${form.destination || 'trip'}-itinerary.pdf`,
      image:       { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: false },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
      enableLinks: true,
    };

    await html2pdf().set(opt).from(element).save();

    restorations.forEach(({ parent, placeholder, original }) => {
      parent.insertBefore(original, placeholder);
      parent.removeChild(placeholder);
    });
  };

  const handleAltClick = async (altName) => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    setAltModal({ isOpen: true, place: altName, loading: true, text: "" });
    try {
      const res = await API.post("/chatbot", {
        question: `Tell me a short 3-sentence informational summary about ${altName} as a tourist destination in or near ${form.destination || form.start_city}.`,
        language: language
      });
      setAltModal({ isOpen: true, place: altName, loading: false, text: res.data.reply || "No info available." });
    } catch (e) {
      setAltModal({ isOpen: true, place: altName, loading: false, text: "Error fetching info." });
    }
  };

  const fetchSavedItineraries = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }
    try {
      const res = await API.get("/itineraries");
      setSavedItineraries(res.data.itineraries || []);
      setShowSaved(true);
    } catch (e) {
      alert("Error loading saved itineraries. Please login first.");
    }
  };

  const loadSavedItinerary = (itinerary) => {
    setResult({ ...itinerary, route_data: itinerary.route_polyline });
    setDailyPlans(itinerary.daily_plans);
    setShowSaved(false);
    if (itinerary.id) {
      setSavedTripId(itinerary.id);
    } else {
      setSavedTripId(null);
    }
    setIsFinalized(false);
  };

  const handleEditItinerary = () => {
    if (savedTripId) {
      navigate(`/saved-trips?id=${savedTripId}`);
    } else {
      alert("No saved trip ID found. Please generate or load an itinerary first.");
    }
  };

  const handleFinalizeItinerary = () => {
    setIsFinalized(true);
    setFollowers([
      { email: "", invited: false, verified: false, otp: "", message: "", error: "", loadingInvite: false, loadingVerify: false }
    ]);
  };

  const addFollowerField = () => {
    setFollowers([...followers, { email: "", invited: false, verified: false, otp: "", message: "", error: "", loadingInvite: false, loadingVerify: false }]);
  };

  const handleFollowerEmailChange = (index, value) => {
    const updated = [...followers];
    updated[index].email = value;
    setFollowers(updated);
  };

  const handleFollowerOtpChange = (index, value) => {
    const updated = [...followers];
    updated[index].otp = value;
    setFollowers(updated);
  };

  const handleSendInvite = async (index) => {
    const follower = followers[index];
    if (!follower.email) {
      const updated = [...followers];
      updated[index].error = "Please enter a valid email address.";
      setFollowers(updated);
      return;
    }
    if (!savedTripId) {
      const updated = [...followers];
      updated[index].error = "Please generate or load an itinerary first.";
      setFollowers(updated);
      return;
    }

    const updated = [...followers];
    updated[index].loadingInvite = true;
    updated[index].error = "";
    updated[index].message = "";
    setFollowers(updated);

    try {
      await API.post(`/api/trips/${savedTripId}/collaboration/invitations`, {
        emails: [follower.email],
        role: "follower"
      });
      const updatedSuccess = [...followers];
      updatedSuccess[index].invited = true;
      updatedSuccess[index].message = "Verification code sent to email.";
      updatedSuccess[index].loadingInvite = false;
      setFollowers(updatedSuccess);
    } catch (err) {
      console.error("Invite follower error:", err);
      const updatedErr = [...followers];
      updatedErr[index].error = err.response?.data?.detail || "Could not send invite.";
      updatedErr[index].loadingInvite = false;
      setFollowers(updatedErr);
    }
  };

  const handleVerifyOtp = async (index) => {
    const follower = followers[index];
    if (follower.otp.length !== 6) {
      const updated = [...followers];
      updated[index].error = "Please enter a 6-digit verification code.";
      setFollowers(updated);
      return;
    }

    const updated = [...followers];
    updated[index].loadingVerify = true;
    updated[index].error = "";
    updated[index].message = "";
    setFollowers(updated);

    try {
      await API.post("/api/collaboration/invitations/accept-otp", {
        otp_code: follower.otp
      });
      const updatedSuccess = [...followers];
      updatedSuccess[index].verified = true;
      updatedSuccess[index].message = "Follower linked successfully!";
      updatedSuccess[index].loadingVerify = false;
      setFollowers(updatedSuccess);
    } catch (err) {
      console.error("Verify OTP error:", err);
      const updatedErr = [...followers];
      updatedErr[index].error = err.response?.data?.detail || "Invalid code or user not registered.";
      updatedErr[index].loadingVerify = false;
      setFollowers(updatedErr);
    }
  };

  const handleDoneFinalizing = () => {
    setIsFinalized(false);
    alert("Followers linking process finished.");
  };

  const addToItinerary = (suggestion) => {
    if (dailyPlans.length === 0) return;

    const updatedPlans = [...dailyPlans];
    const firstDay = updatedPlans[0];

    const newActivity = {
      time: "Flexible",
      place_name: suggestion.place_name,
      category: suggestion.category || "Attraction",
      description: `Community recommended: ${suggestion.reason}`,
      lat: suggestion.lat,
      lon: suggestion.lon
    };

    firstDay.activities = [...firstDay.activities, newActivity];
    setDailyPlans(updatedPlans);
    setCommunitySuggestions(prev => prev.filter(s => s.place_name !== suggestion.place_name));
    alert(`${suggestion.place_name} added to your itinerary!`);
  };

  const togglePreference = (pref) => {
    let currentPrefs = form.preferences
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const lowercasePrefs = currentPrefs.map((p) => p.toLowerCase());
    const targetLower = pref.toLowerCase();

    if (lowercasePrefs.includes(targetLower)) {
      const matchIndex = lowercasePrefs.indexOf(targetLower);
      if (matchIndex > -1) {
        currentPrefs.splice(matchIndex, 1);
      }
    } else {
      currentPrefs.push(pref);
    }
    setForm({ ...form, preferences: currentPrefs.join(", ") });
  };

  return (
    <div className="relative min-h-screen px-4 py-8 md:px-12 md:py-12 max-w-7xl mx-auto space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-[#0a2240] flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-brand-secondary animate-pulse" />
            AI Itinerary Planner
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">Generate structured, daily travel schedules cached on maps</p>
        </div>
        <button 
          onClick={fetchSavedItineraries} 
          className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm cursor-pointer"
        >
          📁 View Saved Itineraries
        </button>
      </div>

      {/* SAVED ITINERARIES SLIDE PANEL */}
      <AnimatePresence>
        {showSaved && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-md relative overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">Your Saved Itineraries</h3>
              <button 
                onClick={() => setShowSaved(false)}
                className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {savedItineraries.length === 0 ? (
              <p className="text-sm text-slate-500">No saved itineraries yet. Plan and save some trips!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedItineraries.map((itinerary) => (
                  <div key={itinerary.id} className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div>
                      <h4 className="text-base font-bold text-slate-900 mb-1">{itinerary.destination}</h4>
                      <p className="text-xs text-slate-600"><strong>From:</strong> {itinerary.start_city}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5"><strong>Created:</strong> {new Date(itinerary.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-500 mt-3 line-clamp-3 leading-relaxed">
                        {itinerary.itinerary_text}
                      </p>
                    </div>
                    <button 
                      onClick={() => loadSavedItinerary(itinerary)}
                      className="w-full mt-4 py-2 bg-sky-50 hover:bg-sky-100 text-brand-secondary rounded-lg text-xs font-bold border border-sky-200 transition-all cursor-pointer"
                    >
                      Load This Plan
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* INPUT FORM PANEL */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-secondary via-brand-secondary to-brand-accent" />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CityAutocomplete
            placeholder="Starting City (e.g. Mumbai)"
            value={form.start_city}
            onChange={(val) => setForm({ ...form, start_city: val })}
          />
          <CityAutocomplete
            placeholder="Destination (e.g. Paris)"
            value={form.destination}
            onChange={(val) => setForm({ ...form, destination: val })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative flex items-center">
            <Calendar className="absolute left-3 w-5 h-5 text-brand-secondary" />
            <input
              type="number"
              placeholder="Duration in Days"
              value={form.days}
              onChange={(e) => setForm({ ...form, days: e.target.value })}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none text-sm transition-all"
            />
          </div>
          <div className="relative w-full">
            <select
              value={form.theme}
              onChange={(e) => setForm({ ...form, theme: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none text-sm transition-all cursor-pointer appearance-none"
            >
              <option value="" disabled hidden>Theme (e.g. Adventure, Relax, Heritage)</option>
              <option value="Not Specific">Not Specific</option>
              <option value="General">General / All-round</option>
              <option value="Adventure">Adventure & Sports</option>
              <option value="Relaxation">Relaxation & Wellness</option>
              <option value="Heritage">Heritage & Culture</option>
              <option value="Nature">Nature & Scenic</option>
              <option value="Beaches">Beaches & Coastal</option>
              <option value="Mountains">Mountains & Trekking</option>
              <option value="Food & Culinary">Food & Culinary</option>
              <option value="Wildlife & Safari">Wildlife & Safari</option>
              <option value="Spiritual & Religious">Spiritual & Religious</option>
              <option value="Budget Travel">Budget Travel</option>
              <option value="Luxury & Leisure">Luxury & Leisure</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
          <div className="relative w-full">
            <select
              value={form.route_strategy}
              onChange={(e) => setForm({ ...form, route_strategy: e.target.value })}
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none text-sm transition-all cursor-pointer appearance-none"
            >
              <option value="Fastest Route">⚡ Fastest Route</option>
              <option value="Scenic Route">🏞️ Scenic Route</option>
              <option value="Toll-Free Route">🛣️ Toll-Free Route</option>
              <option value="Fuel Efficient Route">🍃 Fuel Efficient</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="space-y-2 text-left">
          <textarea
            placeholder="Additional Preferences (e.g. Vegetarian diet, low walking intensity, museums first)"
            value={form.preferences}
            onChange={(e) => setForm({ ...form, preferences: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none text-sm transition-all"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {PREFERENCE_SUGGESTIONS.map((pref, idx) => {
              const isActive = form.preferences.toLowerCase().includes(pref.toLowerCase());
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => togglePreference(pref)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                    isActive
                      ? "bg-brand-secondary border-brand-secondary text-white shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  {isActive ? "✓ " : "+ "} {pref}
                </button>
              );
            })}
          </div>
        </div>

        <button 
          onClick={submit}
          disabled={loading}
          className="w-full py-4 bg-brand-accent hover:bg-orange-600 text-white font-black rounded-xl shadow-md disabled:opacity-50 transition-all text-sm uppercase tracking-wider border-none cursor-pointer"
        >
          {loading ? "Generating Smart Itinerary..." : "Generate AI Itinerary"}
        </button>
      </div>

      {/* QUICK ACTIONS BUTTONS */}
      {result && (
        <div className="flex justify-center gap-3 flex-wrap">
          <button 
            onClick={copyToClipboard} 
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all duration-200"
          >
            <Copy className="w-4 h-4 text-brand-secondary" />
            Copy Text
          </button>
          <button 
            onClick={downloadPDF} 
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all duration-200"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Download PDF
          </button>
          {savedTripId && (
            <>
              <button 
                onClick={handleEditItinerary} 
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-secondary hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md transition-all duration-200 border-none cursor-pointer"
              >
                <Navigation className="w-4 h-4" />
                Live Collaboration
              </button>
              <button 
                onClick={handleFinalizeItinerary} 
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md transition-all duration-200 border-none cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Travel Buddies
              </button>
              <button 
                onClick={() => navigate('/dashboard')} 
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md transition-all duration-200 border-none cursor-pointer"
              >
                <Activity className="w-4 h-4" />
                Analytics Dashboard
              </button>
            </>
          )}
        </div>
      )}

      {/* LINK FOLLOWERS CARD PANEL */}
      <AnimatePresence>
        {isFinalized && savedTripId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl mx-auto bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500" />
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                👥 Add Travel Buddies
              </h3>
              <button 
                onClick={() => setIsFinalized(false)}
                className="p-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-850"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 mb-6">
              Invite friends to view your itinerary. Fill in their email to send an invite, enter the 6-digit OTP code received, and click verify.
            </p>

            <div className="space-y-4 mb-6">
              {followers.map((follower, index) => (
                <div key={index} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Buddy #{index + 1}</h4>
                  
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="email"
                      placeholder="Buddy's Email Address"
                      value={follower.email}
                      onChange={(e) => handleFollowerEmailChange(index, e.target.value)}
                      disabled={follower.invited}
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:ring-1 focus:ring-brand-secondary outline-none"
                      required
                    />
                    {!follower.invited && (
                      <button
                        type="button"
                        disabled={follower.loadingInvite}
                        onClick={() => handleSendInvite(index)}
                        className="px-4 py-2 bg-brand-secondary hover:bg-blue-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shrink-0 border-none cursor-pointer"
                      >
                        {follower.loadingInvite ? "Sending..." : "Send Invite Code"}
                      </button>
                    )}
                  </div>

                  {follower.invited && !follower.verified && (
                    <div className="flex gap-3 items-center">
                      <input
                        type="text"
                        placeholder="6-digit code"
                        maxLength={6}
                        value={follower.otp}
                        onChange={(e) => handleFollowerOtpChange(index, e.target.value.replace(/\D/g, ""))}
                        className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm tracking-widest text-center focus:ring-1 focus:ring-brand-secondary outline-none"
                        disabled={follower.loadingVerify}
                      />
                      <button
                        type="button"
                        disabled={follower.loadingVerify}
                        onClick={() => handleVerifyOtp(index)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
                      >
                        {follower.loadingVerify ? "Verifying..." : "Verify Code"}
                      </button>
                    </div>
                  )}

                  {follower.message && (
                    <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      {follower.message}
                    </div>
                  )}
                  {follower.error && (
                    <div className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      {follower.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={addFollowerField}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                + Add Another Buddy
              </button>
              
              <button
                type="button"
                onClick={handleDoneFinalizing}
                className="px-5 py-2.5 bg-brand-secondary hover:bg-blue-600 text-white rounded-xl text-xs font-bold border-none cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RECOMMENDATIONS & PERSONALIZATION */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>✨</span> Recommended for You
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec, index) => (
              <div key={index} className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 flex flex-col justify-between shadow-sm transition-all">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{rec.title}</h4>
                  <div className="flex gap-2 flex-wrap my-2">
                    <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-brand-secondary font-bold">{rec.theme}</span>
                    <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-emerald-600 font-bold">{rec.suggested_duration}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-bold mb-1">Destination: {rec.destination}</p>
                  <p className="text-xs text-slate-500 leading-relaxed italic mt-2">{rec.reason}</p>
                </div>
                <button 
                  onClick={() => {
                    setForm({
                      ...form,
                      destination: rec.destination,
                      theme: rec.theme,
                      days: rec.suggested_duration.split('-')[0].trim()
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full mt-4 py-2 bg-sky-50 hover:bg-sky-100 text-brand-secondary rounded-lg text-xs font-bold border border-sky-200 transition-all cursor-pointer border-none"
                >
                  Try This Itinerary
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMMUNITY EXPERIENCE CARD ROW */}
      {communitySuggestions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>🌟</span> Suggested Nearby Experiences
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {communitySuggestions.map((suggestion, index) => (
              <div key={index} className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden flex flex-col justify-between shadow-sm transition-all">
                {suggestion.photo_url && (
                  <img src={suggestion.photo_url} alt={suggestion.place_name} className="w-full h-32 object-cover border-b border-slate-200" />
                )}
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <h4 className="text-base font-bold text-slate-900">{suggestion.place_name}</h4>
                    <span className="flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-2 py-0.5 rounded-md">
                      ⭐ {suggestion.rating}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed my-3">{suggestion.reason}</p>
                  <p className="text-[11px] text-slate-400 font-bold">Distance: {suggestion.distance}</p>
                  <button 
                    onClick={() => addToItinerary(suggestion)}
                    className="w-full mt-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-200 transition-all cursor-pointer border-none"
                  >
                    Add To Itinerary
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OUTPUT TIMELINE BOARD */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm" ref={printRef}>
        {result && dailyPlans.length > 0 ? (
          <div className="p-6 md:p-8 space-y-8">
            {/* MASTER MAP OVERVIEW */}
            <div className="master-map-container rounded-xl overflow-hidden border border-slate-200">
              {(() => {
                const routeData = result?.route_data || (chatItinerary && chatItinerary.route_data);
                return (
                  <>
                    {routeData && (
                      <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap gap-2 justify-between items-center">
                        <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          🚗 Live Driving Route {routeData.summary ? <span className="text-slate-500 font-semibold text-xs ml-2">via {routeData.summary}</span> : ""}
                        </span>
                        <div className="flex gap-3 text-xs font-semibold text-slate-600">
                          <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1">🛣️ {routeData.distance}</span>
                          <span className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1">⏱️ {routeData.duration}</span>
                        </div>
                      </div>
                    )}
                    <MapComponent allDailyPlans={dailyPlans} routePolyline={routeData?.polyline} />
                  </>
                );
              })()}
            </div>

            <div className="space-y-12">
              {dailyPlans.map((dayPlan, index) => (
                <div key={index} className="space-y-6">
                  {/* Day Banner */}
                  <div className="relative flex items-center gap-4 py-2 border-b border-slate-200">
                    <span className="text-xs font-extrabold px-3 py-1 bg-sky-50 text-brand-secondary rounded-lg border border-sky-100 uppercase tracking-widest">
                      Day {dayPlan.day}
                    </span>
                    {dayPlan.date && (
                      <span className="text-xs text-slate-500 font-semibold">
                        {new Date(dayPlan.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>

                  {/* Day Activities List */}
                  <div className="relative border-l-2 border-slate-200 ml-4 pl-6 md:pl-8 space-y-8">
                    {dayPlan.activities.map((activity, actIndex) => (
                      <div key={actIndex} className="relative group">
                        {/* Circular connector on line */}
                        <div className="absolute -left-[31px] md:-left-[39px] top-1.5 w-4 h-4 bg-white border-2 border-brand-secondary rounded-full group-hover:bg-brand-secondary transition-colors" />

                        <div className="bg-slate-50 border border-slate-200 group-hover:border-slate-300 rounded-2xl p-5 md:p-6 transition-all shadow-sm text-left">
                          {/* Image Carousel */}
                          <ImageCarousel
                            placeName={activity.place_name}
                            destination={form.destination}
                          />

                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              {renderActivityIcon(activity.category)}
                              <div>
                                <h4 className="text-base font-bold text-slate-900">{activity.place_name}</h4>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{activity.time || "Flexible"}</span>
                              </div>
                            </div>
                            {activity.cost && (
                              <span className="self-start md:self-auto text-xs px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg font-bold">
                                {activity.cost}
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-slate-600 leading-relaxed mt-4">{activity.description}</p>

                          {activity.alternatives && activity.alternatives.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-slate-500 font-semibold">Alternatives:</span>
                              {activity.alternatives.map((alt, altIdx) => (
                                <span 
                                  key={altIdx} 
                                  className="text-[11px] font-semibold px-2.5 py-1 bg-sky-50 border border-sky-150 hover:bg-sky-100 text-brand-secondary rounded-lg cursor-pointer transition-all"
                                  onClick={() => handleAltClick(alt)}
                                >
                                  {alt}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-200">
                            <button
                              onClick={() => setReviewModal({ isOpen: true, place: activity })}
                              className="flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-800 font-bold px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all cursor-pointer border-none"
                            >
                              ⭐ Rate Place
                            </button>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${activity.lat},${activity.lon}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-brand-secondary hover:text-blue-600 font-bold px-3 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-all"
                            >
                              <Navigation className="w-3.5 h-3.5 text-brand-secondary" />
                              Directions
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Day map */}
                  <div className="day-map-container rounded-xl overflow-hidden border border-slate-200 shadow-sm mt-4">
                    <MapComponent activities={dayPlan.activities} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
            {result ? (
              <pre className="text-left w-full overflow-x-auto whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed bg-slate-50 p-6 rounded-xl border border-slate-200">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
            ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
            <span className="text-5xl">🗺️</span>
            <p className="text-sm font-semibold">Your itinerary timeline will render here. Fill in the details above to begin.</p>
          </div>
        )}
      </div>
        )}
      </div>

      {/* TRAVEL JOURNAL */}
      {savedTripId && (
        <TravelJournal itineraryId={savedTripId} />
      )}

      {/* ALTERNATIVE DETAILS DIALOG MODAL */}
      <AnimatePresence>
        {altModal.isOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[999] px-4"
            onClick={() => setAltModal({ ...altModal, isOpen: false })}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 max-w-lg w-full relative shadow-2xl text-slate-900"
              onClick={e => e.stopPropagation()}
            >
              <button 
                className="absolute top-4 right-4 p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-950 transition-colors cursor-pointer border-none" 
                onClick={() => setAltModal({ ...altModal, isOpen: false })}
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-xl font-bold text-slate-900 mb-4">{altModal.place}</h3>
              {altModal.loading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-indigo-400 font-semibold">Fetching AI insights...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">{altModal.text}</p>
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                     <p className="text-xs text-slate-500 italic">Like this place? Ask your AI floating assistant to swap it into the itinerary!</p>
                     <button 
                       className="w-full py-2.5 bg-brand-secondary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
                       onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(altModal.place + " " + (form.destination || form.start_city))}`, '_blank')}
                     >
                       Search Google
                     </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RATING REVIEW MODAL */}
      <AnimatePresence>
        {reviewModal.isOpen && reviewModal.place && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[999] px-4"
            onClick={() => setReviewModal({ isOpen: false, place: null })}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl relative text-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="absolute top-4 right-4 p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-955 transition-colors cursor-pointer border-none" 
                onClick={() => setReviewModal({ isOpen: false, place: null })}
              >
                <X className="w-4 h-4" />
              </button>
              <ReviewForm
                place={reviewModal.place}
                destination={form.destination}
                onClose={() => setReviewModal({ isOpen: false, place: null })}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
