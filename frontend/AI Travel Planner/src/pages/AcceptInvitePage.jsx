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

  useEffect(() => {
    const accept = async () => {
      if (!token) {
        setStatus("Invite token is missing.");
        return;
      }
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
      }
    };
    accept();
  }, [navigate, token]);

  return (
    <main className="collab-page">
      <section className="trip-picker">
        <h1>Trip invitation</h1>
        <p>{status}</p>
        {needsAuth && (
          <div className="hero-actions">
            <Link to={`/signup?invite_token=${encodeURIComponent(token)}`}>Sign up</Link>
            <Link to={`/login?invite_token=${encodeURIComponent(token)}`}>Log in</Link>
          </div>
        )}
      </section>
    </main>
  );
}
