import { useState, useEffect, useRef } from "react";
import API from "../api";
import "../App.css";

export default function FloatingChatbot({ language, setChatItinerary }) {

  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null);

  const chatEndRef = useRef(null);

  /* ---------- Auto scroll ---------- */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------- Detect location when chatbot opens ---------- */
  useEffect(() => {
    if (open) detectLocation();
  }, [open]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        };
        console.log("Detected location:", loc);
        setCoords(loc);
      },
      (err) => {
        console.log(err);
        alert("Please allow location access for nearby results.");
      },
      { enableHighAccuracy: true }
    );
  };

  /* ---------- SEND MESSAGE ---------- */
  const sendMessage = async () => {
    if (!question.trim()) return;

    setMessages(prev => [...prev, { sender: "user", text: question }]);
    setLoading(true);

    try {
      const res = await API.post("/chatbot", {
        question,
        lat: coords?.lat,
        lon: coords?.lon,
        language
      });

      const reply = res.data.reply;
      setMessages(prev => [...prev, { sender: "bot", text: reply }]);

      if (setChatItinerary) setChatItinerary(reply);

    } catch {
      setMessages(prev => [...prev, { sender: "bot", text: "Server error." }]);
    }

    setQuestion("");
    setLoading(false);
  };

  /* ---------- NEARBY ---------- */
  const fetchNearby = async () => {

    if (!coords) {
      detectLocation();
      setMessages(prev => [
        ...prev,
        { sender: "bot", text: "Detecting your location... please try again." }
      ]);
      return;
    }

    setMessages(prev => [...prev, { sender: "user", text: "Show nearby places" }]);
    setLoading(true);

    try {
      const res = await API.post("/nearby", {
        lat: coords.lat,
        lon: coords.lon
      });

      const data = res.data;
      let text = "📍 Nearby Places\n";

      data.places?.forEach(p => text += `🏛 ${p.name} (${p.distance} km)\nhttps://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}\n`);
      data.hotels?.forEach(p => text += `🏨 ${p.name} (${p.distance} km)\nhttps://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}\n`);
      data.restaurants?.forEach(p => text += `🍴 ${p.name} (${p.distance} km)\nhttps://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}\n`);
      data.hospitals?.forEach(p => text += `🚑 ${p.name} (${p.distance} km)\nhttps://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}\n`);

      setMessages(prev => [...prev, { sender: "bot", text }]);

    } catch {
      setMessages(prev => [...prev, { sender: "bot", text: "Unable to fetch nearby places." }]);
    }

    setLoading(false);
  };

  /* ---------- EMERGENCY ---------- */
  const fetchEmergency = async () => {

    if (!coords) {
      detectLocation();
      setMessages(prev => [
        ...prev,
        { sender: "bot", text: "Detecting location... please try again." }
      ]);
      return;
    }

    setMessages(prev => [...prev, { sender: "user", text: "Find nearest hospital" }]);
    setLoading(true);

    try {
      const res = await API.post("/emergency", {
        lat: coords.lat,
        lon: coords.lon
      });

      const h = res.data;

      setMessages(prev => [...prev, {
        sender: "bot",
        text: `🚑 ${h.name}\nDistance: ${h.distance} km`
      }]);

    } catch {
      setMessages(prev => [...prev, { sender: "bot", text: "Unable to find hospital." }]);
    }

    setLoading(false);
  };

  const fetchIncidentPlan = async () => {
  if (!coords) {
    detectLocation();
    setMessages(prev => [...prev, { sender: "bot", text: "Detecting location..." }]);
    return;
  }

  setMessages(prev => [...prev, { sender: "user", text: "I had an accident. Generate new itinerary." }]);
  setLoading(true);

  try {
    const res = await API.post("/incident-itinerary", coords);
    setMessages(prev => [...prev, { sender: "bot", text: res.data.plan }]);
  } catch {
    setMessages(prev => [...prev, { sender: "bot", text: "Unable to generate new itinerary." }]);
  }

  setLoading(false);
};


  /* ---------- UI ---------- */
  /* ---------- UI ---------- */
return (
  <>
    <button className="chat-floating-btn" onClick={() => setOpen(!open)}>
      🤖
    </button>

    {open && (
      <div className="chat-floating-box">

        <div className="chat-header">
          Travel Assistant
          <button onClick={() => setOpen(false)}>✖</button>
        </div>

        <div className="chat-body">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.sender}`}>
              {m.text.split("\n").map((line, idx) =>
                line.startsWith("http") ? (
                  <a
                    key={idx}
                    href={line}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1e90ff" }}
                  >
                    Open in Maps
                  </a>
                ) : (
                  <div key={idx}>{line}</div>
                )
              )}
            </div>
          ))}

          {loading && <div className="bubble bot">Bot is typing...</div>}
          <div ref={chatEndRef}></div>
        </div>

        <div className="chat-actions">
          <button onClick={fetchNearby}>📍 Near Me</button>
          <button onClick={fetchEmergency}>🚑 Hospital</button>
          <button onClick={fetchIncidentPlan}>🚨 Incident</button>
        </div>

        <div className="chat-input">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask travel AI..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage}>Send</button>
        </div>

      </div>
    )}
  </>
);
}
