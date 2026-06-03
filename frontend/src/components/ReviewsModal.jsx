import { useState, useEffect } from "react";
import API, { API_BASE_URL } from "../api";
import "../App.css";

export default function ReviewsModal({ open, onClose, itemName, reviewType, destination }) {
  const [reviews, setReviews] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Filters & Sorting States
  const [sortBy, setSortBy] = useState("latest");
  const [travelerTypeFilter, setTravelerTypeFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [withPhotos, setWithPhotos] = useState(false);
  const [withVideos, setWithVideos] = useState(false);

  // Form Submission States
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [travelerType, setTravelerType] = useState("Solo Traveler");
  const [tripPurpose, setTripPurpose] = useState("Leisure"); // hotel only
  const [recommend, setRecommend] = useState(true); // recommend / visit again
  const [stayDate, setStayDate] = useState(""); // hotel only
  const [selectedMedia, setSelectedMedia] = useState([]);

  // Subcategory Ratings States
  const [subRatings, setSubRatings] = useState({});

  // Lightbox Media Preview
  const [lightboxMedia, setLightboxMedia] = useState(null);

  // Current logged in user
  const loggedInUser = JSON.parse(localStorage.getItem("user") || "null");

  // Report State
  const [reportingReview, setReportingReview] = useState(null);
  const [reportReason, setReportReason] = useState("Spam");
  const [reportDetails, setReportDetails] = useState("");

  const hotelCategories = [
    { key: "cleanliness", label: "Cleanliness" },
    { key: "staff", label: "Staff Behavior & Hospitality" },
    { key: "comfort", label: "Room Comfort" },
    { key: "food", label: "Food Quality" },
    { key: "value", label: "Value for Money" },
    { key: "location", label: "Location Convenience" },
    { key: "amenities", label: "Amenities & Facilities" },
    { key: "safety", label: "Safety & Security" },
    { key: "checkin", label: "Check-in / Check-out Experience" },
    { key: "wifi", label: "Internet / WiFi Quality" }
  ];

  const placeCategories = [
    { key: "safety", label: "Safety" },
    { key: "cleanliness", label: "Cleanliness" },
    { key: "crowd", label: "Crowd Management" },
    { key: "accessibility", label: "Accessibility" },
    { key: "scenic", label: "Scenic Beauty" },
    { key: "family", label: "Family Friendly" },
    { key: "food", label: "Food Availability" },
    { key: "transport", label: "Transport Connectivity" },
    { key: "value", label: "Value for Money" }
  ];

  const categories = reviewType === "hotel" ? hotelCategories : placeCategories;

  useEffect(() => {
    if (open && itemName) {
      // Reset states
      setShowForm(false);
      setSelectedMedia([]);
      setTitle("");
      setText("");
      setNotes("");
      setRating(5);
      const initialSubRatings = {};
      categories.forEach(c => {
        initialSubRatings[c.key] = 5;
      });
      setSubRatings(initialSubRatings);
      
      fetchData();
    }
  }, [open, itemName, sortBy, travelerTypeFilter, verifiedOnly, withPhotos, withVideos]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const searchEndpoint = reviewType === "hotel" 
        ? `/api/reviews/hotel/search/${encodeURIComponent(itemName)}`
        : `/api/reviews/place/search/${encodeURIComponent(itemName)}`;

      const res = await API.get(searchEndpoint, {
        params: {
          traveler_type: travelerTypeFilter || undefined,
          verified_only: verifiedOnly || undefined,
          with_photos: withPhotos || undefined,
          with_videos: withVideos || undefined,
          sort_by: sortBy
        }
      });
      setReviews(res.data.reviews || []);

      // Fetch analytics
      const analyticsEndpoint = reviewType === "hotel"
        ? `/api/reviews/hotel/${encodeURIComponent(itemName)}/analytics`
        : `/api/reviews/place/${encodeURIComponent(itemName)}/analytics`;
      
      const aRes = await API.get(analyticsEndpoint);
      setAnalytics(aRes.data);

      // Fetch AI summary
      fetchAiSummary();

    } catch (err) {
      console.error("Error fetching review data:", err);
    }
    setLoading(false);
  };

  const fetchAiSummary = async () => {
    setAiLoading(true);
    try {
      const aiEndpoint = `/api/reviews/${reviewType}/${encodeURIComponent(itemName)}/ai-summary`;
      const aiRes = await API.get(aiEndpoint);
      setAiSummary(aiRes.data);
    } catch (err) {
      console.error("Error fetching AI summary:", err);
    }
    setAiLoading(false);
  };

  const handleSubRatingChange = (key, val) => {
    setSubRatings(prev => ({
      ...prev,
      [key]: parseInt(val)
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedMedia(files);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!text.trim()) return alert("Please enter review description.");
    setFormLoading(true);

    try {
      const payload = {
        rating,
        review_title: title,
        review_text: text,
        review: text,
        additional_notes: notes,
        traveler_type: travelerType,
        trip_type: travelerType
      };

      if (reviewType === "hotel") {
        payload.hotel_name = itemName;
        payload.would_recommend = recommend;
        payload.stay_date = stayDate || new Date().toISOString().split('T')[0];
        payload.trip_purpose = tripPurpose;
        categories.forEach(c => {
          payload[`rating_${c.key}`] = subRatings[c.key];
        });
      } else {
        payload.place_name = itemName;
        payload.destination = destination || itemName;
        payload.would_visit_again = recommend;
        payload.category = "Attraction";
        categories.forEach(c => {
          payload[`rating_${c.key}`] = subRatings[c.key];
        });
      }

      const submitEndpoint = reviewType === "hotel" ? "/api/reviews/hotel" : "/api/reviews/place";
      const res = await API.post(submitEndpoint, payload);
      const reviewId = res.data.review_id;

      // Handle media uploads if any files are selected
      if (selectedMedia.length > 0) {
        const formData = new FormData();
        selectedMedia.forEach(file => {
          formData.append("files", file);
        });

        await API.post(`/api/reviews/${reviewType}/${reviewId}/media`, formData, {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        });
      }

      alert("Review submitted successfully!");
      setShowForm(false);
      fetchData();
    } catch (err) {
      console.error("Failed to submit review:", err);
      alert(err.response?.data?.detail || "Failed to submit review. Try again.");
    }
    setFormLoading(false);
  };

  const handleLike = async (review) => {
    try {
      const res = await API.post(`/api/reviews/${reviewType}/${review.id}/like`);
      // Update in-memory reviews count and liked status if necessary
      setReviews(prev => prev.map(r => {
        if (r.id === review.id) {
          return { ...r, helpful_count: res.data.helpful_count };
        }
        return r;
      }));
    } catch (err) {
      console.error("Like review error:", err);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportingReview) return;
    try {
      await API.post(`/api/reviews/${reviewType}/${reportingReview.id}/report`, {
        reason: reportReason,
        details: reportDetails
      });
      alert("Review reported to moderators.");
      setReportingReview(null);
      setReportDetails("");
    } catch (err) {
      console.error("Error reporting review:", err);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!confirm("Are you sure you want to delete your review?")) return;
    try {
      await API.delete(`/api/reviews/${reviewType}/${reviewId}`);
      alert("Review deleted.");
      fetchData();
    } catch (err) {
      console.error("Error deleting review:", err);
    }
  };

  if (!open) return null;

  return (
    <div className="reviews-modal-overlay" onClick={onClose}>
      <div className="reviews-modal-content" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="reviews-modal-header">
          <div>
            <h2>Reviews for {itemName}</h2>
            <p className="subtitle">{reviewType === "hotel" ? "🏨 Accommodation Stay Reviews" : "🎡 Tourist Attraction Visitor Reviews"}</p>
          </div>
          <button className="close-modal-btn" onClick={onClose}>✕</button>
        </div>

        {/* Scrollable Area */}
        <div className="reviews-modal-body">
          
          {/* Top Analytics Panel */}
          {analytics && analytics.total_reviews > 0 && (
            <div className="analytics-card-grid">
              
              {/* Score & recommendation percentage */}
              <div className="score-summary-card">
                <div className="score-badge">
                  <span className="rating-num">{analytics.overall_rating}</span>
                  <span className="rating-max">/5</span>
                </div>
                <div className="stars-row">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} className={`star-item ${Math.round(analytics.overall_rating) > i ? "active" : ""}`}>⭐</span>
                  ))}
                </div>
                <p className="total-label">Based on {analytics.total_reviews} reviews</p>
                <div className="recommendation-pill">
                  {analytics.recommendation_percentage}% {reviewType === "hotel" ? "would recommend stay" : "would visit again"}
                </div>
              </div>

              {/* Category Averages */}
              <div className="category-averages-card">
                <h4>Category Breakdown</h4>
                <div className="cat-bars-list">
                  {Object.entries(analytics.category_averages).map(([key, val]) => {
                    const matchedCat = categories.find(c => c.key === key);
                    const label = matchedCat ? matchedCat.label : key;
                    return (
                      <div key={key} className="cat-bar-item">
                        <div className="cat-bar-labels">
                          <span>{label}</span>
                          <strong>{val} / 5</strong>
                        </div>
                        <div className="cat-bar-track">
                          <div 
                            className="cat-bar-fill" 
                            style={{ 
                              width: `${(val / 5) * 100}%`,
                              background: val >= 4.0 ? "#10b981" : (val >= 3.0 ? "#f59e0b" : "#ef4444")
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Star Distribution */}
              <div className="distribution-card">
                <h4>Rating Distribution</h4>
                <div className="star-dist-list">
                  {[5, 4, 3, 2, 1].map(stars => {
                    const count = analytics.rating_distribution[stars] || 0;
                    const pct = analytics.total_reviews > 0 ? (count / analytics.total_reviews) * 100 : 0;
                    return (
                      <div key={stars} className="dist-row">
                        <span className="dist-star-label">{stars} ⭐</span>
                        <div className="dist-track">
                          <div className="dist-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="dist-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* AI Reviews Summary Banner */}
          {aiLoading ? (
            <div className="ai-summary-shimmer">
              <span className="sparkles-icon">✨</span> Summarizing reviews using AI...
            </div>
          ) : (
            aiSummary && (analytics?.total_reviews > 0) && (
              <div className="ai-summary-card">
                <div className="ai-summary-title">
                  <span className="sparkles-icon">✨</span>
                  <h4>AI Travel Insights Summary</h4>
                  <span className="sentiment-badge" data-sentiment={aiSummary.overall_sentiment}>
                    Sentiment: {aiSummary.overall_sentiment}
                  </span>
                </div>
                <div className="ai-summary-lists">
                  <div className="ai-list-col">
                    <h5>Top Strengths</h5>
                    <ul>
                      {aiSummary.top_strengths?.map((str, idx) => <li key={idx}>✓ {str}</li>)}
                    </ul>
                  </div>
                  <div className="ai-list-col">
                    <h5>Common Complaints</h5>
                    <ul>
                      {aiSummary.common_complaints?.map((comp, idx) => <li key={idx}>⚠ {comp}</li>)}
                    </ul>
                  </div>
                </div>
                <p className="ai-notice">Synthesized instantly from actual guest feedback.</p>
              </div>
            )
          )}

          {/* Filters and Write Review Buttons */}
          <div className="reviews-action-toolbar">
            <div className="filters-container">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="filter-select">
                <option value="latest">Latest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest_rated">Highest Rating</option>
                <option value="lowest_rated">Lowest Rating</option>
                <option value="most_helpful">Most Helpful</option>
              </select>

              <select value={travelerTypeFilter} onChange={e => setTravelerTypeFilter(e.target.value)} className="filter-select">
                <option value="">All Travelers</option>
                <option value="Solo Traveler">Solo Travelers</option>
                <option value="Couple">Couples</option>
                <option value="Family">Families</option>
                <option value="Friends Group">Friends Groups</option>
                <option value="Business Traveler">Business Travelers</option>
              </select>

              <label className="checkbox-pill">
                <input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} />
                <span>Verified Stay</span>
              </label>

              <label className="checkbox-pill">
                <input type="checkbox" checked={withPhotos} onChange={e => setWithPhotos(e.target.checked)} />
                <span>Has Photos</span>
              </label>

              <label className="checkbox-pill">
                <input type="checkbox" checked={withVideos} onChange={e => setWithVideos(e.target.checked)} />
                <span>Has Videos</span>
              </label>
            </div>

            <button className="write-review-trigger-btn" onClick={() => setShowForm(!showForm)}>
              {showForm ? "✕ Close Form" : "✏ Write a Review"}
            </button>
          </div>

          {/* WRITE REVIEW FORM */}
          {showForm && (
            <form className="write-review-form" onSubmit={submitReview}>
              <h3>Share Your Travel Experience</h3>

              <div className="form-double-col">
                <div className="form-group">
                  <label>Overall Rating:</label>
                  <div className="rating-selector">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span 
                        key={star} 
                        className={`star-pick ${rating >= star ? 'active' : ''}`}
                        onClick={() => setRating(star)}
                      >
                        ⭐
                      </span>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Traveler Type:</label>
                  <select value={travelerType} onChange={e => setTravelerType(e.target.value)}>
                    <option value="Solo Traveler">Solo Traveler</option>
                    <option value="Couple">Couple</option>
                    <option value="Family">Family</option>
                    <option value="Friends Group">Friends Group</option>
                    <option value="Business Traveler">Business Traveler</option>
                  </select>
                </div>
              </div>

              {reviewType === "hotel" && (
                <div className="form-double-col">
                  <div className="form-group">
                    <label>Stay Date:</label>
                    <input type="date" value={stayDate} onChange={e => setStayDate(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Trip Purpose:</label>
                    <select value={tripPurpose} onChange={e => setTripPurpose(e.target.value)}>
                      <option value="Leisure">Leisure</option>
                      <option value="Business">Business</option>
                      <option value="Honeymoon">Honeymoon</option>
                      <option value="Adventure">Adventure</option>
                      <option value="Family Vacation">Family Vacation</option>
                      <option value="Weekend Getaway">Weekend Getaway</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Subcategories */}
              <div className="subcategory-rating-inputs">
                <h4>Detailed Category Ratings</h4>
                <div className="sliders-grid">
                  {categories.map(c => (
                    <div key={c.key} className="slider-item">
                      <div className="slider-label">
                        <span>{c.label}</span>
                        <strong>{subRatings[c.key] || 5} ⭐</strong>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="5" 
                        value={subRatings[c.key] || 5} 
                        onChange={e => handleSubRatingChange(c.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Review Title:</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="Summarize your main point (e.g. Excellent service and neat rooms)"
                  required
                />
              </div>

              <div className="form-group">
                <label>Review Text:</label>
                <textarea 
                  value={text} 
                  onChange={e => setText(e.target.value)} 
                  placeholder="Share details of your experience, pros and cons..."
                  rows={4}
                  required
                />
              </div>

              <div className="form-group">
                <label>Additional Notes (optional):</label>
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  placeholder="Information regarding tips, prices, nearby places, etc."
                  rows={2}
                />
              </div>

              <div className="form-double-col">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={recommend} 
                      onChange={e => setRecommend(e.target.checked)} 
                    />
                    <span>{reviewType === "hotel" ? "I recommend staying here" : "I would visit this place again"}</span>
                  </label>
                </div>
                
                <div className="form-group">
                  <label>Upload Media (Photos/Videos):</label>
                  <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} />
                </div>
              </div>

              <button type="submit" className="submit-review-btn" disabled={formLoading}>
                {formLoading ? "Submitting..." : "Submit Review"}
              </button>
            </form>
          )}

          {/* REVIEWS LIST */}
          <div className="reviews-list-container">
            {loading ? (
              <p className="loading-placeholder">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="empty-placeholder">No reviews matches these filter criteria. Be the first to share an experience!</p>
            ) : (
              reviews.map(r => {
                const isOwner = loggedInUser && loggedInUser.id === r.user_id;
                const isAdmin = loggedInUser && loggedInUser.is_admin;
                return (
                  <div key={r.id} className={`review-item-card ${r.verified_status ? 'verified-highlight' : ''}`}>
                    
                    {/* User, badge, and date info */}
                    <div className="review-card-top">
                      <div className="user-profile-meta">
                        <div className="user-avatar-circle">
                          {r.username ? r.username.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div>
                          <span className="review-username">{r.username}</span>
                          <span className="review-date">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="review-badges-row">
                        {r.verified_status && (
                          <span className="badge-item verified-badge">
                            {reviewType === "hotel" ? "✅ Verified Stay" : "✅ Verified Visitor"}
                          </span>
                        )}
                        {r.traveler_type && (
                          <span className="badge-item traveler-type-badge">
                            👤 {r.traveler_type}
                          </span>
                        )}
                        {reviewType === "hotel" && r.trip_purpose && (
                          <span className="badge-item trip-purpose-badge">
                            💼 {r.trip_purpose}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ratings */}
                    <div className="ratings-block-card">
                      <div className="overall-rating-card">
                        <span className="rating-score">⭐ {r.rating}</span>
                        <span className="recommend-label">
                          {reviewType === "hotel" 
                            ? (r.would_recommend ? "👍 Recommends stay" : "👎 Does not recommend stay")
                            : (r.would_visit_again ? "👍 Would visit again" : "👎 Would not visit again")
                          }
                        </span>
                      </div>

                      {/* Subcategory dropdown toggler */}
                      <details className="subratings-dropdown-drawer">
                        <summary>View details</summary>
                        <div className="subratings-dropdown-grid">
                          {categories.map(c => {
                            const val = r[`rating_${c.key}`];
                            if (val === undefined || val === null) return null;
                            return (
                              <div key={c.key} className="subrating-mini-row">
                                <span>{c.label}:</span>
                                <strong>{val} ⭐</strong>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    </div>

                    {/* Content */}
                    <div className="review-content-card">
                      {r.review_title && <h4 className="review-title">{r.review_title}</h4>}
                      <p className="review-text">{r.review}</p>
                      {r.additional_notes && (
                        <div className="review-notes-box">
                          <strong>Note:</strong> {r.additional_notes}
                        </div>
                      )}
                    </div>

                    {/* Media attachments */}
                    {r.media && r.media.length > 0 && (
                      <div className="review-media-grid">
                        {r.media.map(m => (
                          <div 
                            key={m.id} 
                            className="media-item-box"
                            onClick={() => setLightboxMedia(m)}
                          >
                            {m.media_type === "video" ? (
                              <div className="video-thumbnail-placeholder">
                                🎬 Video
                              </div>
                            ) : (
                              <img src={`${API_BASE_URL}${m.file_url}`} alt="Review attachment" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Interactions (Helpful, Report, Delete, Edit) */}
                    <div className="review-interactions-footer">
                      <button className="interaction-btn helpful-btn" onClick={() => handleLike(r)}>
                        👍 Helpful ({r.helpful_count || 0})
                      </button>

                      <button className="interaction-btn report-btn" onClick={() => setReportingReview(r)}>
                        🚩 Report
                      </button>

                      {(isOwner || isAdmin) && (
                        <button className="interaction-btn delete-btn" onClick={() => handleDeleteReview(r.id)}>
                          🗑 Delete
                        </button>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

      {/* REPORT SUB-MODAL */}
      {reportingReview && (
        <div className="submodal-overlay" onClick={() => setReportingReview(null)}>
          <div className="submodal-content" onClick={e => e.stopPropagation()}>
            <h3>Report Review</h3>
            <p>Reason for flagging review #{reportingReview.id}:</p>
            <form onSubmit={handleReportSubmit}>
              <select value={reportReason} onChange={e => setReportReason(e.target.value)} className="submodal-select">
                <option value="Spam">Spam</option>
                <option value="Fake Review">Fake Review</option>
                <option value="Offensive Content">Offensive Content</option>
                <option value="Misleading Information">Misleading Information</option>
                <option value="Other">Other</option>
              </select>
              <textarea 
                placeholder="Describe why this review violates travel community rules..." 
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
                rows={3}
                className="submodal-textarea"
              />
              <div className="submodal-actions">
                <button type="button" onClick={() => setReportingReview(null)} className="submodal-cancel">Cancel</button>
                <button type="submit" className="submodal-submit">Submit Report</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIGHTBOX SUB-MODAL */}
      {lightboxMedia && (
        <div className="lightbox-overlay" onClick={() => setLightboxMedia(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightboxMedia(null)}>✕</button>
            {lightboxMedia.media_type === "video" ? (
              <video src={`${API_BASE_URL}${lightboxMedia.file_url}`} controls autoplay style={{ maxWidth: "100%", maxHeight: "80vh" }} />
            ) : (
              <img src={`${API_BASE_URL}${lightboxMedia.file_url}`} alt="Expanded review attachment" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain" }} />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
