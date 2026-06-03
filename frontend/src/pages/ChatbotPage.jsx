import { useState, useEffect } from "react";
import API from "../api";
import "../App.css";

export default function ChatbotPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  /* -------- GET LOCATION ONCE (NO ERROR MESSAGE) -------- */
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("Latitude:", pos.coords.latitude);
      },
      () => {
        // DO NOTHING if permission denied
      }
    );
  }, []);

  /* -------- SEND MESSAGE -------- */
  const sendMessage = async () => {
    if (!question.trim()) return;

    const userMsg = { sender: "user", text: question };
    setMessages((prev) => [...prev, userMsg]);

    setLoading(true);

    try {
      const res = await API.post("/chatbot", { question });
      const botMsg = {
        sender: "bot",
        text: res.data.reply || "No response",
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Unable to connect to chatbot." },
      ]);
    }

    setQuestion("");
    setLoading(false);
  };

  return (
    <div className="chatbot-fullpage">

      {/* HEADER */}
      <div className="assistant-header">
        <span className="assistant-icon">🤖</span>
        <h2>TripAI Travel Assistant</h2>
      </div>

      {/* CHAT AREA */}
      <div className="chat-area">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`bubble ${msg.sender === "user" ? "user" : "bot"}`}
          >
            {msg.text}
          </div>
        ))}

        {loading && <div className="bubble bot">Typing...</div>}
      </div>

      {/* INPUT */}
      <div className="chat-input-area">
        <textarea
          placeholder="Ask anything about travel..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button onClick={sendMessage}>
          {loading ? "Sending..." : "Send"}
        </button>
      </div>

    </div>
  );
}
