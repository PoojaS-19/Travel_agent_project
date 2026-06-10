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
  const [inviteCode, setInviteCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    if (otpMode) {
      setStatus("Enter the 6-digit invite code or OTP provided by the trip owner.");
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

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    if (!localStorage.getItem("token")) {
      setNeedsAuth(true);
      setStatus("You must be logged in to join a trip.");
      return;
    }
    
    if (inviteCode.length !== 6) {
      setStatus("Please enter a valid 6-digit code.");
      return;
    }

    setCodeLoading(true);
    setStatus("Verifying invite code...");
    try {
      const response = await api.post("/api/collaboration/invitations/accept-code", { invite_code: inviteCode });
      setStatus("Success! Joining trip...");
      navigate(`/collaborate/${response.data.trip_id}`);
    } catch (err) {
      setStatus(err.response?.data?.detail || "Invalid or expired code.");
    } finally {
      setCodeLoading(false);
    }
  };

  return (
    <main className="collab-page">
      <section className="trip-picker">
        <h1>Join a Trip</h1>
        <p className="mb-4 text-white/80">{status}</p>
        
        {otpMode && !needsAuth && (
          <div className="flex flex-col gap-6 max-w-sm w-full mx-auto mt-4">
            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-2 w-full">
              <span className="text-white/80 text-sm font-semibold self-start">Join with Email OTP:</span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit OTP" 
                  className="px-4 py-2 bg-slate-800 border border-white/20 rounded-xl text-white text-center text-lg font-bold outline-none focus:border-cyan-500 transition-colors flex-1"
                />
                <button 
                  type="submit" 
                  disabled={loading || otpCode.length !== 6}
                  className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-4 rounded-xl transition-all"
                >
                  {loading ? "Joining..." : "Join OTP"}
                </button>
              </div>
            </form>

            <div className="w-full border-t border-white/10 my-1"></div>

            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-2 w-full">
              <span className="text-white/80 text-sm font-semibold self-start">Join With Invite Code:</span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit Code" 
                  className="px-4 py-2 bg-slate-800 border border-white/20 rounded-xl text-white text-center text-lg font-bold outline-none focus:border-emerald-500 transition-colors flex-1"
                />
                <button 
                  type="submit" 
                  disabled={codeLoading || inviteCode.length !== 6}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-bold px-4 rounded-xl transition-all"
                >
                  {codeLoading ? "Joining..." : "Join Code"}
                </button>
              </div>
            </form>
          </div>
        ) }

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
