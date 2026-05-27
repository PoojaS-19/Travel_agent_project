import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import API from "../api";
import "../App.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite_token");
  const [formData, setFormData] = useState({
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
      const response = await API.post("/auth/login", formData);

      // Store token in localStorage
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      if (inviteToken) {
        const inviteResponse = await API.post("/api/collaboration/invitations/accept", {
          token: inviteToken,
        });
        navigate(`/collaborate/${inviteResponse.data.trip_id}`);
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Login error:", err);
      if (err.response?.status === 403 && err.response?.data?.detail?.verification_code) {
        const { email, verification_code } = err.response.data.detail;
        const inviteQuery = inviteToken ? `&invite_token=${encodeURIComponent(inviteToken)}` : "";
        navigate(`/verify-email?email=${encodeURIComponent(email)}&code=${encodeURIComponent(verification_code)}${inviteQuery}`);
      } else {
        setError(err.response?.data?.detail || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2>Login to TripAI Travel</h2>

        <form onSubmit={handleSubmit} className="auth-form">
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
              placeholder="Enter your password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="auth-links">
          <p><Link to="/forgot-password">Forgot password?</Link></p>
          <p>
            Don't have an account?{" "}
            <Link to={inviteToken ? `/signup?invite_token=${encodeURIComponent(inviteToken)}` : "/signup"}>
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
