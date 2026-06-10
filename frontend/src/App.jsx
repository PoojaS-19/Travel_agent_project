import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
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
import TrainSearchPage from "./pages/TrainSearchPage";
import BusSearchPage from "./pages/BusSearchPage";
import DashboardPage from "./pages/DashboardPage";
import { useState, useEffect } from "react";
import MainHome from "./pages/MainHome";
import { Menu, X, Compass, LogOut, User, Globe, Heart, Plane, Bed, Utensils, Navigation, Train, Bus, LayoutDashboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function NavigationBar({ language, setLanguage, user, handleLogout }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const links = [
    { to: "/", label: "Home", icon: Compass },
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/itinerary", label: "Itinerary", icon: Navigation },
    { to: "/saved-trips", label: "Saved Trips", icon: Heart },
    { to: "/hotels", label: "Hotels", icon: Bed },
    { to: "/restaurants", label: "Restaurants", icon: Utensils },
    { to: "/flights", label: "Flights", icon: Plane },
    { to: "/trainsearch", label: "Train", icon: Train },
    { to: "/bussearch", label: "Bus", icon: Bus },
  ];

  return (
    <nav className="w-full bg-white border-b border-slate-200 sticky top-0 z-50 px-4 md:px-8 py-3 flex items-center justify-between shadow-sm">
      {/* LOGO */}
      <Link to="/" className="flex items-center gap-2 text-2xl font-black tracking-tighter text-brand-primary">
        <span className="p-1.5 bg-brand-accent text-white rounded-lg shadow-sm">
          <Compass className="w-6 h-6 shrink-0" />
        </span>
        <span className="font-extrabold text-brand-primary tracking-tight">
          Travel<span className="text-brand-accent font-black uppercase ml-1">Trip</span>
        </span>
      </Link>

      {/* CENTER FLAT NAVIGATION LINKS */}
      <div className="hidden lg:flex items-center gap-6 xl:gap-8 mx-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center gap-1.5 py-1 px-3 border-b-2 transition-all duration-200 ${
                isActive 
                  ? "border-brand-accent text-brand-accent font-extrabold" 
                  : "border-transparent text-slate-500 hover:text-slate-900 font-semibold"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-brand-accent" : "text-slate-400"}`} />
              <span className="text-xs uppercase tracking-wider">{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* RIGHT ACTION BUTTONS */}
      <div className="hidden lg:flex items-center gap-4">
        <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors">
          <Globe className="w-4 h-4 text-brand-secondary absolute left-2.5 pointer-events-none" />
          <select
            className="bg-transparent border-none pl-6 pr-1 py-0 text-xs font-bold focus:ring-0 cursor-pointer text-slate-700 outline-none w-full h-full appearance-none"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="English">EN</option>
            <option value="Hindi">HI</option>
            <option value="Marathi">MR</option>
          </select>
        </div>

        {/* User Auth Card */}
        {user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-lg px-3 py-1.5 text-brand-secondary text-xs font-extrabold shadow-sm">
              <div className="w-5 h-5 rounded-full bg-brand-secondary text-white flex items-center justify-center font-black">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <span>{user.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="bg-gradient-to-r from-brand-accent to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-full shadow-md shadow-orange-500/10 hover:shadow-orange-500/20 transition-all uppercase tracking-wider"
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>

      {/* MOBILE HAMBURGER */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden p-2 text-slate-500 hover:text-slate-950 hover:bg-slate-50 rounded-lg transition-colors"
      >
        {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* MOBILE PANEL */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-[65px] left-0 w-full bg-white border-b border-slate-200 p-6 flex flex-col gap-4 shadow-xl z-50 lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-600 rounded-xl hover:text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <Icon className="w-5 h-5 text-brand-secondary" />
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <hr className="border-slate-100" />

            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Language</span>
              <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100 transition-colors">
                <Globe className="w-4 h-4 text-brand-secondary absolute left-3 pointer-events-none" />
                <select
                  className="bg-transparent border-none pl-6 pr-1 py-0 text-xs font-bold focus:ring-0 cursor-pointer text-slate-700 outline-none w-full h-full appearance-none"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Marathi">Marathi</option>
                </select>
              </div>
            </div>

            <hr className="border-slate-100" />

            {user ? (
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-lg px-3 py-1.5 text-brand-secondary text-xs font-bold">
                  <User className="w-4 h-4" />
                  <span>{user.username}</span>
                </div>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 px-4 py-2 rounded-lg text-xs font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center font-bold text-slate-600 hover:text-slate-900 border border-slate-200 px-4 py-2.5 rounded-lg text-sm"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center bg-brand-accent text-white font-bold px-4 py-2.5 rounded-lg text-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem("language") || "English");

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);
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
      <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
        {/* Floating AI Chatbot */}
        <FloatingChatbot
          language={language}
          setChatItinerary={setChatItinerary}
          setChatDailyPlans={setChatDailyPlans}
        />

        {/* NAVBAR */}
        <NavigationBar
          language={language}
          setLanguage={setLanguage}
          user={user}
          handleLogout={handleLogout}
        />

        {/* MAIN BODY WRAPPER */}
        <main className="flex-1 flex flex-col relative z-10">
          <Routes>
            <Route path="/" element={<MainHome />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            
            {/* Protected Feature Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
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
        </main>
      </div>
    </BrowserRouter>
  );
}
