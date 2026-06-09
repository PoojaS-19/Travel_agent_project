import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import API from "../api";
import { Compass, ShieldAlert, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

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

  const inputRefs = useRef([]);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
    if (codeParam && /^\d{6}$/.test(codeParam)) {
      setOtp(codeParam.split(""));
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
        newOtp[index - 1] = "";
        setOtp(newOtp);
        inputRefs.current[index - 1]?.focus();
      } else {
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pastedData)) return;

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
      await API.post("/auth/resend-otp", {
        email: email.trim(),
      });

      setMessage("Verification code resent successfully! Please check your email.");
      setTimer(60);
      setAttempts(0);
      setResendCount((prev) => prev + 1);
      setOtp(["", "", "", "", "", ""]);
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
    <div className="w-full min-h-[calc(100vh-73px)] flex items-center justify-center px-4 py-12 bg-brand-bg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-xl"
      >
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-sky-50 border border-sky-100 text-brand-secondary rounded-2xl mb-4">
            <Compass className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Verify Your Email</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            We've sent a 6-digit verification code to <strong>{email || "your email"}</strong>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!emailParam && (
            <div className="space-y-1.5 text-left">
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                disabled={loading || resending || isBlocked}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none transition-all text-slate-900"
              />
            </div>
          )}

          <div className="space-y-2 text-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Verification Code
            </label>
            <div className="flex justify-between gap-2.5 py-1">
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
                  className="w-12 h-12 text-center text-xl font-bold rounded-xl border focus:ring-1 focus:ring-brand-secondary outline-none transition-all bg-white text-slate-900"
                  style={{
                    borderColor: isBlocked ? "#fecaca" : "#cbd5e1",
                    backgroundColor: isBlocked ? "#fef2f2" : "#ffffff",
                  }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 p-3.5 rounded-xl text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="text-left">{error}</span>
            </div>
          )}

          {message && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-left">{message}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading || resending || isBlocked || otp.includes("")} 
            className="w-full py-3 bg-gradient-to-r from-brand-accent to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold rounded-xl shadow-md disabled:opacity-50 transition-all text-xs uppercase tracking-wider cursor-pointer border-none"
          >
            {loading ? "Verifying..." : "Verify & Log In"}
          </button>
        </form>

        <div className="mt-8 text-center flex flex-col gap-3 items-center text-xs text-slate-500">
          {timer > 0 ? (
            <p>
              Resend code in <strong>{timer}s</strong>
            </p>
          ) : resendCount >= 2 ? (
            <p className="text-rose-600 font-bold">
              If you did not get the code, please try again later.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resending}
              className="bg-transparent border-none text-brand-secondary font-bold hover:underline cursor-pointer p-0"
            >
              {resending ? "Resending Verification Code..." : "Resend Verification Code"}
            </button>
          )}

          <p>
            Wrong email address? <Link to="/signup" className="text-brand-secondary font-bold hover:underline">Change email ID</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
