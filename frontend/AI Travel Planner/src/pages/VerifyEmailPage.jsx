import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import API from "../api";
import "../App.css";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const codeParam = searchParams.get("code") || "";
  const inviteToken = searchParams.get("invite_token");

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState(codeParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
    if (codeParam) setCode(codeParam);
  }, [emailParam, codeParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await API.post("/auth/verify-email", {
        email: email.trim(),
        code: code.trim(),
      });

      setMessage("Email verified successfully! Logging you in...");

      // Store credentials in localStorage
      localStorage.setItem("token", response.data.access_token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      if (inviteToken) {
        const inviteResponse = await API.post("/api/collaboration/invitations/accept", {
          token: inviteToken,
        });
        setTimeout(() => {
          navigate(`/collaborate/${inviteResponse.data.trip_id}`);
        }, 800);
      } else {
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError(err.response?.data?.detail || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2>Verify Your Email</h2>
        <p style={{ color: "#666", marginBottom: "20px", fontSize: "14px" }}>
          We've sent a 6-digit verification code to your email. Please enter it below.
        </p>

        {codeParam && (
          <div className="reset-code-box" style={{ marginBottom: "20px" }}>
            <span>Verification code (Demo helper)</span>
            <strong>{codeParam}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!emailParam && (
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="code">Verification Code</label>
            <input
              type="text"
              id="code"
              name="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              maxLength="6"
              placeholder="Enter 6-digit code"
              style={{
                letterSpacing: "4px",
                textAlign: "center",
                fontSize: "20px",
                fontWeight: "bold",
              }}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? "Verifying..." : "Verify & Log In"}
          </button>
        </form>

        <div className="auth-links">
          <p>Need another code? <Link to="/login">Try logging in again</Link></p>
        </div>
      </div>
    </div>
  );
}
