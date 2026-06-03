import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";

import API, { API_BASE_URL } from "../api";
import "../App.css";
import MapComponent from "../components/MapComponent";
import { CITIES } from "../data/cities";
import html2pdf from "html2pdf.js";
import ReviewsModal from "../components/ReviewsModal";

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
    <div className="autocomplete-wrapper" ref={wrapperRef} style={{ width: "100%", marginBottom: "15px" }}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd" }}
      />
      {showSuggestions && value.length > 0 && (
        <div className="suggestions-dropdown">
          {filteredCities.length > 0 ? (
            filteredCities.map((c, i) => (
              <div
                key={i}
                className="suggestion-item"
                onClick={() => {
                  onChange(c.name);
                  setShowSuggestions(false);
                }}
              >
                <div className="city-name">{c.name}</div>
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

const renderActivityIcon = (category) => {
  const icons = {
    "Food": "🍽️",
    "Attraction": "🎡",
    "Travel": "🚗",
    "Relax": "🏖️",
    "Shopping": "🛍️",
    "History": "castle",
  };
  const icon = icons[category] || "📍";
  return (
    <div className="activity-icon-box">
      <span className="activity-icon">{icon}</span>
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

  // Try to fetch image count on mount
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

  // Lock body scroll when lightbox is open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

  // Close with ESC key
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

  // Lightbox rendered via portal so it escapes overflow:hidden parents
  const lightboxPortal = lightboxOpen ? createPortal(
    <div
      className={`image-lightbox-overlay ${lightboxClosing ? 'lightbox-closing' : ''}`}
      onClick={closeLightbox}
    >
      <div
        className={`image-lightbox-content ${lightboxClosing ? 'lightbox-content-closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="lightbox-close-btn" onClick={closeLightbox}>✕</button>
        <img
          src={currentSrc}
          alt={`${placeName} - Full View`}
          className="lightbox-image"
        />
        <p className="lightbox-caption">{placeName}</p>

        {imageCount > 1 && (
          <>
            <button className="lightbox-arrow lightbox-arrow-left" onClick={goPrev}>❮</button>
            <button className="lightbox-arrow lightbox-arrow-right" onClick={goNext}>❯</button>
            <div className="lightbox-dots">
              {Array.from({ length: imageCount }).map((_, i) => (
                <span
                  key={i}
                  className={`carousel-dot lightbox-dot ${i === currentIndex ? "active" : ""}`}
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
      <div className="image-carousel-container">
        {/* Main image — click to view full */}
        <div className="carousel-image-wrapper" onClick={openLightbox} title="Click to view full image">
          <img
            src={currentSrc}
            alt={`${placeName} - Photo ${currentIndex + 1}`}
            className="carousel-image"
            onError={() => handleImageError(currentIndex)}
          />
          <div className="carousel-fullview-badge">
            <span>🔍 View Full</span>
          </div>
        </div>

        {imageCount > 1 && (
          <>
            <button className="carousel-arrow carousel-arrow-left" onClick={goPrev} aria-label="Previous image">❮</button>
            <button className="carousel-arrow carousel-arrow-right" onClick={goNext} aria-label="Next image">❯</button>
          </>
        )}

        {imageCount > 1 && (
          <div className="carousel-dots">
            {Array.from({ length: imageCount }).map((_, i) => (
              <span
                key={i}
                className={`carousel-dot ${i === currentIndex ? "active" : ""}`}
                onClick={(e) => { e.stopPropagation(); goTo(i); }}
              />
            ))}
          </div>
        )}

        {imageCount > 1 && (
          <div className="carousel-counter">
            {currentIndex + 1} / {imageCount}
          </div>
        )}
      </div>

      {lightboxPortal}
    </>
  );
}

// Legacy ReviewForm removed in favor of the new upgraded ReviewsModal

function buildLocalFallbackItinerary(form) {
  const destination = form.destination || "your destination";
  const startCity = form.start_city || "your starting city";
  const days = Math.max(1, Math.min(Number(form.days) || 1, 7));
  const baseLat = 19.076;
  const baseLon = 72.8777;

  const daily_plans = Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const offset = index * 0.01;

    return {
      day,
      date: "",
      activities: [
        {
          time: "08:30 AM",
          place_name: "Travel and Arrival",
          category: "Travel",
          lat: baseLat + offset,
          lon: baseLon + offset,
          description: `Start from ${startCity} and arrive in ${destination}. Keep the first leg comfortable and leave buffer time for check-in, meals, and local transfers.`,
          alternatives: ["Private cab", "Public transport"],
          cost: "Rs 500-2,000",
        },
        {
          time: "10:30 AM",
          place_name: `${destination} Orientation Walk`,
          category: "Attraction",
          lat: baseLat + offset + 0.006,
          lon: baseLon + offset + 0.006,
          description: `Begin with an easy orientation walk in ${destination}. Visit the central area, understand local transport, and keep the first sightseeing block light.`,
          alternatives: ["Local viewpoint", "Market lane"],
          cost: "Rs 0-300",
        },
        {
          time: "01:00 PM",
          place_name: "Dining Options",
          category: "Food",
          lat: baseLat + offset + 0.009,
          lon: baseLon + offset + 0.004,
          description: "Option 1 (Budget): local eatery. Option 2 (Comfort): family restaurant. Option 3 (Premium): scenic cafe or hotel restaurant.",
          alternatives: ["Local thali", "Cafe lunch"],
          cost: "Rs 250-1,200",
        },
        {
          time: "03:00 PM",
          place_name: form.theme || "Local Experience",
          category: "Attraction",
          lat: baseLat + offset + 0.012,
          lon: baseLon + offset + 0.011,
          description: `Use the afternoon for a ${form.theme || "local"} experience that fits your preferences: ${form.preferences || "sightseeing, food, and easy exploration"}.`,
          alternatives: ["Museum stop", "Nature stop"],
          cost: "Rs 200-800",
        },
        {
          time: "06:30 PM",
          place_name: "Evening Viewpoint",
          category: "Relax",
          lat: baseLat + offset + 0.015,
          lon: baseLon + offset + 0.014,
          description: "Slow down with a viewpoint, promenade, garden, or calm public square. This keeps the schedule realistic and leaves time for photos and rest.",
          alternatives: ["Viewpoint", "Promenade"],
          cost: "Rs 0-400",
        },
        {
          time: "08:00 PM",
          place_name: "Dining Options",
          category: "Food",
          lat: baseLat + offset + 0.01,
          lon: baseLon + offset + 0.016,
          description: "Option 1 (Budget): street food. Option 2 (Comfort): regional restaurant. Option 3 (Premium): rooftop, beachside, or hotel dining.",
          alternatives: ["Street food lane", "Regional restaurant"],
          cost: "Rs 300-1,500",
        },
      ],
    };
  });

  return {
    itinerary_text: `Backend is not reachable right now, so TripAI created an offline ${days}-day fallback plan for ${destination}. Start the backend and generate again for AI-enriched places, images, saved trips, and recommendations.`,
    daily_plans,
  };
}

export default function ItineraryPage({ language, chatItinerary, chatDailyPlans }) {
  const location = useLocation();

  const navigate = useNavigate();
  const [savedTripId, setSavedTripId] = useState(null);
  const [isFinalized, setIsFinalized] = useState(false);
  const [followers, setFollowers] = useState([
    { email: "", invited: false, verified: false, otp: "", message: "", error: "", loadingInvite: false, loadingVerify: false }
  ]);

  const [form, setForm] = useState({
    start_city: "",
    destination: "",
    days: "",
    theme: "",
    preferences: "",
  });

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

  // Automated travel itinerary generation from home panel
  useEffect(() => {
    if (location.state && location.state.destination) {
      const {
        destination,
        days,
        budget,
        interests,
        source,
        start_city,
        theme,
        placeInfo,
      } = location.state;
      const prefilledForm = {
        start_city: start_city || source || "",
        destination: destination || "",
        days: days || "",
        theme: theme || budget || "",
        preferences: [placeInfo, interests].filter(Boolean).join(" "),
      };
      setForm(prefilledForm);
      if (prefilledForm.start_city) {
        submit(prefilledForm);
      }
    }
  }, [location.state]);

  const submit = async (formToUse = form) => {
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
        ...formToUse,
        language
      });

      const data = res.data;
      if (data.error && !data.daily_plans?.length) {
        throw new Error(data.error);
      }

      if (data.daily_plans?.length) {
        const warningPrefix = data.warning ? `${data.warning}\n\n` : "";
        setResult(`${warningPrefix}${data.itinerary_text || ""}`);
        setDailyPlans(data.daily_plans);
      } else {
        setResult(data.itinerary || data.itinerary_text || "No itinerary returned from backend.");
      }

      if (data.id) {
        setSavedTripId(data.id);
      } else {
        setSavedTripId(null);
      }
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
        const commRes = await API.post("/api/community-recommendations", {
          destination: formToUse.destination,
          theme: formToUse.theme,
          preferences: formToUse.preferences
        });
        setCommunitySuggestions(commRes.data.suggestions || []);
      } catch (commError) {
        console.log("Could not fetch community suggestions:", commError);
        setCommunitySuggestions([]);
      }

    } catch (error) {
      console.error("Itinerary generation failed:", error);
      const fallback = buildLocalFallbackItinerary(formToUse);
      setResult(fallback.itinerary_text);
      setDailyPlans(fallback.daily_plans);
      setRecommendations([]);
      setCommunitySuggestions([]);
    }
    setLoading(false);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(result);
    alert("Copied!");
  };

  // Build a Google Maps route URL for a day's activities
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

  // Build an OpenStreetMap static image URL covering all points
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
    // Use OpenStreetMap Static Map via a free proxy (geoapify) — fallback to a plain labelled banner
    const markers = valid.map((a, i) => `lonlat:${a.lon},${a.lat};color:%23e74c3c;size:medium;text:${i+1}`).join('|');
    // Use Geoapify free static maps (no key needed for low-res)
    return `https://staticmap.openstreetmap.de/staticmap.php?bbox=${bbox}&size=${width}x${height}&maptype=mapnik&markers=${valid.map((a,i)=>`${a.lat},${a.lon},ol-marker-red`).join('|')}`;
  };

  const downloadPDF = async () => {
    const element = printRef.current;
    if (!element) return;

    // ── Step 1: Find all map containers and swap them for clickable static images ──
    const mapContainers = element.querySelectorAll('.leaflet-container');
    const restorations  = []; // [{parent, placeholder, original}]

    // Gather all day activities for building per-day URLs
    const allActivitiesForDays = dailyPlans;

    mapContainers.forEach((mapEl, idx) => {
      const parent = mapEl.parentElement;

      // Figure out which activities belong to this map
      // Master map (idx===0 when allDailyPlans) has all; day maps match by index
      let activities = [];
      let googleUrl  = "";
      let label      = "";

      if (idx === 0 && element.querySelector('.master-map-container')?.contains(mapEl)) {
        // Master map: link to first day route as overview
        activities = allActivitiesForDays.flatMap(d => d.activities);
        label = "🗺️ View Full Trip on Google Maps";
      } else {
        // Per-day map — figure out which day by counting day-map-containers
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

      // Build placeholder: a clickable banner with the map image (or fallback div)
      const placeholder = document.createElement('div');
      placeholder.style.cssText = `
        width: 100%;
        background: #f0f4f8;
        border-radius: 10px;
        overflow: hidden;
        border: 2px solid #3b82f6;
        margin-bottom: 15px;
        font-family: Arial, sans-serif;
      `;
      placeholder.innerHTML = `
        <a href="${googleUrl}" target="_blank" rel="noopener noreferrer"
           style="display:block; text-decoration:none; color:inherit;">
          ${
            imgSrc
              ? `<img src="${imgSrc}" alt="Map" crossorigin="anonymous"
                      style="width:100%; height:300px; object-fit:cover; display:block;" />`
              : `<div style="height:160px; background: linear-gradient(135deg,#1e3a5f,#3b82f6);
                             display:flex; align-items:center; justify-content:center; color:white; font-size:18px;">
                   🗺️ Map Preview
                 </div>`
          }
          <div style="
            padding: 14px 20px;
            background: #3b82f6;
            color: white;
            font-size: 15px;
            font-weight: 600;
            text-align: center;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          ">
            ${label} ↗
          </div>
        </a>
      `;

      parent.insertBefore(placeholder, mapEl);
      parent.removeChild(mapEl);
      restorations.push({ parent, placeholder, original: mapEl });
    });

    // ── Step 2: Generate PDF with links enabled ──
    const opt = {
      margin:      10,
      filename:    `${form.destination || 'trip'}-itinerary.pdf`,
      image:       { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: false },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
      enableLinks: true,
    };

    await html2pdf().set(opt).from(element).save();

    // ── Step 3: Restore original maps ──
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
    setResult(itinerary.itinerary_text);
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

    // Create activity from suggestion
    const newActivity = {
      time: "Flexible",
      place_name: suggestion.place_name,
      category: suggestion.category || "Attraction",
      description: `Community recommended: ${suggestion.reason}`,
      lat: suggestion.lat,
      lon: suggestion.lon
    };

    // Add to first day's activities
    firstDay.activities = [...firstDay.activities, newActivity];
    setDailyPlans(updatedPlans);

    // Remove from suggestions
    setCommunitySuggestions(prev => prev.filter(s => s.place_name !== suggestion.place_name));

    alert(`${suggestion.place_name} added to your itinerary!`);
  };

  return (
    <div className="itinerary-page">

      <h2 className="page-title">AI Travel Itinerary Planner</h2>

      {/* SAVED ITINERARIES TOGGLE */}
      <div className="saved-itineraries-toggle">
        <button onClick={fetchSavedItineraries} className="saved-btn">
          📁 View Saved Itineraries
        </button>
      </div>

      {/* SAVED ITINERARIES LIST */}
      {showSaved && (
        <div className="saved-itineraries-section">
          <h3>Your Saved Itineraries</h3>
          {savedItineraries.length === 0 ? (
            <p>No saved itineraries yet. Generate and save some plans!</p>
          ) : (
            <div className="saved-itineraries-grid">
              {savedItineraries.map((itinerary) => (
                <div key={itinerary.id} className="saved-itinerary-card">
                  <h4>{itinerary.destination}</h4>
                  <p><strong>From:</strong> {itinerary.start_city}</p>
                  <p><strong>Created:</strong> {new Date(itinerary.created_at).toLocaleDateString()}</p>
                  <p className="saved-itinerary-preview">
                    {itinerary.itinerary_text.substring(0, 150)}...
                  </p>
                  <button 
                    onClick={() => loadSavedItinerary(itinerary)}
                    className="load-saved-btn"
                  >
                    Load This Plan
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setShowSaved(false)} className="close-saved-btn">
            Close
          </button>
        </div>
      )}

      {/* FORM */}
      <div className="itinerary-form">
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
        <div className="row">
          <input
            type="number"
            placeholder="Days"
            value={form.days}
            onChange={(e) => setForm({ ...form, days: e.target.value })}
          />
          <input
            placeholder="Theme"
            value={form.theme}
            onChange={(e) => setForm({ ...form, theme: e.target.value })}
          />
        </div>
        <textarea
          placeholder="Preferences"
          value={form.preferences}
          onChange={(e) => setForm({ ...form, preferences: e.target.value })}
        />
        <button onClick={submit}>
          {loading ? "Generating..." : "Generate Itinerary"}
        </button>
      </div>

      {/* ACTIONS */}
      {result && (
        <div className="result-actions" style={{ display: "flex", gap: "10px", justifyContent: "center", margin: "20px 0", flexWrap: "wrap" }}>
          <button onClick={copyToClipboard} className="saved-trip-secondary-btn">Copy</button>
          <button onClick={downloadPDF} className="saved-trip-secondary-btn">Download PDF</button>
          {savedTripId && (
            <>
              <button onClick={handleEditItinerary} className="saved-trip-primary-btn">Edit Itinerary</button>
              <button onClick={handleFinalizeItinerary} className="saved-trip-primary-btn" style={{ background: "#10b981" }}>Finalize It</button>
            </>
          )}
        </div>
      )}

      {isFinalized && savedTripId && (
        <div className="link-follower-card" style={{
          maxWidth: "650px",
          margin: "20px auto",
          background: "rgba(255, 255, 255, 0.95)",
          padding: "25px",
          borderRadius: "16px",
          boxShadow: "0 6px 30px rgba(0, 0, 0, 0.15)",
          border: "1px solid #e2e8f0"
        }}>
          <h3 style={{ marginTop: 0, color: "#1e293b", fontSize: "20px", fontWeight: "600", marginBottom: "10px", textAlign: "center" }}>Link Follower (Optional)</h3>
          <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px", textAlign: "center" }}>
            Add travel buddies to your trip. They will be linked as followers. Send the invite code to their email, enter the code below to verify them, and click **Done** when finished.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "20px" }}>
            {followers.map((follower, index) => (
              <div key={index} style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                position: "relative"
              }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", color: "#334155" }}>Buddy #{index + 1}</h4>
                
                {/* Email Input row */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="email"
                    placeholder="Follower's Email Address"
                    value={follower.email}
                    onChange={(e) => handleFollowerEmailChange(index, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px"
                    }}
                    disabled={follower.invited}
                    required
                  />
                  {!follower.invited && (
                    <button
                      type="button"
                      disabled={follower.loadingInvite}
                      onClick={() => handleSendInvite(index)}
                      className="saved-trip-primary-btn"
                      style={{ padding: "10px 18px", fontSize: "13px" }}
                    >
                      {follower.loadingInvite ? "Sending..." : "Send Invite"}
                    </button>
                  )}
                </div>

                {/* Verification Row (only visible if invited and not verified) */}
                {follower.invited && !follower.verified && (
                  <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="6-digit OTP Code"
                      maxLength={6}
                      value={follower.otp}
                      onChange={(e) => handleFollowerOtpChange(index, e.target.value.replace(/\D/g, ""))}
                      style={{
                        width: "140px",
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px"
                      }}
                      disabled={follower.loadingVerify}
                    />
                    <button
                      type="button"
                      disabled={follower.loadingVerify}
                      onClick={() => handleVerifyOtp(index)}
                      className="saved-trip-primary-btn"
                      style={{ padding: "10px 18px", fontSize: "13px", background: "#10b981" }}
                    >
                      {follower.loadingVerify ? "Verifying..." : "Verify Code"}
                    </button>
                  </div>
                )}

                {/* Status / Success Messages */}
                {follower.message && (
                  <div style={{ marginTop: "10px", color: "#16a34a", fontSize: "13px", fontWeight: "500" }}>
                    ✓ {follower.message}
                  </div>
                )}
                {follower.error && (
                  <div style={{ marginTop: "10px", color: "#dc2626", fontSize: "13px", fontWeight: "500" }}>
                    ⚠ {follower.error}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              onClick={addFollowerField}
              className="saved-trip-secondary-btn"
              style={{ padding: "10px 18px" }}
            >
              + Add More Buddy
            </button>
            
            <button
              type="button"
              onClick={handleDoneFinalizing}
              className="saved-trip-primary-btn"
              style={{ padding: "10px 24px", background: "#4f46e5" }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* RECOMMENDATIONS */}
      {recommendations.length > 0 && (
        <div className="recommendations-section">
          <h3>Recommended for You</h3>
          <p>Based on your travel history, here are some personalized suggestions:</p>
          <div className="recommendations-grid">
            {recommendations.map((rec, index) => (
              <div key={index} className="recommendation-card">
                <h4>{rec.title}</h4>
                <p><strong>Destination:</strong> {rec.destination}</p>
                <p><strong>Theme:</strong> {rec.theme}</p>
                <p><strong>Duration:</strong> {rec.suggested_duration}</p>
                <p className="recommendation-reason">{rec.reason}</p>
                <button 
                  onClick={() => {
                    setForm({
                      ...form,
                      destination: rec.destination,
                      theme: rec.theme,
                      days: rec.suggested_duration.split('-')[0].trim() // e.g., "3" from "3-5 days"
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="try-recommendation-btn"
                >
                  Try This Itinerary
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* COMMUNITY SUGGESTIONS */}
      {communitySuggestions.length > 0 && (
        <div className="recommendations-section">
          <h3>Suggested Nearby Experiences</h3>
          <p>Community-rated places near your destination:</p>
          <div className="recommendations-grid">
            {communitySuggestions.map((suggestion, index) => (
              <div key={index} className="recommendation-card">
                <h4>{suggestion.place_name}</h4>
                <div className="rating-display">
                  <span className="stars">⭐</span>
                  <span>{suggestion.rating}</span>
                </div>
                <p className="recommendation-reason">{suggestion.reason}</p>
                <p><strong>Distance:</strong> {suggestion.distance}</p>
                <button 
                  onClick={() => addToItinerary(suggestion)}
                  className="try-recommendation-btn"
                >
                  Add To Itinerary
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OUTPUT BOARD */}
      <div className="output-section">
        <div className="output-board" ref={printRef}>
          {result && dailyPlans.length > 0 ? (
            <>
              {/* MASTER MAP */}
              <div className="master-map-container" style={{marginBottom: "30px"}}>
                <MapComponent allDailyPlans={dailyPlans} />
              </div>

              <div className="itinerary-timeline">
              {dailyPlans.map((dayPlan, index) => (
                <div key={index} className="day-section">
                  <h3 className="day-header">Day {dayPlan.day}</h3>

                  <div className="activities-list">
                    {dayPlan.activities.map((activity, actIndex) => (
                      <div key={actIndex} className="activity-card">

                        <div className="activity-time-col">
                          <span className="activity-time">{activity.time}</span>
                          <div className="time-connector"></div>
                        </div>

                        <div className="activity-content">
                          {/* IMAGE CAROUSEL — shows 2-3 images with full view */}
                          <ImageCarousel
                            placeName={activity.place_name}
                            destination={form.destination}
                          />

                          <div className="activity-header">
                            {renderActivityIcon(activity.category)}
                            <h4>{activity.place_name}</h4>
                          </div>

                          <p className="activity-description">{activity.description}</p>

                          {activity.alternatives && activity.alternatives.length > 0 && (
                            <div className="activity-alternatives">
                              <span className="alt-label">Alternatives:</span>
                              {activity.alternatives.map((alt, altIdx) => (
                                <span key={altIdx} className="alt-chip clickable-chip" onClick={() => handleAltClick(alt)}>{alt}</span>
                              ))}
                            </div>
                          )}

                          <div className="activity-footer">
                            {activity.cost && <span className="activity-cost">{activity.cost}</span>}
                            <button
                              onClick={() => setReviewModal({ isOpen: true, place: activity })}
                              className="rate-place-btn"
                            >
                              ⭐ Rate This Place
                            </button>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${activity.lat},${activity.lon}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="book-tour-btn"
                            >
                              <i className="fas fa-location-arrow"></i> Navigate
                            </a>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>

                  {/* Map for this day */}
                  <div className="day-map-container">
                    <MapComponent activities={dayPlan.activities} />
                  </div>

                </div>
              ))}
            </div>
            </>
          ) : (
            <div className="empty-state">
              {result ? <pre className="output-text">{result}</pre> : "Your generated itinerary will appear here."}
            </div>
          )}
        </div>
      </div>

      {altModal.isOpen && (
        <div className="alt-modal-overlay" onClick={() => setAltModal({ ...altModal, isOpen: false })}>
          <div className="alt-modal-content" onClick={e => e.stopPropagation()}>
            <button className="alt-close-btn" onClick={() => setAltModal({ ...altModal, isOpen: false })}>✖</button>
            <h3>{altModal.place}</h3>
            {altModal.loading ? (
              <p>Fetching AI insights...</p>
            ) : (
              <div>
                <p style={{ lineHeight: 1.5, color: "#444" }}>{altModal.text}</p>
                <div style={{ marginTop: "20px" }}>
                   <p style={{ fontSize: "12px", color: "#888", fontStyle: "italic", marginBottom: "10px" }}>Like this place? Open the chatbot and ask to swap it in!</p>
                   <button className="alt-modal-action-btn" onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(altModal.place + " " + (form.destination || form.start_city))}`, '_blank')}>
                     Search Web
                   </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REVIEW MODAL */}
      <ReviewsModal
        open={reviewModal.isOpen}
        onClose={() => setReviewModal({ isOpen: false, place: null })}
        itemName={reviewModal.place ? reviewModal.place.place_name : null}
        reviewType="place"
        destination={form.destination}
      />

    </div>
  );
}
