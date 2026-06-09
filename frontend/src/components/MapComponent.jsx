import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { antPath } from "leaflet-ant-path";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { motion, AnimatePresence } from "framer-motion";

// Fix for default marker icon missing in React-Leaflet
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Define a palette for different days to have different colored routes
const DAY_COLORS = [
    "#3b82f6", "#8b5cf6", "#ef4444", "#10b981", "#f59e0b", "#ec4899", "#14b8a6",
];

// Helper to create a numbered marker div icon
const createNumberedIcon = (number, color) => {
    const html = `
        <div style="
            background-color: ${color};
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            border: 3px solid white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            font-family: 'Inter', sans-serif;
            transition: all 0.2s ease;
        ">
            ${number}
        </div>
    `;
    return L.divIcon({
        className: 'custom-numbered-marker',
        html: html,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
    });
};

// Custom Animated Route Component
function AnimatedRoute({ positions, color, isMasterMap }) {
    const map = useMap();
    useEffect(() => {
        if (!positions || positions.length < 2) return;
        
        const path = antPath(positions, {
            color: color,
            pulseColor: "#FFFFFF",
            delay: isMasterMap ? 600 : 400,
            dashArray: [10, 20],
            weight: isMasterMap ? 4 : 5,
            opacity: 0.8,
            hardwareAccelerated: true,
            paused: false,
            reverse: false
        });
        
        path.addTo(map);
        
        return () => {
            if (map && path) {
                map.removeLayer(path);
            }
        };
    }, [map, positions, color, isMasterMap]);
    return null;
}

const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

