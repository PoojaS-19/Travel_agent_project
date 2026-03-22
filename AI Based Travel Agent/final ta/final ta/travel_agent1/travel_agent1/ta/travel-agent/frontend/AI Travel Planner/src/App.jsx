import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ItineraryPage from "./pages/ItineraryPage";
import HotelsPage from "./pages/HotelsPage";
import RestaurantsPage from "./pages/RestaurantsPage";
import FlightsPage from "./pages/FlightsPage";
import FloatingChatbot from "./components/FloatingChatbot";
import "./App.css";
import TrainSearchPage from "./pages/TrainSearchPage";
import { useState } from "react";
import MainHome from "./pages/MainHome";

export default function App() {
  const [language, setLanguage] = useState("English");
  const [chatItinerary, setChatItinerary] = useState("");

  return (
    <BrowserRouter>

      {/* Floating AI Chatbot */}
      <FloatingChatbot
        language={language}
        setChatItinerary={setChatItinerary}
      />

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo">TripAI Travel</div>

        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/itinerary">Itinerary</Link>
          <Link to="/hotels">Hotels</Link>
          <Link to="/restaurants">Restaurants</Link>
          <Link to="/flights">Flights</Link>
          <Link to="/trainsearch">Train</Link>
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

        <Route
          path="/itinerary"
          element={
            <ItineraryPage
              language={language}
              chatItinerary={chatItinerary}
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
      </Routes>
    </BrowserRouter>
  );
}
