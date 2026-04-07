import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";
import "../App.css";

export default function FloatingChatbot({ language, setChatItinerary, setChatDailyPlans }) {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState(null);
  
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  /* ---------- Auto scroll ---------- */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------- Speech Recognition Setup ---------- */
  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language === "English" ? "en-US" : (language === "Hindi" ? "hi-IN" : "mr-IN");

      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setQuestion((prev) => prev + " " + finalTranscript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [language]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Your browser does not support Speech Recognition. Try Chrome or Edge!");
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  /* ---------- Detect location when chatbot opens ---------- */
  useEffect(() => {
    if (open) detectLocation();
  }, [open]);

  const detectLocation = () => {
    // Default to Pune coordinates if location fails or is denied
    const fallbackCoords = { lat: 18.5204, lon: 73.8567 };

    if (!navigator.geolocation) {
      setCoords(fallbackCoords);
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
        console.log(err, "Falling back to default coords.");
        setCoords(fallbackCoords);
      },
      { enableHighAccuracy: true }
    );
  };

  /* ---------- SEND MESSAGE (STREAMING) ---------- */
  const sendMessage = async (overrideText) => {
    const userText = typeof overrideText === 'string' ? overrideText : question;
    if (!userText.trim() || loading) return;

    setQuestion("");
    
    // Add user message to state
    const newUserMsg = { sender: "user", text: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    // Prepare history (last 10 messages)
    const history = messages.slice(-10);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("http://127.0.0.1:8000/chatbot-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userText,
          lat: coords?.lat,
          lon: coords?.lon,
          language,
          history
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error("Network error");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      
      // Add empty bot message that we will stream into
      setMessages(prev => [...prev, { sender: "bot", text: "", planData: null, optionsData: null }]);

      let isPlan = false;
      let isOptions = false;
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE lines
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                fullResponse += "\n[Error: " + data.error + "]";
              } else if (data.text) {
                fullResponse += data.text;
                
                // Update the last message with the current streamed text
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastMsg = newMsgs[newMsgs.length - 1];
                  
                  // Clean any system tags from the response
                  let cleanText = fullResponse
                    .replace(/\[CHAT\]/g, '')
                    .replace(/\[INFO\]/g, '')
                    .replace(/\[PLAN\]/g, '')
                    .replace(/\[OPTIONS\]/g, '');

                  // If we see ---JSON_START---, it means the rest is JSON
                  if (cleanText.includes("---JSON_START---")) {
                    isPlan = true;
                    // Just show the text before JSON_START while streaming
                    lastMsg.text = cleanText.split("---JSON_START---")[0].trim();
                  } else if (cleanText.includes("---OPTIONS_START---")) {
                    isOptions = true;
                    lastMsg.text = cleanText.split("---OPTIONS_START---")[0].trim();
                  } else {
                    lastMsg.text = cleanText.trimStart();
                  }
                  
                  return newMsgs;
                });
              } else if (data.done) {
                // Done streaming
                if (isPlan) {
                  // Extract JSON
                  try {
                    const jsonPart = fullResponse.split("---JSON_START---")[1].split("---JSON_END---")[0];
                    const planData = JSON.parse(jsonPart.trim());
                    
                    setMessages(prev => {
                      const newMsgs = [...prev];
                      newMsgs[newMsgs.length - 1].planData = planData;
                      return newMsgs;
                    });

                    if (setChatItinerary) setChatItinerary(fullResponse.split("---JSON_START---")[0]);
                    if (setChatDailyPlans && planData.daily_plans) {
                       setChatDailyPlans(planData.daily_plans);
                    }
                  } catch (e) {
                    console.error("Failed to parse plan JSON", e);
                  }
                } else if (isOptions) {
                  try {
                    const jsonPart = fullResponse.split("---OPTIONS_START---")[1].split("---OPTIONS_END---")[0];
                    const optionsData = JSON.parse(jsonPart.trim());
                    
                    setMessages(prev => {
                      const newMsgs = [...prev];
                      newMsgs[newMsgs.length - 1].optionsData = optionsData;
                      return newMsgs;
                    });
                  } catch (e) {
                    console.error("Failed to parse options JSON", e);
                  }
                } else {
                  let finalClean = fullResponse
                    .replace(/\[CHAT\]/g, '')
                    .replace(/\[INFO\]/g, '')
                    .replace(/\[PLAN\]/g, '')
                    .replace(/\[OPTIONS\]/g, '')
                    .trim();
                  // We removed setChatItinerary(finalClean) here so standard chat messages don't bleed onto the main UI board.
                }
              }
            } catch (e) {
              console.error("Error parsing SSE data line", line, e);
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log("Chat aborted");
      } else {
        setMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs[newMsgs.length - 1].sender === "bot" && newMsgs[newMsgs.length - 1].text === "") {
             newMsgs[newMsgs.length - 1].text = "Server error.";
          }
           return newMsgs;
        });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
    }
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

        <div className="chat-body simple-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`bubble-adv bubble ${m.sender}`}>
              <div className="bubble-content">
                {/* Regular text */}
                {m.text && m.text.split("\n").map((line, idx) =>
                  line.startsWith("http") ? (
                    <a
                      key={idx}
                      href={line}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#1e90ff", display: "block", marginTop: "4px" }}
                    >
                      Open in Maps
                    </a>
                  ) : (
                    <div key={idx}>{line}</div>
                  )
                )}
                
                {/* Plan Card (if available) */}
                {m.planData && (
                  <div className="chatbot-plan-card">
                    <h4>{m.planData.destination} Trip</h4>
                    <span className="plan-days">{m.planData.days} Days</span>
                    
                    <div className="mini-timeline">
                      {m.planData.daily_plans?.map((dp, dpi) => (
                         <div key={dpi} className="mini-day">
                           <strong>Day {dp.day}</strong>
                           <div className="mini-activities">
                             {dp.activities?.slice(0, 3).map((act, ai) => (
                               <div key={ai} className="mini-activity">
                                 <span>{act.time}</span> - {act.place_name}
                               </div>
                             ))}
                             {dp.activities?.length > 3 && (
                               <div className="mini-activity more">
                                 + {dp.activities.length - 3} more activities
                               </div>
                             )}
                           </div>
                         </div>
                      ))}
                    </div>
                    
                    <button 
                      className="view-full-plan-btn"
                      onClick={() => navigate('/itinerary')}
                    >
                      View Full Plan →
                    </button>
                  </div>
                )}
                
                {/* Options Card (if available) */}
                {m.optionsData && (
                  <div className="chatbot-options-container">
                    <h4>Select a Trip Option:</h4>
                    {m.optionsData.map((opt, oi) => (
                      <div key={oi} className="chatbot-option-card">
                        <h5>{opt.title}</h5>
                        <p className="opt-duration">{opt.duration}</p>
                        <p>{opt.description}</p>
                        <button 
                          className="select-plan-btn"
                          onClick={() => sendMessage(`I select option ${opt.id}: ${opt.title}`)}>
                          Select this plan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && messages.length > 0 && messages[messages.length - 1].sender === "user" && (
            <div className="bubble bot">Typing...</div>
          )}
          <div ref={chatEndRef}></div>
        </div>

        <div className="chat-actions">
          <button onClick={fetchNearby}>📍 Near Me</button>
          <button onClick={fetchEmergency}>🚑 Hospital</button>
          <button onClick={fetchIncidentPlan}>🚨 Incident</button>
        </div>

        <div className="quick-replies">
          <button onClick={() => sendMessage("Beach")}>⛱️ Beach</button>
          <button onClick={() => sendMessage("Hill")}>⛰️ Hill</button>
          <button onClick={() => sendMessage("Adventure")}>🧗 Adventure</button>
        </div>

        <div className="chat-input-area-adv">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask travel AI..."}
            onKeyDown={(e) => {
              if(e.key === "Enter" && !loading) sendMessage();
            }}
            disabled={loading}
          />
          <button 
            className={`mic-btn ${isListening ? 'listening_pulse' : ''}`} 
            onClick={toggleListening}
            title={isListening ? "Stop listening" : "Start Voice Input"}
            style={{
               background: isListening ? '#ef4444' : '#f1f5f9',
               color: isListening ? '#fff' : '#64748b',
               border: 'none',
               borderRadius: '50%',
               width: '36px',
               height: '36px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               cursor: 'pointer',
               marginRight: '8px',
               transition: 'background 0.3s'
            }}
          >
            🎤
          </button>
          
          {loading ? (
             <button className="send-btn-adv stop-btn" onClick={stopGeneration} title="Stop Generate">
                <span className="stop-icon">⬛</span>
             </button>
          ) : (
             <button className="send-btn-adv" onClick={() => sendMessage()}>
               ➤
             </button>
          )}
        </div>

      </div>
    )}
  </>
);
}
