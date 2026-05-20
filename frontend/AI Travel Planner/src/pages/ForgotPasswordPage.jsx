import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import "../App.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await API.post("/auth/forgot-password", { email });
      setResetToken(response.data.reset_token || "");
      setMessage(response.data.message || "Reset code generated.");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.response?.data?.detail || "Could not generate reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await API.post("/auth/reset-password", {
        email,
        reset_token: resetToken,
        new_password: newPassword
      });
      setMessage(response.data.message || "Password reset successfully.");
      setNewPassword("");
      setResetToken("");
    } catch (err) {
      console.error("Reset password error:", err);
      setError(err.response?.data?.detail || "Password reset failed.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2>Reset Password</h2>

        <form onSubmit={handleRequestReset} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Account Email</label>
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

          <button type="submit" disabled={loading} className="auth-button">
            {loading ? "Generating Code..." : "Get Reset Code"}
          </button>
        </form>

        {resetToken && (
          <div className="reset-code-box">
            <span>Reset code</span>
            <strong>{resetToken}</strong>
          </div>
        )}

        <form onSubmit={handleResetPassword} className="auth-form reset-form">
          <div className="form-group">
            <label htmlFor="resetToken">Reset Code</label>
            <input
              type="text"
              id="resetToken"
              name="resetToken"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              required
              placeholder="Paste your reset code"
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength="6"
              placeholder="Create a new password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <button type="submit" disabled={resetLoading} className="auth-button">
            {resetLoading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="auth-links">
          <p>Remembered your password? <Link to="/login">Login here</Link></p>
        </div>
      </div>
    </div>
  );
}
