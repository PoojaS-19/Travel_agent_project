import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import API from "../api";
import "../App.css";

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite_token");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await API.post("/auth/signup", { 
        ...formData, 
        invite_token: inviteToken || undefined 
      });

      const email = response.data.email;
      const code = response.data.verification_code;

      // Redirect to verification page
      const inviteQuery = inviteToken ? `&invite_token=${encodeURIComponent(inviteToken)}` : "";
      navigate(`/verify-email?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}${inviteQuery}`);
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.response?.data?.detail || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2>Join TripAI Travel</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Choose a username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Create a password"
              minLength="6"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <div className="auth-links">
          <p>
            Already have an account?{" "}
            <Link to={inviteToken ? `/login?invite_token=${encodeURIComponent(inviteToken)}` : "/login"}>
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
