import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

// Fix for default marker icon missing in React-Leaflet
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
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
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            border: 2px solid white;
            box-shadow: 0 4px 6px rgba(0,0,0,0.4);
            font-family: inherit;
        ">
            ${number}
        </div>
    `;
    return L.divIcon({
        className: 'custom-numbered-marker',
        html: html,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13]
    });
};

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

    if (mapData.length === 0) return <p>No valid map data available with coordinates.</p>;

    // Calculate bounds to fit all points
    let allLats = [];
    let allLons = [];
    mapData.forEach(block => {
        block.activities.forEach(act => {
            allLats.push(act.lat);
            allLons.push(act.lon);
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
            {isMasterMap && <h3 style={{marginBottom: '15px'}}>🗺️ Full Trip Interactive Map</h3>}
            <div style={{ 
                height: isMasterMap ? "500px" : "350px", 
                width: "100%", 
                borderRadius: "12px", 
                overflow: "hidden", 
                marginBottom: "15px", 
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)" 
            }}>
                <MapContainer 
                    bounds={bounds} 
                    style={{ height: "100%", width: "100%", zIndex: 1 }}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {mapData.map((block, blockIdx) => {
                        const positions = block.activities.map(act => [act.lat, act.lon]);
                        return (
                            <div key={`day-block-${blockIdx}`}>
                                {block.activities.map((act, actIdx) => (
                                    <Marker 
                                        key={`marker-${blockIdx}-${actIdx}`} 
                                        position={[act.lat, act.lon]}
                                        icon={isMasterMap ? createNumberedIcon(actIdx + 1, block.color) : DefaultIcon}
                                    >
                                        <Popup>
                                            <strong>{isMasterMap ? `${block.dayInfo} - ` : ''}{act.place_name}</strong>
                                            <br />
                                            {act.description}
                                        </Popup>
                                    </Marker>
                                ))}
                                {positions.length > 1 && (
                                    <Polyline 
                                        positions={positions} 
                                        color={block.color} 
                                        weight={isMasterMap ? 4 : 5} 
                                        opacity={0.8} 
                                        dashArray={isMasterMap ? "8, 10" : null}
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
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "12px 24px",
                        backgroundColor: "#4285F4",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: "8px",
                        fontWeight: "600",
                        fontSize: "16px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                        transition: "background-color 0.2s"
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = "#3367d6"}
                    onMouseOut={(e) => e.target.style.backgroundColor = "#4285F4"}
                >
                    📍 Open Route in Google Maps
                </a>
            )}
        </div>
    );
}
