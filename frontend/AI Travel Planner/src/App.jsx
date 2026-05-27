import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
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
      <nav className="navbar">
        <div className="logo">TripAI Travel</div>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/itinerary">Itinerary</Link>
          <Link to="/saved-trips">Saved Trips</Link>
          <Link to="/hotels">Hotels</Link>
          <Link to="/restaurants">Restaurants</Link>
          <Link to="/flights">Flights</Link>
          <Link to="/trainsearch">Train</Link>
          <Link to="/bussearch">Bus</Link>

          {user ? (
            <>
              <span className="user-info">Welcome, {user.username}!</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup">Sign Up</Link>
            </>
          )}
        </div>

        <select
          className="language-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="English">English</option>
          <option value="Hindi">Hindi</option>
          <option value="Marathi">Marathi</option>
        </select>
      </nav>

      {/* ROUTES */}
      <Routes>
        <Route path="/" element={<MainHome />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/saved-trips" element={<SavedTripsPage />} />
        <Route path="/collaborate" element={<CollaborationDashboard />} />
        <Route path="/collaborate/:tripId" element={<CollaborationDashboard />} />
        <Route path="/collaboration/accept" element={<AcceptInvitePage />} />

        <Route
          path="/itinerary"
          element={
            <ItineraryPage
              language={language}
              chatItinerary={chatItinerary}
              chatDailyPlans={chatDailyPlans}
            />
          }
        />

        <Route
          path="/flights"
          element={<FlightsPage language={language} />}
        />

        <Route
          path="/hotels"
          element={<HotelsPage language={language} />}
        />

        <Route
          path="/restaurants"
          element={<RestaurantsPage language={language} />}
        />

        <Route
          path="/trainsearch"
          element={<TrainSearchPage language={language} />}
        />

        <Route
          path="/bussearch"
          element={<BusSearchPage language={language} />}
        />
      </Routes>
    </BrowserRouter>
  );
}
