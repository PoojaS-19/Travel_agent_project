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

export default function MapComponent({ activities }) {
    if (!activities || activities.length === 0) return null;

    // Filter out invalid coordinates
    const validActivities = activities.filter(
        (act) => act.lat && act.lon && !isNaN(act.lat) && !isNaN(act.lon)
    );

    if (validActivities.length === 0) return <p>No map data available for this day.</p>;

    // Calculate center (average of lat/lon)
    const avgLat =
        validActivities.reduce((sum, act) => sum + act.lat, 0) /
        validActivities.length;
    const avgLon =
        validActivities.reduce((sum, act) => sum + act.lon, 0) /
        validActivities.length;

    const center = [avgLat, avgLon];
    const positions = validActivities.map((act) => [act.lat, act.lon]);

    // Construct Google Maps Directions URL
    // Format: https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...
    const origin = validActivities[0];
    const destination = validActivities[validActivities.length - 1];
    const waypoints = validActivities.slice(1, -1);

    let googleMapsUrl = `https://www.google.com/maps/dir/?api=1`;
    googleMapsUrl += `&origin=${origin.lat},${origin.lon}`;
    googleMapsUrl += `&destination=${destination.lat},${destination.lon}`;

    if (waypoints.length > 0) {
        const waypointsStr = waypoints.map(p => `${p.lat},${p.lon}`).join('|');
        googleMapsUrl += `&waypoints=${waypointsStr}`;
    }
    googleMapsUrl += `&travelmode=driving`;

    return (
        <div style={{ marginTop: "20px", marginBottom: "30px" }}>
            <div style={{ height: "350px", width: "100%", borderRadius: "12px", overflow: "hidden", marginBottom: "15px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
                <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {validActivities.map((act, idx) => (
                        <Marker key={idx} position={[act.lat, act.lon]}>
                            <Popup>
                                <strong>{act.place_name}</strong>
                                <br />
                                {act.description}
                            </Popup>
                        </Marker>
                    ))}
                    {positions.length > 1 && <Polyline positions={positions} color="#3b82f6" weight={5} opacity={0.8} />}
                </MapContainer>
            </div>

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
        </div>
    );
}
