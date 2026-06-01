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
            {results.map((invite) => (
              <div className="invite-result" key={`${invite.email}-${invite.id}`}>
                <strong>{invite.email}</strong>
                <span>{invite.email_sent ? "Email sent" : invite.email_error || "Email not sent"}</span>
                {invite.invite_link && (
                  <button type="button" onClick={() => navigator.clipboard.writeText(invite.invite_link)}>
                    Copy invite link
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
