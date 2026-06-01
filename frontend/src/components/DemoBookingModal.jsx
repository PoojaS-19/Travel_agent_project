import { useState } from "react";
import API from "../api";

export default function DemoBookingModal({ open, onClose, train, from, to, date }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pnrResult, setPnrResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!name) return alert("Enter name");
    setLoading(true);
    try {
      const payload = {
        train_no: train.train_no || train.train_no || train.number || train.trainNumber,
        train_name: train.train_name || train.train_name || train.train_name || train.name || "",
        from_code: from,
        to_code: to,
        date,
        class_type: "SL",
        passengers: [{ name }],
        contact: { name, phone, email },
      };
      const res = await API.post("/demo-book", payload);
      setPnrResult(res.data.booking);
    } catch (err) {
      alert("Failed to create demo booking");
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>DEMO BOOKING (Not a real reservation)</h3>
        {!pnrResult ? (
          <>
            <div style={{ marginBottom: 8 }}>{train.train_no} — {train.train_name}</div>
            <input placeholder="Passenger name" value={name} onChange={(e) => setName(e.target.value)} />
            <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={submit} disabled={loading}>{loading ? "Booking..." : "Create Demo Booking"}</button>
              <button onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <div>
            <h4>Booking Created</h4>
            <div><strong>PNR:</strong> {pnrResult.pnr}</div>
            <div><strong>Train:</strong> {pnrResult.train_no} — {pnrResult.train_name}</div>
            <div><strong>From:</strong> {pnrResult.from_code} → <strong>To:</strong> {pnrResult.to_code}</div>
            <div><strong>Date:</strong> {pnrResult.date}</div>
            <div><strong>Status:</strong> {pnrResult.status}</div>

            <div style={{ marginTop: 12 }}>
              <button onClick={() => { navigator.clipboard?.writeText(pnrResult.pnr); alert("PNR copied"); }}>Copy PNR</button>
              <button onClick={() => { onClose(); setPnrResult(null); }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
