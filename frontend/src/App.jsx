import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ItineraryPage from "./pages/ItineraryPage";
import HotelsPage from "./pages/HotelsPage";
import RestaurantsPage from "./pages/RestaurantsPage";
import FlightsPage from "./pages/FlightsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import SavedTripsPage from "./pages/SavedTripsPage";
import CollaborationDashboard from "./pages/CollaborationDashboard";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import FloatingChatbot from "./components/FloatingChatbot";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";
import TrainSearchPage from "./pages/TrainSearchPage";
import BusSearchPage from "./pages/BusSearchPage";
import { useState, useEffect } from "react";
import MainHome from "./pages/MainHome";

export default function App() {
  const [language, setLanguage] = useState("English");
  const [chatItinerary, setChatItinerary] = useState("");
  const [chatDailyPlans, setChatDailyPlans] = useState([]);
  const [user, setUser] = useState(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Check for existing user session on app load
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    window.location.href = "/";
  };

  return (
    <BrowserRouter>

      {/* Floating AI Chatbot */}
      <FloatingChatbot
        language={language}
        setChatItinerary={setChatItinerary}
        setChatDailyPlans={setChatDailyPlans}
      />

      {/* NAVBAR */}
      <nav className="navbar-modern">
        <Link to="/" className="logo-container">
          <span className="logo-icon">🚀</span>
          <span className="logo-text">TripAI<span className="logo-subtext">Travel</span></span>
        </Link>

        <div className="nav-links-container">
          <Link to="/" className="nav-item">🏠 Home</Link>
          <Link to="/flights" className="nav-item">✈ Flights</Link>
          <Link to="/hotels" className="nav-item">🏨 Hotels</Link>
          <Link to="/trainsearch" className="nav-item">🚆 Trains</Link>
          <Link to="/bussearch" className="nav-item">🚌 Buses</Link>
          
          {/* MORE DROPDOWN */}
          <div 
            className="more-dropdown-wrapper"
            onMouseEnter={() => setShowMoreMenu(true)}
            onMouseLeave={() => setShowMoreMenu(false)}
          >
            <button className="nav-item more-trigger-btn">
              📦 More <span className="arrow-down">⌵</span>
            </button>
            {showMoreMenu && (
              <div className="more-dropdown-menu">
                <Link to="/itinerary" className="more-dropdown-item" onClick={() => setShowMoreMenu(false)}>
                  🗺️ Create Trip with AI
                </Link>
                <Link to="/restaurants" className="more-dropdown-item" onClick={() => setShowMoreMenu(false)}>
                  🍽️ Eat & Dine
                </Link>
                <Link to="/saved-trips" className="more-dropdown-item" onClick={() => setShowMoreMenu(false)}>
                  ⭐ Saved Stays
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="nav-actions-container">
          {user ? (
            <div className="user-profile-badge">
              <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
              <span className="username-display">{user.username}</span>
              <button onClick={handleLogout} className="logout-btn-modern">Logout</button>
            </div>
          ) : (
            <div className="auth-buttons-container">
              <Link to="/login" className="login-btn-nav">Login</Link>
              <Link to="/signup" className="signup-btn-nav">Sign Up</Link>
            </div>
          )}

          <div className="lang-selector-wrapper">
            <span className="lang-icon">🌐</span>
            <select
              className="language-select-modern"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="English">EN</option>
              <option value="Hindi">HI</option>
              <option value="Marathi">MR</option>
            </select>
          </div>
        </div>
      </nav>

      {/* ROUTES */}
      <Routes>
        <Route path="/" element={<MainHome />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        
        {/* Protected Feature Routes */}
        <Route path="/saved-trips" element={<ProtectedRoute><SavedTripsPage /></ProtectedRoute>} />
        <Route path="/collaborate" element={<ProtectedRoute><CollaborationDashboard /></ProtectedRoute>} />
        <Route path="/collaborate/:tripId" element={<ProtectedRoute><CollaborationDashboard /></ProtectedRoute>} />
        <Route path="/collaboration/accept" element={<ProtectedRoute><AcceptInvitePage /></ProtectedRoute>} />

        <Route
          path="/itinerary"
          element={
            <ProtectedRoute>
              <ItineraryPage
                language={language}
                chatItinerary={chatItinerary}
                chatDailyPlans={chatDailyPlans}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/flights"
          element={<ProtectedRoute><FlightsPage language={language} /></ProtectedRoute>}
        />

        <Route
          path="/hotels"
          element={<ProtectedRoute><HotelsPage language={language} /></ProtectedRoute>}
        />

        <Route
          path="/restaurants"
          element={<ProtectedRoute><RestaurantsPage language={language} /></ProtectedRoute>}
        />

        <Route
          path="/trainsearch"
          element={<ProtectedRoute><TrainSearchPage language={language} /></ProtectedRoute>}
        />

        <Route
          path="/bussearch"
          element={<ProtectedRoute><BusSearchPage language={language} /></ProtectedRoute>}
        />
      </Routes>
    </BrowserRouter>
  );
}
