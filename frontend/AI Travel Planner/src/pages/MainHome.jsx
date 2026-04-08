import { Link } from "react-router-dom";
import "./MainHome.css";

export default function MainHome() {
  return (
    <div className="main-page">

      {/* NAVBAR */}
      <nav className="navbar">
        <h4><b>AI Travel Planner</b></h4>

        <div className="nav-links">
          <Link to="/itinerary">Itinerary</Link>
          <Link to="/hotels">Hotels</Link>
          <Link to="/restaurants">Restaurants</Link>
          <Link to="/trains">Trains</Link>
          <Link to="/flights">Flights</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-section">
        <h1>Plan Your Perfect Trip With AI</h1>
        <p>Hotels • Restaurants • Flights • Itinerary • Trains</p>
      </section>

      {/* FEATURE CARDS */}
      <section className="feature-grid">
        <Link to="/itinerary" className="feature-card">AI Itinerary Planner</Link>
        <Link to="/hotels" className="feature-card">Hotel Search</Link>
        <Link to="/restaurants" className="feature-card">Restaurants</Link>
        <Link to="/trains" className="feature-card">Train Booking</Link>
        <Link to="/flights" className="feature-card">Flight Search</Link>
      </section>

    </div>
  );
}
