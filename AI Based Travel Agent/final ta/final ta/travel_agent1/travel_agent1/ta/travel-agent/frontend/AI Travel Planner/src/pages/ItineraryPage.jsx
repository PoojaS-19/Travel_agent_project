import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import API from "../api";
import "../App.css";
import MapComponent from "../components/MapComponent";
import { CITIES } from "../data/cities";
import html2pdf from "html2pdf.js";

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
    fetch(`http://127.0.0.1:8000/place-image-count?place=${baseQuery}`)
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

  const currentSrc = `http://127.0.0.1:8000/place-image?place=${baseQuery}&index=${currentIndex}`;

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

export default function ItineraryPage({ language, chatItinerary, chatDailyPlans }) {

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
    setLoading(true);
    setResult("");
    setDailyPlans([]);

    try {
      const res = await API.post("/itinerary", {
        ...form,
        language
      });

      const data = res.data;
      if (data.daily_plans) {
        setResult(data.itinerary_text);
        setDailyPlans(data.daily_plans);
      } else {
        setResult(data.itinerary || data);
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

  const downloadPDF = () => {
    const element = printRef.current;
    if (!element) return;
    
    const opt = {
      margin:       10,
      filename:     `${form.destination || 'trip'}-itinerary.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handleAltClick = async (altName) => {
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

  return (
    <div className="itinerary-page">

      <h2 className="page-title">AI Travel Itinerary Planner</h2>

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
        <div className="result-actions">
          <button onClick={copyToClipboard}>Copy</button>
          <button onClick={downloadPDF}>Download PDF</button>
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

    </div>
  );
}
