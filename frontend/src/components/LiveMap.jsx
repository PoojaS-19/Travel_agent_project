import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useLiveLocation } from "../hooks/useLiveLocation";
import { getArrivalStatus, calculateDistance } from "../utils/haversine";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Navigation } from "lucide-react";

const createAvatarIcon = (name, isOnline) => {
  const initials = name ? name.substring(0, 2).toUpperCase() : "??";
  const statusColor = isOnline ? "bg-green-500" : "bg-red-500";
  return L.divIcon({
    html: `<div class="relative w-10 h-10 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center text-white font-bold shadow-lg">
             ${initials}
             <div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusColor}"></div>
           </div>`,
    className: "custom-avatar-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const destIcon = L.divIcon({
  html: `<div class="w-12 h-12 bg-rose-600 rounded-full flex items-center justify-center text-white font-bold shadow-2xl border-4 border-white"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
  className: "custom-dest-icon",
  iconSize: [48, 48],
  iconAnchor: [24, 48],
});

function RecenterMap({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.setView([location.latitude, location.longitude], 14, { animate: true });
    }
  }, [location, map]);
  return null;
}

export default function LiveMap({ tripId, currentUser, tripMembers, destination }) {
  const [sharingEnabled, setSharingEnabled] = useState(true);
  const [etaData, setEtaData] = useState({});

  const { memberLocations, currentLocation, sosAlert, emitSos, isStationary } = useLiveLocation({
    tripId,
    userId: currentUser.id,
    enabled: sharingEnabled,
    destinationCoords: destination ? { lat: destination.lat, lng: destination.lng } : null,
    username: currentUser.username
  });

  // Fetch ETA for members periodically
  useEffect(() => {
    if (!destination || !destination.lat || !destination.lng) return;
    
    const fetchEtas = async () => {
      const newEtas = {};
      const token = localStorage.getItem("token");
      for (const memberId of Object.keys(memberLocations)) {
        const loc = memberLocations[memberId];
        try {
          const res = await fetch(\`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/location/eta/\${tripId}?lat=\${loc.latitude}&lng=\${loc.longitude}&destLat=\${destination.lat}&destLng=\${destination.lng}\`, {
            headers: { Authorization: \`Bearer \${token}\` }
          });
          if (res.ok) {
            const data = await res.json();
            newEtas[memberId] = data.duration.text;
          }
        } catch (e) {
          console.error("ETA fetch error", e);
        }
      }
      setEtaData(newEtas);
    };

    fetchEtas();
    const interval = setInterval(fetchEtas, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [memberLocations, destination, tripId]);

  return (
    <div className="flex flex-col md:flex-row w-full h-[600px] border border-white/10 rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
      
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-slate-900 border-r border-white/10 flex flex-col relative z-20">
        <div className="p-4 border-b border-white/10 bg-slate-800">
          <h2 className="text-lg font-bold text-white mb-2">Live Tracking</h2>
          {destination && (
            <div className="text-sm text-cyan-400 font-semibold flex items-center gap-2">
              <Navigation className="w-4 h-4" />
              {destination.name || "Destination"}
            </div>
          )}
          
          <div className="mt-4 flex items-center justify-between">
            <label className="text-sm text-white/80 font-medium flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={sharingEnabled} 
                onChange={(e) => setSharingEnabled(e.target.checked)}
                className="w-4 h-4 text-cyan-500 rounded border-white/20 bg-slate-800 focus:ring-cyan-500"
              />
              Share my location
            </label>
            {isStationary && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-bold">Battery Saver</span>}
          </div>

          <button 
            onClick={emitSos}
            className="w-full mt-4 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/50 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
          >
            <ShieldAlert className="w-5 h-5" /> SOS Alert
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tripMembers.map(member => {
            const isMe = member.id === currentUser.id;
            // Use local state for current user if tracking enabled to avoid WS roundtrip latency
            const loc = isMe && sharingEnabled && currentLocation 
              ? { ...currentLocation, lastSeen: Date.now() } 
              : memberLocations[member.id];
              
            const isOnline = loc && (Date.now() - loc.lastSeen < 30000);
            
            let distStr = "--";
            let arrivalStatus = "--";
            if (loc && destination) {
              const d = calculateDistance(loc.latitude, loc.longitude, destination.lat, destination.lng);
              distStr = `${d} km`;
              arrivalStatus = getArrivalStatus(d);
            }

            return (
              <div key={member.id} className="bg-slate-800 rounded-xl p-3 border border-white/5 flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
                    {member.username ? member.username.substring(0, 2).toUpperCase() : "??"}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-800 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold text-sm truncate">{member.username} {isMe && "(You)"}</span>
                    <span className="text-[10px] text-white/50">{loc ? 'Online' : 'Offline'}</span>
                  </div>
                  <div className="text-xs text-white/60 mt-1 flex justify-between">
                    <span>{arrivalStatus}</span>
                    {etaData[member.id] && <span className="text-cyan-400">ETA: {etaData[member.id]}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-slate-950 z-10">
        {sosAlert && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-600 text-white px-6 py-3 rounded-full shadow-[0_0_30px_rgba(220,38,38,0.8)] font-black flex items-center gap-3 animate-pulse">
            <ShieldAlert className="w-6 h-6" />
            SOS ALERT FROM {sosAlert.name}!
          </div>
        )}

        <MapContainer 
          center={currentLocation ? [currentLocation.latitude, currentLocation.longitude] : (destination ? [destination.lat, destination.lng] : [20, 77])} 
          zoom={13} 
          className="w-full h-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          {currentLocation && sharingEnabled && <RecenterMap location={currentLocation} />}

          {/* Render Members */}
          {Object.entries(memberLocations).map(([id, loc]) => {
            const member = tripMembers.find(m => m.id.toString() === id);
            if (!member) return null;
            const isOnline = Date.now() - loc.lastSeen < 30000;
            const d = destination ? calculateDistance(loc.latitude, loc.longitude, destination.lat, destination.lng) : null;
            
            return (
              <Marker key={id} position={[loc.latitude, loc.longitude]} icon={createAvatarIcon(member.username, isOnline)}>
                <Popup className="custom-dark-popup">
                  <div className="font-bold text-sm text-slate-800">{member.username}</div>
                  <div className="text-xs text-slate-500 mt-1">Status: {getArrivalStatus(d)}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Last updated: {Math.floor((Date.now() - loc.lastSeen)/1000)}s ago</div>
                </Popup>
              </Marker>
            );
          })}

          {/* Current User Fallback (if they haven't emitted yet but have local watchPosition) */}
          {currentLocation && sharingEnabled && !memberLocations[currentUser.id] && (
            <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={createAvatarIcon(currentUser.username, true)}>
              <Popup>
                <div className="font-bold text-sm">You</div>
              </Popup>
            </Marker>
          )}

          {/* Destination */}
          {destination && destination.lat && destination.lng && (
            <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
              <Popup>
                <div className="font-bold">{destination.name || "Destination"}</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