// GPS Tracking and Map Controller
function NavigationTracker({ isNavigating, routePolyline, onUpdateStats, onUpdateProgressIndex, activities }) {
    const map = useMap();
    const [position, setPosition] = useState(null);
    const [heading, setHeading] = useState(0);
    const lastSpokenIndex = useRef(-1);

    useEffect(() => {
        if (!isNavigating) return;

        let watchId = navigator.geolocation.watchPosition((pos) => {
            const { latitude, longitude, speed, heading: gpsHeading } = pos.coords;
            setPosition([latitude, longitude]);
            
            let currentHeading = heading;
            if (gpsHeading !== null && !isNaN(gpsHeading)) {
                currentHeading = gpsHeading;
                setHeading(gpsHeading);
            }
            
            // Pan Map dynamically tracking the car
            map.setView([latitude, longitude], 17, { animate: true, duration: 1 });

            if (routePolyline && routePolyline.length > 0) {
                // Find closest point on route
                let minDistance = Infinity;
                let closestIndex = 0;
                
                routePolyline.forEach((point, idx) => {
                    const dist = getDistance(latitude, longitude, point[0], point[1]);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestIndex = idx;
                    }
                });

                if (onUpdateProgressIndex) {
                    onUpdateProgressIndex(closestIndex);
                }

                let isDeviated = false;
                if (minDistance > 100) {
                    isDeviated = true;
                }

                // Compute progress percentage
                const progress = Math.min(100, Math.max(0, Math.round((closestIndex / routePolyline.length) * 100)));
                
                // Estimate distance remaining
                let distanceRemainingMeters = 0;
                for (let i = closestIndex; i < routePolyline.length - 1; i++) {
                    distanceRemainingMeters += getDistance(routePolyline[i][0], routePolyline[i][1], routePolyline[i+1][0], routePolyline[i+1][1]);
                }

                const distFormatted = distanceRemainingMeters > 1000 
                    ? (distanceRemainingMeters/1000).toFixed(1) + " km"
                    : Math.round(distanceRemainingMeters) + " m";

                const currentSpeedKmH = speed ? Math.round(speed * 3.6) : 0;
                
                // ETA calculation based on real speed, defaulting to avg speed if stopped
                let etaFormatted = "--";
                const calcSpeed = currentSpeedKmH > 5 ? currentSpeedKmH : 40; 
                const hoursLeft = (distanceRemainingMeters / 1000) / calcSpeed;
                const minsLeft = Math.round(hoursLeft * 60);
                etaFormatted = minsLeft > 60 ? `${Math.floor(minsLeft/60)}h ${minsLeft%60}m` : `${minsLeft} min`;

                // Find next upcoming activity
                let nextAct = null;
                if (activities) {
                    for (let act of activities) {
                        const actDist = getDistance(latitude, longitude, parseFloat(act.lat), parseFloat(act.lon));
                        if (actDist > 50 && actDist < 5000) { 
                            nextAct = act;
                            break;
                        }
                    }
                }

                let instruction = nextAct ? `Upcoming: ${nextAct.place_name}` : "Continue on route";
                if (isDeviated) {
                    instruction = "⚠️ Rerouting... You have left the path!";
                }

                // Voice Navigation trigger
                if (nextAct && !isDeviated) {
                    const actIdx = activities.indexOf(nextAct);
                    const actDist = getDistance(latitude, longitude, parseFloat(nextAct.lat), parseFloat(nextAct.lon));
                    if (actDist < 500 && lastSpokenIndex.current !== actIdx) {
                        const utterance = new SpeechSynthesisUtterance(`In 500 meters, you will arrive at ${nextAct.place_name}`);
                        window.speechSynthesis.speak(utterance);
                        lastSpokenIndex.current = actIdx;
                    }
                } else if (isDeviated && lastSpokenIndex.current !== -999) {
                    window.speechSynthesis.speak(new SpeechSynthesisUtterance("You are off route. Recalculating."));
                    lastSpokenIndex.current = -999;
                }

                onUpdateStats({
                    distanceRemaining: distFormatted,
                    eta: etaFormatted,
                    speed: currentSpeedKmH,
                    progress: progress,
                    nextInstruction: instruction
                });
            }
        }, (err) => {
            console.error("GPS Error:", err);
        }, { enableHighAccuracy: true });

        return () => navigator.geolocation.clearWatch(watchId);
    }, [isNavigating, map, routePolyline, activities]);

    if (!isNavigating || !position) return null;

    const carHtml = `
        <div style="transform: rotate(${heading}deg); transition: transform 0.5s linear; font-size: 32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.5)); display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; margin-left: -5px; margin-top: -5px;">
            🚘
        </div>
    `;
    
    const carIcon = L.divIcon({
        html: carHtml,
        className: 'moving-car-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    return <Marker position={position} icon={carIcon} zIndexOffset={1000} />;
}

export default function MapComponent({ activities, allDailyPlans, routePolyline }) {
    const [isNavigating, setIsNavigating] = useState(false);
    const [progressIndex, setProgressIndex] = useState(0);
    const [navStats, setNavStats] = useState({
        distanceRemaining: "0 km",
        eta: "--",
        speed: 0,
        progress: 0,
        nextInstruction: "Acquiring GPS Signal..."
    });

    if ((!activities || activities.length === 0) && (!allDailyPlans || allDailyPlans.length === 0)) return null;

    let mapData = []; 
    let isMasterMap = false;
    let allActivitiesList = [];

    if (allDailyPlans && allDailyPlans.length > 0) {
        isMasterMap = true;
        mapData = allDailyPlans.map((plan, index) => {
            const validActs = plan.activities.filter(act => act.lat && act.lon && !isNaN(act.lat) && !isNaN(act.lon));
            allActivitiesList.push(...validActs);
            return {
                dayInfo: `Day ${plan.day}`,
                color: DAY_COLORS[index % DAY_COLORS.length],
                activities: validActs
            }
        }).filter(block => block.activities.length > 0);
    } else if (activities) {
        const validActs = activities.filter(act => act.lat && act.lon && !isNaN(act.lat) && !isNaN(act.lon));
        allActivitiesList.push(...validActs);
        if (validActs.length > 0) {
            mapData = [{
                dayInfo: "Today",
                color: DAY_COLORS[0],
                activities: validActs
            }];
        }
    }

    if (mapData.length === 0) return <p className="text-slate-500 italic p-4 text-center">No valid coordinates found to display the map.</p>;

    let allLats = [];
    let allLons = [];
    
    if (routePolyline && routePolyline.length > 0) {
        routePolyline.forEach(point => {
            allLats.push(parseFloat(point[0]));
            allLons.push(parseFloat(point[1]));
        });
    }

    mapData.forEach(block => {
        block.activities.forEach(act => {
            allLats.push(parseFloat(act.lat));
            allLons.push(parseFloat(act.lon));
        });
    });

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLon = Math.min(...allLons);
    const maxLon = Math.max(...allLons);
    
    const bounds = [
        [minLat - 0.01, minLon - 0.01],
        [maxLat + 0.01, maxLon + 0.01]
    ];

    const handleStartNavigation = () => {
        setIsNavigating(true);
        const utterance = new SpeechSynthesisUtterance("Starting live navigation. Please follow the highlighted route.");
        window.speechSynthesis.speak(utterance);
    };

    return (
        <div style={{ marginTop: "20px", marginBottom: "30px", width: "100%", position: "relative" }}>
            {isMasterMap && !isNavigating && <h3 style={{marginBottom: '15px', color: '#0f172a', fontWeight: 'bold'}}>🗺️ Full Trip Interactive Map</h3>}
            
            <div style={{ 
                height: isMasterMap ? (isNavigating ? "600px" : "500px") : "350px", 
                width: "100%", 
                borderRadius: "16px", 
                overflow: "hidden", 
                marginBottom: "15px", 
                boxShadow: isNavigating ? "0 20px 40px -10px rgba(16, 185, 129, 0.3)" : "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                border: isNavigating ? "2px solid #10b981" : "1px solid #e2e8f0",
                transition: "all 0.5s ease"
            }}>
                <MapContainer 
                    bounds={!isNavigating ? bounds : undefined} 
                    style={{ height: "100%", width: "100%", zIndex: 1 }}
                    scrollWheelZoom={true}
                    zoomControl={!isNavigating}
                >
                    {/* Dark mode tileset during navigation for GPS feel */}
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                        url={isNavigating 
                            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                        }
                    />
                    
                    {routePolyline && routePolyline.length > 0 && !isNavigating && (
                        <AnimatedRoute positions={routePolyline} color="#3b82f6" isMasterMap={isMasterMap} />
                    )}

                    {routePolyline && routePolyline.length > 0 && isNavigating && (
                        <>
                            {/* Completed Route in Green */}
                            {progressIndex > 0 && (
                                <AnimatedRoute positions={routePolyline.slice(0, progressIndex + 1)} color="#10b981" isMasterMap={isMasterMap} />
                            )}
                            {/* Remaining Route in Blue */}
                            {progressIndex < routePolyline.length - 1 && (
                                <AnimatedRoute positions={routePolyline.slice(progressIndex)} color="#3b82f6" isMasterMap={isMasterMap} />
                            )}
                        </>
                    )}

                    {(!isNavigating || mapData.length > 0) && mapData.map((block, blockIdx) => {
                        const positions = block.activities.map(act => [parseFloat(act.lat), parseFloat(act.lon)]);
                        return (
                            <div key={`day-block-${blockIdx}`}>
                                {block.activities.map((act, actIdx) => (
                                    <Marker 
                                        key={`marker-${blockIdx}-${actIdx}`} 
                                        position={[parseFloat(act.lat), parseFloat(act.lon)]}
                                        icon={isMasterMap ? createNumberedIcon(actIdx + 1, block.color) : DefaultIcon}
                                    >
                                        <Popup className="custom-popup">
                                            <div className="p-1">
                                                <strong className="text-slate-900 block mb-1 text-sm">
                                                    {isMasterMap ? <span style={{color: block.color}}>{block.dayInfo}</span> : ''}
                                                    {isMasterMap ? ' - ' : ''}{act.place_name}
                                                </strong>
                                                <p className="text-xs text-slate-600 m-0 leading-relaxed line-clamp-3">
                                                    {act.description}
                                                </p>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                                {!isNavigating && positions.length > 1 && !(routePolyline && routePolyline.length > 0) && (
                                    <AnimatedRoute 
                                        positions={positions} 
                                        color={block.color} 
                                        isMasterMap={isMasterMap} 
                                    />
                                )}
                            </div>
                        );
                    })}

                    <NavigationTracker 
                        isNavigating={isNavigating} 
                        routePolyline={routePolyline} 
                        onUpdateStats={setNavStats}
                        onUpdateProgressIndex={setProgressIndex} 
                        activities={allActivitiesList} 
                    />
                </MapContainer>

                {/* UI OVERLAYS */}
                <AnimatePresence>
                    {!isNavigating && routePolyline && routePolyline.length > 0 && isMasterMap && (
                        <motion.button 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            onClick={handleStartNavigation}
                            className="absolute top-6 right-6 z-[1000] px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-black text-sm shadow-[0_8px_30px_rgb(16,185,129,0.3)] transition-all cursor-pointer border-2 border-white flex items-center gap-2"
                        >
                            🧭 Start Live Navigation
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Navigation Dashboard */}
                <AnimatePresence>
                    {isNavigating && (
                        <motion.div 
                            initial={{ y: 150, opacity: 0 }} 
                            animate={{ y: 0, opacity: 1 }} 
                            exit={{ y: 150, opacity: 0 }}
                            className="absolute bottom-6 left-6 right-6 bg-slate-900/95 backdrop-blur-xl rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700/50 z-[1000] text-white flex flex-col gap-4"
                        >
                            <div className="flex justify-between items-center px-2">
                                <div className="flex flex-col">
                                    <span className="text-4xl font-black text-emerald-400 tracking-tight">{navStats.distanceRemaining}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Remaining</span>
                                </div>
                                <div className="flex flex-col items-center">
                                    <span className="text-2xl font-bold">{navStats.eta}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">ETA</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-2xl font-bold text-sky-400">{navStats.speed}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">km/h</span>
                                </div>
                            </div>
                            
                            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden shadow-inner">
                                <div className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300 h-3 rounded-full transition-all duration-1000 relative" style={{ width: `${navStats.progress}%` }}></div>
                            </div>

                            <div className="flex justify-between items-center mt-1 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                                <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-lg">📍</span>
                                    </div>
                                    <div className="text-sm font-bold text-slate-200 truncate">{navStats.nextInstruction}</div>
                                </div>
                                <button 
                                    onClick={() => setIsNavigating(false)} 
                                    className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-black transition-all ml-4 border border-red-500/20 shrink-0 cursor-pointer"
                                >
                                    Exit
                                </button>
                            </div>
                            
                            {/* Debug Info Panel */}
                            <div className="mt-2 text-[10px] text-slate-500 font-mono flex flex-wrap gap-x-4 gap-y-1 justify-between bg-slate-950 p-2 rounded-lg border border-slate-800">
                                <span><strong className="text-slate-400">Pts:</strong> {routePolyline?.length || 0}</span>
                                <span><strong className="text-slate-400">First:</strong> [{routePolyline?.[0]?.[0]?.toFixed(4)}, {routePolyline?.[0]?.[1]?.toFixed(4)}]</span>
                                <span><strong className="text-slate-400">Last:</strong> [{routePolyline?.[routePolyline?.length - 1]?.[0]?.toFixed(4)}, {routePolyline?.[routePolyline?.length - 1]?.[1]?.toFixed(4)}]</span>
                                <span><strong className="text-slate-400">ETA:</strong> {navStats.eta}</span>
                                <span><strong className="text-slate-400">Dist:</strong> {navStats.distanceRemaining}</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
