import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API, { API_BASE_URL } from "../api";
import "../App.css";
import { 
  MessageSquare, Send, Mic, MapPin, ShieldAlert, Sparkles, X, 
  Phone, RefreshCw, AlertCircle, Compass, Square, Power, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    
    const newUserMsg = { sender: "user", text: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    const history = messages.slice(-10);

    abortControllerRef.current = new AbortController();

    try {
      const headers = { "Content-Type": "application/json" };
      const token = localStorage.getItem("token");
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/chatbot-stream`, {
        method: "POST",
        headers,
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
      
      setMessages(prev => [...prev, { sender: "bot", text: "", planData: null, optionsData: null }]);

      let isPlan = false;
      let isOptions = false;
      let isEmergency = false;
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                fullResponse += "\n[Error: " + data.error + "]";
              } else if (data.text) {
                fullResponse += data.text;
                
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastMsg = newMsgs[newMsgs.length - 1];
                  
                  let cleanText = fullResponse
                    .replace(/\[CHAT\]/g, '')
                    .replace(/\[INFO\]/g, '')
                    .replace(/\[PLAN\]/g, '')
                    .replace(/\[OPTIONS\]/g, '')
                    .replace(/\[EMERGENCY\]/g, '');

                  if (cleanText.includes("---JSON_START---")) {
                    isPlan = true;
                    lastMsg.text = cleanText.split("---JSON_START---")[0].trim();
                  } else if (cleanText.includes("---OPTIONS_START---")) {
                    isOptions = true;
                    lastMsg.text = cleanText.split("---OPTIONS_START---")[0].trim();
                  } else if (cleanText.includes("---EMERGENCY_START---")) {
                    isEmergency = true;
                    lastMsg.text = cleanText.split("---EMERGENCY_START---")[0].trim();
                  } else {
                    lastMsg.text = cleanText.trimStart();
                  }
                  
                  return newMsgs;
                });
              } else if (data.done) {
                if (isPlan) {
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
                } else if (isEmergency) {
                  try {
                    const jsonPart = fullResponse.split("---EMERGENCY_START---")[1].split("---EMERGENCY_END---")[0];
                    const emergencyData = JSON.parse(jsonPart.trim());
                    
                    setMessages(prev => {
                      const newMsgs = [...prev];
                      newMsgs[newMsgs.length - 1].emergencyData = emergencyData;
                      return newMsgs;
                    });
                  } catch (e) {
                    console.error("Failed to parse emergency JSON", e);
                  }
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

      if (res.data.error) {
         setMessages(prev => [...prev, { sender: "bot", text: res.data.error }]);
      } else {
         const hospitals = res.data.hospitals;
         let text = "🏥 Nearest Hospitals:\n\n";
         hospitals.forEach(h => {
             text += `🚑 ${h.name}\n📏 Distance: ${h.distance} km\n📍 ${h.address}\n\n`;
         });
         setMessages(prev => [...prev, {
           sender: "bot",
           text: text.trim()
         }]);
      }
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

    let destination = "your destination";
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].planData && messages[i].planData.destination) {
        destination = messages[i].planData.destination;
        break;
      }
    }

    try {
      const res = await API.post("/incident-itinerary", { ...coords, destination });
      const data = res.data;

      if (data.daily_plans && data.daily_plans.length > 0) {
         setMessages(prev => [...prev, { 
             sender: "bot", 
             text: data.itinerary_text || "Itinerary replanned.",
             planData: { destination: destination, days: data.daily_plans.length, daily_plans: data.daily_plans } 
         }]);
         if (setChatItinerary) setChatItinerary(data.itinerary_text || "Itinerary replanned.");
         if (setChatDailyPlans) setChatDailyPlans(data.daily_plans);
      } else {
         setMessages(prev => [...prev, { sender: "bot", text: data.itinerary_text || data.plan || "Unable to generate plan." }]);
      }
    } catch {
      setMessages(prev => [...prev, { sender: "bot", text: "Unable to generate new itinerary." }]);
    }

    setLoading(false);
  };

  return (
    <>
      {/* FLOATING TRIGGER BUTTON */}
      <button 
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-gradient-to-tr from-brand-secondary to-blue-500 hover:from-blue-600 hover:to-brand-secondary rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-105 transition-all focus:outline-none"
        onClick={() => setOpen(!open)}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* CHATBOX WINDOW OVERLAY */}
      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="fixed bottom-24 right-6 w-[360px] md:w-[400px] h-[550px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-[9999] overflow-hidden"
          >
            {/* HEADER */}
            <div className="px-5 py-4 bg-gradient-to-r from-brand-primary to-brand-secondary flex justify-between items-center text-white font-bold">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-accent animate-pulse" />
                <span className="text-sm tracking-wide text-white">AI Travel Assistant</span>
              </div>
              <button 
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MESSAGE BODY LIST */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-slate-50">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-3">
                  <div className="w-12 h-12 bg-brand-secondary/10 border border-brand-secondary/20 rounded-xl flex items-center justify-center text-brand-secondary">
                    <Compass className="w-6 h-6 animate-spin-slow" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Start Planning Your Journey</h4>
                  <p className="text-xs text-slate-500">Ask about weather, hotels, budget trips, or select a category below to search nearby attractions.</p>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.sender === "user" ? "bg-brand-secondary text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm"}`}>
                    {m.text && m.text.split("\n").map((line, idx) =>
                      line.startsWith("http") ? (
                        <a
                          key={idx}
                          href={line}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${m.sender === "user" ? "text-blue-100 hover:text-white" : "text-brand-secondary hover:text-blue-700"} hover:underline block font-semibold mt-1`}
                        >
                          🗺️ View Google Maps route
                        </a>
                      ) : (
                        <div key={idx}>{line}</div>
                      )
                    )}

                    {/* Plan Details Card */}
                    {m.planData && (
                      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-inner">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-brand-primary text-xs">{m.planData.destination} Trip</h4>
                          <span className="text-[10px] px-2 py-0.5 bg-brand-secondary/10 border border-brand-secondary/30 rounded-full text-brand-secondary font-semibold">{m.planData.days} Days</span>
                        </div>
                        
                        <div className="space-y-2 border-t border-slate-200 pt-3">
                          {m.planData.daily_plans?.slice(0, 3).map((dp, dpi) => (
                             <div key={dpi} className="text-xs space-y-0.5">
                               <span className="font-bold text-slate-500">Day {dp.day}</span>
                               <div className="space-y-0.5 pl-2">
                                 {dp.activities?.slice(0, 2).map((act, ai) => (
                                   <div key={ai} className="text-[11px] text-slate-600 line-clamp-1">
                                     • {act.time && `${act.time} - `}{act.place_name}
                                   </div>
                                 ))}
                               </div>
                             </div>
                          ))}
                          {m.planData.daily_plans?.length > 3 && (
                             <p className="text-[10px] text-slate-505 font-medium">+ {m.planData.daily_plans.length - 3} more days planning available</p>
                          )}
                        </div>
                        
                        <button 
                          onClick={() => {
                            setOpen(false);
                            navigate('/itinerary');
                          }}
                          className="w-full mt-2 py-2 bg-brand-secondary hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Complete Itinerary
                        </button>
                      </div>
                    )}

                    {/* Options Selection Container */}
                    {m.optionsData && (
                      <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
                        <h5 className="font-bold text-xs text-slate-500">Select trip category:</h5>
                        {m.optionsData.map((opt, oi) => (
                          <div key={oi} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <h6 className="font-bold text-brand-primary text-xs">{opt.title}</h6>
                              <span className="text-[10px] text-brand-secondary font-semibold">{opt.duration}</span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-normal">{opt.description}</p>
                            <button 
                              onClick={() => sendMessage(`I select option ${opt.id}: ${opt.title}`)}
                              className="w-full mt-1 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-brand-secondary rounded-lg text-xs font-bold transition-all shadow-sm"
                            >
                              Choose Option
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Emergency Alert Card */}
                    {m.emergencyData && (
                      <div className="mt-4 bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-1.5 text-rose-600 font-bold text-xs">
                          <ShieldAlert className="w-4 h-4" />
                          <span>EMERGENCY ASSISTANT</span>
                        </div>
                        <p className="text-[11px] text-slate-700 leading-normal">{m.emergencyData.recommended_action}</p>
                        
                        <div className="space-y-1.5 border-t border-rose-100 pt-3">
                          {m.emergencyData.numbers?.map((num, ni) => (
                            <a 
                              key={ni} 
                              href={`tel:${num.split(' ')[0]}`} 
                              className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Phone className="w-3.5 h-3.5 text-rose-600" />
                              Call {num}
                            </a>
                          ))}
                          <button 
                            onClick={fetchEmergency}
                            className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/10"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            Find Nearest Hospital
                          </button>
                          <button 
                            onClick={fetchIncidentPlan}
                            className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-brand-secondary" />
                            Re-plan Trip Routes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && messages.length > 0 && messages[messages.length - 1].sender === "user" && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-slate-500 font-semibold flex items-center gap-1.5 shadow-sm">
                    <div className="w-3 h-3 border border-brand-secondary border-t-transparent rounded-full animate-spin" />
                    <span>AI Assistant typing...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* ACTION TRIGGERS BAR */}
            <div className="px-3 py-2 border-t border-slate-200 flex gap-1.5 overflow-x-auto shrink-0 bg-slate-50">
              <button 
                onClick={fetchNearby}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:text-brand-primary transition-all whitespace-nowrap shrink-0 shadow-sm"
              >
                <MapPin className="w-3.5 h-3.5 text-brand-secondary" />
                Near Me
              </button>
              <button 
                onClick={fetchEmergency}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:text-brand-primary transition-all whitespace-nowrap shrink-0 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5 text-rose-600" />
                Emergency
              </button>
              <button 
                onClick={fetchIncidentPlan}
                className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:text-brand-primary transition-all whitespace-nowrap shrink-0 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5 text-brand-secondary" />
                Incident Re-route
              </button>
            </div>

            {/* QUICK PRE-SET BADGES */}
            <div className="px-3 py-1.5 border-t border-slate-200 flex gap-2 shrink-0 bg-slate-50/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 self-center">Quick tags:</span>
              <button 
                onClick={() => sendMessage("Beach")}
                className="text-[11px] font-bold px-2.5 py-1 bg-brand-secondary/5 hover:bg-brand-secondary/15 border border-brand-secondary/20 rounded-lg text-brand-secondary transition-colors"
              >
                ⛱️ Beach
              </button>
              <button 
                onClick={() => sendMessage("Hill")}
                className="text-[11px] font-bold px-2.5 py-1 bg-brand-secondary/5 hover:bg-brand-secondary/15 border border-brand-secondary/20 rounded-lg text-brand-secondary transition-colors"
              >
                ⛰️ Hill
              </button>
              <button 
                onClick={() => sendMessage("Adventure")}
                className="text-[11px] font-bold px-2.5 py-1 bg-brand-secondary/5 hover:bg-brand-secondary/15 border border-brand-secondary/20 rounded-lg text-brand-secondary transition-colors"
              >
                🧗 Adventure
              </button>
            </div>

            {/* CHAT INPUT AREA */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={isListening ? "Listening..." : "Ask travel AI..."}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) sendMessage();
                }}
                disabled={loading}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none placeholder-slate-400 focus:ring-1 focus:ring-brand-secondary focus:border-brand-secondary text-slate-800"
              />
              
              <button 
                className={`p-2 rounded-full border transition-all flex items-center justify-center shrink-0 ${isListening ? 'bg-red-500 border-red-500 animate-pulse text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-brand-primary hover:bg-slate-100'}`} 
                onClick={toggleListening}
                title={isListening ? "Stop listening" : "Start Voice Input"}
              >
                <Mic className="w-4 h-4" />
              </button>
              
              {loading ? (
                 <button 
                   className="p-2 bg-brand-secondary hover:bg-blue-600 border border-brand-secondary text-white rounded-full transition-colors flex items-center justify-center shrink-0" 
                   onClick={stopGeneration} 
                   title="Stop generating"
                 >
                    <Square className="w-4 h-4 fill-white" />
                 </button>
              ) : (
                 <button 
                   className="p-2 bg-brand-secondary hover:bg-blue-600 border border-brand-secondary text-white rounded-full transition-colors flex items-center justify-center shrink-0" 
                   onClick={() => sendMessage()}
                 >
                   <Send className="w-4 h-4" />
                 </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
