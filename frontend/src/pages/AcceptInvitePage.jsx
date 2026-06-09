import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import "./CollaborationDashboard.css";

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState("Checking invite...");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [otpMode, setOtpMode] = useState(!token);
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (otpMode) {
      setStatus("Enter the 6-digit invite code provided by the trip owner.");
      return;
    }
    
    const acceptToken = async () => {
      if (!localStorage.getItem("token")) {
        setNeedsAuth(true);
        setStatus("Sign up or log in with the invited email to join this trip.");
        return;
      }
      try {
        const response = await api.post("/api/collaboration/invitations/accept", { token });
        setStatus("Invite accepted. Opening collaboration room...");
        navigate(`/collaborate/${response.data.trip_id}`);
      } catch (err) {
        setStatus(err.response?.data?.detail || "Could not accept this invite.");
        setOtpMode(true); // Fallback to OTP mode
      }
    };
    acceptToken();
  }, [navigate, token, otpMode]);

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (!localStorage.getItem("token")) {
      setNeedsAuth(true);
      setStatus("You must be logged in to join a trip.");
      return;
    }
    
    if (otpCode.length !== 6) {
      setStatus("Please enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    setStatus("Verifying code...");
    try {
      const response = await api.post("/api/collaboration/invitations/accept-otp", { otp_code: otpCode });
      setStatus("Success! Joining trip...");
      navigate(`/collaborate/${response.data.trip_id}`);
    } catch (err) {
      setStatus(err.response?.data?.detail || "Invalid or expired code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="collab-page">
      <section className="trip-picker">
        <h1>Join a Trip</h1>
        <p className="mb-4 text-white/80">{status}</p>
        
        {otpMode && !needsAuth && (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4 max-w-sm w-full mx-auto mt-4">
            <input 
              type="text" 
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit OTP" 
              className="px-4 py-3 bg-slate-800 border border-white/20 rounded-xl text-white text-center text-2xl tracking-[0.5em] font-bold outline-none focus:border-cyan-500 transition-colors"
            />
            <button 
              type="submit" 
              disabled={loading || otpCode.length !== 6}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold py-3 rounded-xl transition-all"
            >
              {loading ? "Joining..." : "Join Trip"}
            </button>
          </form>
        )}

        {needsAuth && (
          <div className="hero-actions mt-6">
            <Link to={`/signup`}>Create Account</Link>
            <Link to={`/login`}>Log in</Link>
          </div>
        )}
      </section>
    </main>
  );
}
