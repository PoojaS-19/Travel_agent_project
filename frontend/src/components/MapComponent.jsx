import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { antPath } from "leaflet-ant-path";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

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
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#ef4444", // Red
    "#10b981", // Green
    "#f59e0b", // Orange
    "#ec4899", // Pink
    "#14b8a6", // Teal
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

export default function MapComponent({ activities, allDailyPlans }) {
    // If neither is provided, don't render
    if ((!activities || activities.length === 0) && (!allDailyPlans || allDailyPlans.length === 0)) return null;

    // Process data to standard format based on whether it's Master mode or Day mode
    let mapData = []; // Array of day blocks
    let isMasterMap = false;

    if (allDailyPlans && allDailyPlans.length > 0) {
        isMasterMap = true;
        mapData = allDailyPlans.map((plan, index) => {
            return {
                dayInfo: `Day ${plan.day}`,
                color: DAY_COLORS[index % DAY_COLORS.length],
                activities: plan.activities.filter(act => act.lat && act.lon && !isNaN(act.lat) && !isNaN(act.lon))
            }
        }).filter(block => block.activities.length > 0);
    } else if (activities) {
        // Single day mode
        const validActs = activities.filter(act => act.lat && act.lon && !isNaN(act.lat) && !isNaN(act.lon));
        if (validActs.length > 0) {
            mapData = [{
                dayInfo: "Today",
                color: DAY_COLORS[0],
                activities: validActs
            }];
        }
    }

    if (mapData.length === 0) return <p className="text-slate-500 italic p-4 text-center">No valid coordinates found to display the map.</p>;

    // Calculate bounds to fit all points
    let allLats = [];
    let allLons = [];
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
    
    // Slight padding bounds
    const bounds = [
        [minLat - 0.01, minLon - 0.01],
        [maxLat + 0.01, maxLon + 0.01]
    ];

    // Generate Google Maps Directions link
    let googleMapsUrl = "";
    if (!isMasterMap) {
        const dayActs = mapData[0].activities;
        const origin = dayActs[0];
        const destination = dayActs[dayActs.length - 1];
        const waypoints = dayActs.slice(1, -1);

        googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lon}&destination=${destination.lat},${destination.lon}`;
        if (waypoints.length > 0) {
            const waypointsStr = waypoints.map(p => `${p.lat},${p.lon}`).join('|');
            googleMapsUrl += `&waypoints=${waypointsStr}`;
        }
        googleMapsUrl += `&travelmode=driving`;
    }

    return (
        <div style={{ marginTop: "20px", marginBottom: "30px", width: "100%" }}>
            {isMasterMap && <h3 style={{marginBottom: '15px', color: '#0f172a', fontWeight: 'bold'}}>🗺️ Full Trip Interactive Map</h3>}
            <div style={{ 
                height: isMasterMap ? "500px" : "350px", 
                width: "100%", 
                borderRadius: "16px", 
                overflow: "hidden", 
                marginBottom: "15px", 
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                border: "1px solid #e2e8f0"
            }}>
                <MapContainer 
                    bounds={bounds} 
                    style={{ height: "100%", width: "100%", zIndex: 1 }}
                    scrollWheelZoom={true}
                >
                    {/* Modern premium tileset from CartoDB Voyager */}
                    <TileLayer
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    />
                    
                    {mapData.map((block, blockIdx) => {
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
                                {positions.length > 1 && (
                                    <AnimatedRoute 
                                        positions={positions} 
                                        color={block.color} 
                                        isMasterMap={isMasterMap} 
                                    />
                                )}
                            </div>
                        );
                    })}
                </MapContainer>
            </div>

            {!isMasterMap && googleMapsUrl && (
                <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 bg-brand-secondary hover:bg-blue-600 text-white rounded-xl font-bold text-sm shadow-md transition-all duration-200"
                    style={{ textDecoration: 'none' }}
                >
                    📍 Open Route in Google Maps
                </a>
            )}
        </div>
    );
}
