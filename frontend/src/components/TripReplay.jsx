import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Play, Pause, FastForward } from "lucide-react";

const replayIcon = L.divIcon({
  html: `<div class="w-4 h-4 bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.8)] border-2 border-white"></div>`,
  className: "custom-replay-icon",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [50, 50] });
    }
  }, [positions, map]);
  return null;
}

export default function TripReplay({ tripId, memberId, memberName }) {
  const [history, setHistory] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(\`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/location/history/\${tripId}/\${memberId}\`, {
            headers: { Authorization: \`Bearer \${token}\` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              setHistory(data);
            }
        }
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [tripId, memberId]);

  useEffect(() => {
    if (isPlaying && history.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= history.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 500 / speed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, history, speed]);

  const positions = history.map(h => [h.latitude, h.longitude]);

  if (loading) return <div className="text-white text-center py-10">Loading history...</div>;
  if (history.length === 0) return <div className="text-white/50 text-center py-10">No location history found for {memberName}.</div>;

  const currentLocation = history[currentIndex];

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between bg-slate-900 border border-white/10 p-4 rounded-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
                if (currentIndex >= history.length - 1) setCurrentIndex(0);
                setIsPlaying(!isPlaying);
            }}
            className="w-10 h-10 rounded-full bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center text-slate-900 transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
          </button>
          
          <div className="flex bg-slate-800 rounded-lg p-1 border border-white/10">
            {[1, 2, 5].map(s => (
              <button 
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${speed === s ? 'bg-cyan-500 text-slate-900' : 'text-white/50 hover:text-white'}`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-white font-bold">{memberName}'s Route</div>
          <div className="text-xs text-cyan-400">{new Date(currentLocation.timestamp).toLocaleString()}</div>
        </div>
      </div>
      
      <div className="w-full h-[500px] rounded-xl overflow-hidden shadow-2xl relative z-10 border border-white/10">
        <MapContainer center={positions[0]} zoom={13} className="w-full h-full">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap'
          />
          <FitBounds positions={positions} />
          
          <Polyline positions={positions.slice(0, currentIndex + 1)} pathOptions={{ color: '#06b6d4', weight: 4, opacity: 0.8 }} />
          
          {currentLocation && (
            <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={replayIcon}>
              <Popup className="custom-dark-popup">
                <div className="text-xs font-bold">{new Date(currentLocation.timestamp).toLocaleTimeString()}</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className="h-full bg-cyan-500 transition-all duration-300"
          style={{ width: \`\${(currentIndex / (history.length - 1)) * 100}%\` }}
        />
      </div>
    </div>
  );
}
