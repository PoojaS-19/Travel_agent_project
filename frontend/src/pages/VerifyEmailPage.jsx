import { useState, useEffect, useRef } from "react";
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
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [attempts, setAttempts] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devCode, setDevCode] = useState(codeParam);

  const inputRefs = useRef([]);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
    if (codeParam && /^\d{6}$/.test(codeParam)) {
      setOtp(codeParam.split(""));
      setDevCode(codeParam);
      setMessage("Development verification code has been filled in for you.");
    }
  }, [emailParam, codeParam]);

  // Countdown timer for Resend OTP
  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timer]);

  const handleChange = (e, index) => {
    const val = e.target.value;
    // Only allow digits
    if (val && !/^\d$/.test(val)) return;

    let newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto-focus next input box if value is entered
    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      let newOtp = [...otp];
      if (!otp[index] && index > 0) {
        // If current is empty, clear previous and focus previous
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) return; // Only allow 6 digits

    const newOtp = pastedData.split("");
    setOtp(newOtp);
    inputRefs.current[5]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const codeStr = otp.join("");
    if (codeStr.length !== 6) {
      setError("Please enter a 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await API.post("/auth/verify-email", {
        email: email.trim(),
        code: codeStr.trim(),
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
          window.location.href = `/collaborate/${inviteResponse.data.trip_id}`;
        }, 800);
      } else {
        setTimeout(() => {
          window.location.href = "/";
        }, 1500);
      }
    } catch (err) {
      console.error("Verification error:", err);
      const backendError = err.response?.data?.detail || "Verification failed. Please try again.";
      setError(backendError);
      
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setError("Maximum tries (3) exceeded. Please request a new verification code.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e) => {
    if (e) e.preventDefault();
    if (timer > 0 || resending || resendCount >= 2) return;
    setResending(true);
    setError("");
    setMessage("");

    try {
      const response = await API.post("/auth/resend-otp", {
        email: email.trim(),
      });

      const verificationCode = response.data?.verification_code;
      if (/^\d{6}$/.test(verificationCode)) {
        setOtp(verificationCode.split(""));
        setDevCode(verificationCode);
        setMessage("Development verification code has been filled in for you.");
      } else {
        setMessage("Verification code resent successfully! Please check your email.");
      }
      setTimer(60);
      setAttempts(0);
      setResendCount((prev) => prev + 1);
      if (!/^\d{6}$/.test(verificationCode)) {
        setOtp(["", "", "", "", "", ""]);
      }
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 50);
    } catch (err) {
      console.error("Resend OTP error:", err);
      setError(err.response?.data?.detail || "Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const isBlocked = attempts >= 3;

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h2>Verify Your Email</h2>
        <p style={{ color: "#666", marginBottom: "20px", fontSize: "14px" }}>
          We've sent a 6-digit verification code to your email. Please enter it below.
        </p>

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
                disabled={loading || resending || isBlocked}
              />
            </div>
          )}

          <div className="form-group">
            <label style={{ display: "block", marginBottom: "12px", textAlign: "center", fontWeight: "600", color: "#333" }}>
              Verification Code
            </label>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", margin: "10px 0 20px" }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleChange(e, idx)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onPaste={idx === 0 ? handlePaste : undefined}
                  disabled={loading || resending || isBlocked}
                  style={{
                    width: "48px",
                    height: "48px",
                    textAlign: "center",
                    fontSize: "22px",
                    fontWeight: "bold",
                    borderRadius: "8px",
                    border: isBlocked ? "2px solid #fecaca" : "2px solid #e1e1e1",
                    outline: "none",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box",
                    backgroundColor: isBlocked ? "#fef2f2" : "#ffffff",
                  }}
                  onFocus={(e) => {
                    if (!isBlocked) {
                      e.target.style.borderColor = "#0073de";
                      e.target.style.boxShadow = "0 0 0 3px rgba(0, 115, 222, 0.1)";
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = isBlocked ? "#fecaca" : "#e1e1e1";
                    e.target.style.boxShadow = "none";
                  }}
                />
              ))}
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}
          {devCode && (
            <div className="success-message">
              Local development code: <strong>{devCode}</strong>
            </div>
          )}

          <button type="submit" disabled={loading || resending || isBlocked || otp.includes("")} className="auth-button">
            {loading ? "Verifying..." : "Verify & Log In"}
          </button>
        </form>

        <div className="auth-links" style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>
          {timer > 0 ? (
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
              Resend code in <strong>{timer}s</strong>
            </p>
          ) : resendCount >= 2 ? (
            <p style={{ margin: 0, fontSize: "14px", color: "#dc2626", fontWeight: "600" }}>
              If you did not get the code, please try again later.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resending}
              style={{
                background: "none",
                border: "none",
                color: resending ? "#999" : "#0073de",
                textDecoration: resending ? "none" : "underline",
                cursor: resending ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
                padding: 0,
              }}
            >
              {resending ? "Resending Verification Code..." : "Resend Verification Code"}
            </button>
          )}

          <p style={{ margin: "5px 0 0", fontSize: "14px" }}>
            Wrong email address? <Link to="/signup">Change email ID</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
