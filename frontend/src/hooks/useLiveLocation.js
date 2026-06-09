import { useState, useEffect, useRef } from "react";
import { calculateDistance } from "../utils/haversine";
import { toast } from "sonner";

export const useLiveLocation = ({ tripId, userId, enabled, destinationCoords, username }) => {
  const [memberLocations, setMemberLocations] = useState({});
  const [currentLocation, setCurrentLocation] = useState(null);
  const [sosAlert, setSosAlert] = useState(null);
  const [isStationary, setIsStationary] = useState(false);
  const [arrived, setArrived] = useState(false);
  
  const wsRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastLocationRef = useRef(null);
  const lastEmitTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    const wsUrl = `${import.meta.env.VITE_WS_URL || "ws://localhost:8000"}/ws/trips/${tripId}?token=${token}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log("Live Location WS connected");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "locationUpdated") {
          const payload = data.payload;
          setMemberLocations(prev => ({
            ...prev,
            [payload.userId]: { ...payload, lastSeen: Date.now() }
          }));
        } else if (data.event === "sosReceived") {
          const payload = data.payload;
          setSosAlert(payload);
          toast.error(`SOS Alert from ${payload.name || 'a member'}!`, { duration: 10000 });
        } else if (data.event === "memberArrived") {
          const payload = data.payload;
          toast.success(`${payload.name} has arrived at the destination!`);
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    socket.onclose = () => {
      console.log("Live Location WS disconnected");
    };

    // Start tracking location
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ latitude, longitude });

          const now = Date.now();
          const lastLoc = lastLocationRef.current;
          
          let distMoved = 0;
          if (lastLoc) {
            distMoved = calculateDistance(lastLoc.latitude, lastLoc.longitude, latitude, longitude) * 1000; // in meters
          }

          // Battery Saver Mode Logic: Throttle emit if stationary
          let shouldEmit = false;
          if (!lastLoc) {
            shouldEmit = true; // First time
          } else if (distMoved > 10) {
            shouldEmit = true; // Moved more than 10 meters
            setIsStationary(false);
          } else if (now - lastEmitTimeRef.current > 30000) {
            shouldEmit = true; // Heartbeat every 30s
            setIsStationary(true);
          }

          if (shouldEmit && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
              event: "shareLocation",
              payload: { tripId, userId, latitude, longitude }
            }));
            lastLocationRef.current = { latitude, longitude };
            lastEmitTimeRef.current = now;
          }

          // Geofencing Check
          if (destinationCoords && destinationCoords.lat && destinationCoords.lng && !arrived) {
            const distToDest = calculateDistance(latitude, longitude, destinationCoords.lat, destinationCoords.lng);
            if (distToDest <= 0.1) {
              setArrived(true);
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                  event: "memberArrived",
                  payload: { userId, tripId, name: username }
                }));
              }
            }
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [enabled, tripId, userId, destinationCoords, arrived, username]);

  const emitSos = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentLocation) {
      wsRef.current.send(JSON.stringify({
        event: "sosAlert",
        payload: { tripId, userId, latitude: currentLocation.latitude, longitude: currentLocation.longitude }
      }));
    }
  };

  const clearWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
  };

  return { memberLocations, currentLocation, sosAlert, emitSos, isStationary, clearWatch };
};
