import { useState } from "react";

export default function InviteMembersModal({ open, onClose, onInvite }) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState([]);

  if (!open) return null;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResults([]);

    try {
      const parsed = emails.split(/[,\n]/).map((email) => email.trim()).filter(Boolean);
      const inviteResults = await onInvite(parsed, role);
      setResults(inviteResults || []);
      setEmails("");
    } catch (err) {
      setError(err.response?.data?.detail || "Could not send invites");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="collab-modal-backdrop">
      <div className="collab-modal">
        <div className="collab-modal-header">
          <h2>Invite members</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">x</button>
        </div>

        <form onSubmit={submit}>
          <label>
            Emails
            <textarea value={emails} onChange={(event) => setEmails(event.target.value)} placeholder="maya@example.com, arjun@example.com" required />
          </label>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </label>
          {error && <p className="collab-error">{error}</p>}
          <div className="collab-modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={busy}>{busy ? "Sending..." : "Send invites"}</button>
          </div>
        </form>

        {results.length > 0 && (
          <div className="invite-results">
            {results.map((invite) => {
              const hasFailed = !invite.email_sent;
              return (
                <div 
                  className={`invite-result ${hasFailed ? "email-failed" : "email-success"}`} 
                  key={`${invite.email}-${invite.id}`}
                  style={{
                    borderLeft: hasFailed ? "4px solid #f59e0b" : "4px solid #10b981",
                    background: hasFailed ? "#fffbeb" : "#f0fdf4",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{invite.email}</strong>
                    <span style={{ 
                      fontSize: "12px", 
                      fontWeight: "bold",
                      color: hasFailed ? "#d97706" : "#16a34a" 
                    }}>
                      {hasFailed ? "⚠ Email Delivery Failed" : "✓ Email Sent"}
                    </span>
                  </div>
                  {hasFailed && (
                    <p style={{ margin: 0, fontSize: "13px", color: "#b45309" }}>
                      {invite.email_error || "Email delivery failed, but the invitation is active. You can copy the link below and share it manually."}
                    </p>
                  )}
                  {invite.invite_link && (
                    <button 
                      type="button" 
                      onClick={() => {
                        navigator.clipboard.writeText(invite.invite_link);
                        alert(`Invite link copied for ${invite.email}!`);
                      }}
                      style={{
                        alignSelf: "flex-start",
                        background: hasFailed ? "#d97706" : "#10b981",
                        color: "white",
                        padding: "6px 12px",
                        fontSize: "13px",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginTop: "4px"
                      }}
                    >
                      Copy invite link
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
