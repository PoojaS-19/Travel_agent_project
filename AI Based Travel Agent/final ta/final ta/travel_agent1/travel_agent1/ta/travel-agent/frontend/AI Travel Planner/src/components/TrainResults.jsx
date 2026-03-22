import { useState } from "react";
import API from "../api";
import DemoBookingModal from "./DemoBookingModal";

export default function TrainResults({ trains = [], from, to, date }) {
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // try to normalize train list
  const list = Array.isArray(trains) ? trains : (trains?.trains || []);

  return (
    <div>
      <h3>Results</h3>
      {list.length === 0 && <div>No trains found.</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {list.map((t, i) => {
          // t may have different shapes depending on provider
          const train_no = t.train_no || t.number || t.trainNumber || t.trainNo || t.code || "";
          const train_name = t.train_name || t.name || t.title || t.trainName || "";
          const dep = t.departure || t.src_departure || t.depart || t.departure_time || t.dep_time || "";
          const arr = t.arrival || t.dest_arrival || t.arrive || t.arrival_time || t.arr_time || "";

          return (
            <div key={i} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{train_no} — {train_name}</div>
                <div style={{ color: "#444" }}>{dep} → {arr} • {t.duration || t.travel_time || t.duration_time || ""}</div>
                <div style={{ fontSize: 13, color: "#666" }}>{t.from || from} → {t.to || to} • {date}</div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setSelected({ train_no, train_name, dep, arr }); setShowModal(true); }}>
                  Demo Book
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && selected && (
        <DemoBookingModal
          open={showModal}
          onClose={() => setShowModal(false)}
          train={selected}
          from={from} to={to} date={date}
        />
      )}
    </div>
  );
}
