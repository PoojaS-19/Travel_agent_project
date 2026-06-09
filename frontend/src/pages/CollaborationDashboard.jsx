import { useMemo, useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import api from "../api";
import ActivityRanking from "../components/collaboration/ActivityRanking";
import DecisionSummary from "../components/collaboration/DecisionSummary";
import InviteMembersModal from "../components/collaboration/InviteMembersModal";
import SuggestionFeed from "../components/collaboration/SuggestionFeed";
import VotingBoard from "../components/collaboration/VotingBoard";
import useTripCollaboration from "../hooks/useTripCollaboration";
import "./CollaborationDashboard.css";

// Fix default Leaflet icon paths for Vite builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Custom red marker for the leader's location
const leaderIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const MEMBER_COLORS = ["green", "gold", "violet", "orange", "grey", "black"];
const memberIcons = MEMBER_COLORS.reduce((acc, color) => {
  acc[color] = new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  return acc;
}, {});

function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const parseUTCDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === "string" && !dateStr.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "Z");
  }
  return new Date(dateStr);
};

const getActivityTypeDetails = (activity) => {
  if (!activity) return { emoji: "○", name: "Activity", color: "#64748b" };
  const category = (activity.category || "").toLowerCase();
  const title = (activity.place_name || "").toLowerCase();
  const desc = (activity.description || "").toLowerCase();

  // Heuristics for keywords if category is empty/travel/relax etc
  if (category === "food" || title.includes("restaurant") || title.includes("shamiana") || title.includes("dining") || title.includes("café") || title.includes("cafe") || title.includes("lunch") || title.includes("dinner") || desc.includes("eat") || desc.includes("dine") || desc.includes("food")) {
    return { emoji: "🍔", name: "Dining", color: "#f97316" };
  }
  if (category === "travel" || title.includes("airport") || title.includes("flight") || title.includes("train") || title.includes("station") || title.includes("cab") || title.includes("drive") || title.includes("taxi") || title.includes("transit") || title.includes("travel") || desc.includes("drive") || desc.includes("ride") || desc.includes("travel")) {
    return { emoji: "🚗", name: "Transit", color: "#3b82f6" };
  }
  if (category === "relax" && (title.includes("hotel") || title.includes("resort") || title.includes("stay") || title.includes("lodging") || title.includes("homestay") || title.includes("villa") || desc.includes("check-in") || desc.includes("check in") || desc.includes("stay at"))) {
    return { emoji: "🏨", name: "Lodging", color: "#a855f7" };
  }
  if (category === "shopping" || title.includes("market") || title.includes("mall") || title.includes("bazaar") || title.includes("shop") || desc.includes("buy") || desc.includes("souvenir") || desc.includes("shop")) {
    return { emoji: "🛍️", name: "Shopping", color: "#ec4899" };
  }
  if (category === "relax" || title.includes("beach") || title.includes("spa") || title.includes("garden") || title.includes("park") || title.includes("lake") || desc.includes("relax") || desc.includes("leisure")) {
    return { emoji: "🧘", name: "Leisure", color: "#10b981" };
  }
  // Default is Sightseeing/Attraction
  return { emoji: "🏛️", name: "Sightseeing", color: "#06b6d4" };
};

function formatLastUpdated(dateStr, isOffline = false) {
  if (!dateStr) return "Never";
  const diffMs = Math.max(0, new Date() - parseUTCDate(dateStr));
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 10) {
    return isOffline ? "Last seen just now" : "Updated just now";
  }
  if (diffSecs < 60) {
    return isOffline ? `Last seen ${diffSecs} seconds ago` : `Updated ${diffSecs} seconds ago`;
  }
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 5) {
    return isOffline ? `Last seen ${diffMins} min ago` : `Updated ${diffMins} minutes ago`;
  }
  if (diffMins < 10) {
    return isOffline ? `Last seen ${diffMins} min ago (Location may be outdated)` : "Location may be outdated";
  }
  return "Location expired";
}

function MapZoomListener({ onChangeZoom }) {
  const map = useMap();
  useEffect(() => {
    const onZoom = () => onChangeZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map, onChangeZoom]);
  return null;
}

// Helper component to dynamically fly/recenter the Leaflet map
function ChangeMapView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 13);
    }
  }, [center, map]);
  return null;
}

export default function CollaborationDashboard() {
  const { tripId } = useParams();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [progressionLoading, setProgressionLoading] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  const handleCopyInviteLink = (inviteLink, email) => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setSuccessToast(`Invite link copied for ${email}!`);
    setTimeout(() => {
      setSuccessToast("");
    }, 3000);
  };
  const {
    dashboard,
    suggestions,
    groupedSuggestions,
    decisions,
    expensesData,
    leaderLocation,
    memberLocations,
    expensePromptPlace,
    setExpensePromptPlace,
    itinerary,
    loading,
    error,
    chatMessages,
    typingUsers,
    actions
  } = useTripCollaboration(tripId);

  // Chat UI states & logic
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageInput, setMessageInput] = useState("");
  const [msgType, setMsgType] = useState("text"); // "text" or "announcement"

  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const previousArrivalStatesRef = useRef({});
  const prevDestNameRef = useRef(null);

  // Auto-scroll to bottom of chat when messages change or it is expanded
  useEffect(() => {
    if (!chatCollapsed && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatCollapsed]);

  // Unread messages counter logic
  useEffect(() => {
    if (chatMessages && chatMessages.length > prevMessagesLength.current) {
      if (chatCollapsed) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        let currentUserId = null;
        try {
          const userStr = localStorage.getItem("user");
          if (userStr) {
            currentUserId = JSON.parse(userStr).id;
          }
        } catch (err) {
          console.error(err);
        }
        // Increment only for other users' messages
        if (lastMsg && lastMsg.user_id !== currentUserId && !lastMsg.id.toString().startsWith("opt-")) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    }
    prevMessagesLength.current = chatMessages ? chatMessages.length : 0;
  }, [chatMessages, chatCollapsed]);

  useEffect(() => {
    if (!chatCollapsed) {
      setUnreadCount(0);
    }
  }, [chatCollapsed]);

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    if (actions.sendTypingStatus) {
      actions.sendTypingStatus(true);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      if (actions.sendTypingStatus) {
        actions.sendTypingStatus(false);
      }
    }, 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    const textToSend = messageInput.trim();
    setMessageInput("");
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (actions.sendTypingStatus) {
      actions.sendTypingStatus(false);
    }
    try {
      await actions.sendChatMessage(textToSend, msgType);
      setMsgType("text");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to send message.");
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    try {
      const d = parseUTCDate(timeStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (err) {
      return "";
    }
  };

  const getTypingText = () => {
    const list = Object.values(typingUsers || {});
    if (list.length === 0) return "";
    if (list.length === 1) return `${list[0].username} is typing...`;
    if (list.length === 2) return `${list[0].username} and ${list[1].username} are typing...`;
    return "Multiple people are typing...";
  };

  // Modal / Form States
  const [promptAmount, setPromptAmount] = useState("");
  const [promptDesc, setPromptDesc] = useState("");

  const [manualPlace, setManualPlace] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDesc, setManualDesc] = useState("");

  const [selectedSimPlaceIndex, setSelectedSimPlaceIndex] = useState(0);

  const [followers, setFollowers] = useState([
    { email: "", invited: false, verified: false, otp: "", message: "", error: "", loadingInvite: false, loadingVerify: false }
  ]);
  const [showFollowersCard, setShowFollowersCard] = useState(false);

  const addFollowerField = () => {
    setFollowers([...followers, { email: "", invited: false, verified: false, otp: "", message: "", error: "", loadingInvite: false, loadingVerify: false }]);
  };

  const handleFollowerEmailChange = (index, value) => {
    const updated = [...followers];
    updated[index].email = value;
    setFollowers(updated);
  };

  const handleFollowerOtpChange = (index, value) => {
    const updated = [...followers];
    updated[index].otp = value;
    setFollowers(updated);
  };

  const handleSendInvite = async (index) => {
    const follower = followers[index];
    if (!follower.email) {
      const updated = [...followers];
      updated[index].error = "Please enter a valid email address.";
      setFollowers(updated);
      return;
    }
    const updated = [...followers];
    updated[index].loadingInvite = true;
    updated[index].error = "";
    updated[index].message = "";
    setFollowers(updated);

    try {
      await actions.inviteMembers([follower.email], "follower");
      const updatedSuccess = [...followers];
      updatedSuccess[index].invited = true;
      updatedSuccess[index].message = "Verification code sent to email.";
      updatedSuccess[index].loadingInvite = false;
      setFollowers(updatedSuccess);
    } catch (err) {
      console.error("Invite follower error:", err);
      const updatedErr = [...followers];
      updatedErr[index].error = err.response?.data?.detail || "Could not send invite.";
      updatedErr[index].loadingInvite = false;
      setFollowers(updatedErr);
    }
  };

  const handleVerifyOtp = async (index) => {
    const follower = followers[index];
    if (follower.otp.length !== 6) {
      const updated = [...followers];
      updated[index].error = "Please enter a 6-digit verification code.";
      setFollowers(updated);
      return;
    }

    const updated = [...followers];
    updated[index].loadingVerify = true;
    updated[index].error = "";
    updated[index].message = "";
    setFollowers(updated);

    try {
      await api.post("/api/collaboration/invitations/accept-otp", {
        otp_code: follower.otp
      });
      const updatedSuccess = [...followers];
      updatedSuccess[index].verified = true;
      updatedSuccess[index].message = "Follower linked successfully!";
      updatedSuccess[index].loadingVerify = false;
      setFollowers(updatedSuccess);
      actions.reload();
    } catch (err) {
      console.error("Verify OTP error:", err);
      const updatedErr = [...followers];
      updatedErr[index].error = err.response?.data?.detail || "Invalid code or user not registered.";
      updatedErr[index].loadingVerify = false;
      setFollowers(updatedErr);
    }
  };

  const handleDoneFinalizing = () => {
    setShowFollowersCard(false);
    alert("Followers linking process finished.");
  };

  const canEdit = dashboard?.my_role === "owner" || dashboard?.my_role === "editor";
  const isOwner = dashboard?.my_role === "owner";
  const activities = useMemo(() => groupedSuggestions.activity || [], [groupedSuggestions]);

  // Extract all activities that have lat/lon coordinates from itinerary
  const mapPlaces = useMemo(() => {
    if (!itinerary?.daily_plans) return [];
    const list = [];
    itinerary.daily_plans.forEach((day) => {
      (day.activities || []).forEach((act) => {
        if (act.place_name && act.lat !== undefined && act.lon !== undefined && act.lat !== null && act.lon !== null) {
          list.push({
            place_name: act.place_name,
            lat: Number(act.lat),
            lon: Number(act.lon),
            day: day.day,
            time: act.time || "Flexible"
          });
        }
      });
    });
    return list;
  }, [itinerary]);

  // Determine center of map: leader location or first itinerary activity
  const mapCenter = useMemo(() => {
    if (leaderLocation && leaderLocation.lat && leaderLocation.lon) {
      return [leaderLocation.lat, leaderLocation.lon];
    }
    if (mapPlaces.length > 0) return [mapPlaces[0].lat, mapPlaces[0].lon];
    return [19.0760, 72.8777]; // Mumbai
  }, [leaderLocation, mapPlaces]);

  const [locationError, setLocationError] = useState("");
  const [isSharingLocal, setIsSharingLocal] = useState(true);
  const [followLeader, setFollowLeader] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(13);
  const [now, setNow] = useState(new Date());
  const [selectedDestinationIndex, setSelectedDestinationIndex] = useState(0);
  const [lastSent, setLastSent] = useState(null);

  const [dismissedAutoPrompts, setDismissedAutoPrompts] = useState(() => {
    try {
      const stored = localStorage.getItem(`dismissed_prompts_${tripId}`);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });

  const dismissAutoPrompt = (placeName) => {
    const updated = {
      ...dismissedAutoPrompts,
      [placeName]: Date.now()
    };
    setDismissedAutoPrompts(updated);
    try {
      localStorage.setItem(`dismissed_prompts_${tripId}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const isPromptDismissed = (placeName) => {
    const timestamp = dismissedAutoPrompts[placeName];
    if (!timestamp) return false;
    // 15 minutes cooldown (900000 milliseconds)
    const cooldownActive = Date.now() - timestamp < 900000;
    return cooldownActive;
  };

  const flatActivities = useMemo(() => {
    if (!itinerary?.daily_plans) return [];
    const list = [];
    itinerary.daily_plans.forEach((dayPlan) => {
      (dayPlan.activities || []).forEach((act) => {
        list.push({
          ...act,
          day: dayPlan.day,
          date: dayPlan.date,
          lat: act.lat !== undefined && act.lat !== null ? Number(act.lat) : null,
          lon: act.lon !== undefined && act.lon !== null ? Number(act.lon) : null
        });
      });
    });
    return list;
  }, [itinerary]);

  const currentActivityIndex = useMemo(() => {
    const hasAnyStatus = flatActivities.some(a => a.status === "current" || a.status === "completed" || a.status === "skipped");
    let idx = flatActivities.findIndex(a => a.status === "current");
    if (idx === -1 && !flatActivities.every(a => a.status === "completed" || a.status === "skipped") && hasAnyStatus) {
      return 0;
    }
    return idx;
  }, [flatActivities]);

  const currentAct = currentActivityIndex !== -1 ? flatActivities[currentActivityIndex] : null;
  const nextAct = (currentActivityIndex !== -1 && currentActivityIndex < flatActivities.length - 1) ? flatActivities[currentActivityIndex + 1] : null;

  const dailyEndpoints = useMemo(() => {
    if (!itinerary?.daily_plans) return {};
    const endpoints = {};
    itinerary.daily_plans.forEach((dayPlan) => {
      const dayActivities = dayPlan.activities || [];
      if (dayActivities.length > 0) {
        endpoints[dayPlan.day] = {
          start: dayActivities[0].place_name,
          end: dayActivities[dayActivities.length - 1].place_name
        };
      }
    });
    return endpoints;
  }, [itinerary]);

  const leaderLocEntry = useMemo(() => {
    return (memberLocations || []).find(l => {
      if (l.role === "owner") return true;
      const memberInfo = (dashboard?.members || []).find(m => m.user_id === l.user_id);
      return memberInfo && memberInfo.role === "owner";
    });
  }, [memberLocations, dashboard]);

  const showAssistedCompletion = useMemo(() => {
    if (!currentAct || !canEdit) return false;
    
    // Check if dismissed and active cooldown
    const isDismissed = isPromptDismissed(currentAct.place_name);
    if (isDismissed) return false;

    if (!leaderLocEntry || !leaderLocEntry.is_sharing) return false;

    // Check if leader location is stale (> 10 mins)
    const nowTime = new Date();
    const diffMs = nowTime - parseUTCDate(leaderLocEntry.last_updated);
    if (diffMs > 600000) return false;

    const currentActDetails = getActivityTypeDetails(currentAct);
    const isTransit = currentActDetails.name === "Transit";

    if (isTransit) {
      // Transit activities use next endpoint arrival detection (150m)
      if (nextAct && nextAct.lat !== null && nextAct.lon !== null) {
        const distToNext = haversineDistance(leaderLocEntry.latitude, leaderLocEntry.longitude, nextAct.lat, nextAct.lon);
        return distToNext !== null && distToNext <= 0.15;
      }
      return false;
    } else {
      // Standard activities use simple departure detection (250m)
      if (currentAct.lat !== null && currentAct.lon !== null) {
        const distFromCurrent = haversineDistance(leaderLocEntry.latitude, leaderLocEntry.longitude, currentAct.lat, currentAct.lon);
        if (distFromCurrent !== null && distFromCurrent >= 0.25) {
          return true;
        }
      }
      // General fallback: if they arrive at next planned activity
      if (nextAct && nextAct.lat !== null && nextAct.lon !== null) {
        const distToNext = haversineDistance(leaderLocEntry.latitude, leaderLocEntry.longitude, nextAct.lat, nextAct.lon);
        return distToNext !== null && distToNext <= 0.15;
      }
      return false;
    }
  }, [currentAct, nextAct, leaderLocEntry, canEdit, dismissedAutoPrompts]);

  // Dynamic timing refresh
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Geolocation update with smart optimization threshold (> 30m or > 30s)
  useEffect(() => {
    if (!tripId || !actions.updateMemberLocation || !isSharingLocal) return;

    let watchId = null;
    const sendLocation = (lat, lon) => {
      const currentTime = Date.now();
      if (lastSent) {
        const distKm = haversineDistance(lat, lon, lastSent.lat, lastSent.lon);
        const timeDiffSec = (currentTime - lastSent.timestamp) / 1000;
        if (distKm !== null && distKm < 0.03 && timeDiffSec < 30) {
          return; // Skip DB write
        }
      }

      if (isOwner) {
        actions.updateLeaderLocation(lat, lon).catch(err => console.error(err));
      } else {
        actions.updateMemberLocation(lat, lon).catch(err => console.error(err));
      }
      setLastSent({ lat, lon, timestamp: currentTime });
    };

    const handleSuccess = (position) => {
      setLocationError("");
      sendLocation(position.coords.latitude, position.coords.longitude);
    };

    const handleError = (error) => {
      console.warn("GPS error code:", error.code);
      let errMsg = "📍 Location access not granted. Enable location sharing to appear on the map.";
      if (error.code === error.TIMEOUT) {
        errMsg = "📍 GPS signal request timed out. Retrying...";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errMsg = "📍 GPS signal unavailable.";
      }
      setLocationError(errMsg);
    };

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    } else {
      setLocationError("📍 Browser does not support geolocation.");
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [tripId, isOwner, isSharingLocal, lastSent, actions]);

  const handleSharingToggle = async (e) => {
    const checked = e.target.checked;
    setIsSharingLocal(checked);
    try {
      await actions.toggleSharingStatus(checked);
      if (!checked) {
        setLastSent(null);
      }
    } catch (err) {
      console.error("Failed to toggle sharing status:", err);
    }
  };

  const handleRetryLocation = () => {
    setLocationError("");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationError("");
          if (isOwner) {
            actions.updateLeaderLocation(position.coords.latitude, position.coords.longitude);
          } else {
            actions.updateMemberLocation(position.coords.latitude, position.coords.longitude);
          }
        },
        (error) => {
          console.warn("GPS retry error:", error);
          setLocationError("📍 Location access not granted. Enable location sharing to appear on the map.");
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  // Process and color-code member locations
  const activeLocations = useMemo(() => {
    const list = dashboard?.members || [];
    const nowTime = new Date();
    return (memberLocations || [])
      .filter(loc => {
        if (!loc.is_sharing) return false;
        
        // Exclude members with expired locations (> 10 minutes)
        const diffMs = nowTime - parseUTCDate(loc.last_updated);
        if (diffMs > 600000) return false;
        
        return true;
      })
      .map((loc, idx) => {
        const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
        return {
          ...loc,
          color,
          icon: loc.role === "owner" ? leaderIcon : memberIcons[color]
        };
      });
  }, [memberLocations, dashboard, now]);

  // Cluster calculations based on Zoom level
  const clusteredLocations = useMemo(() => {
    const threshold = 0.1 / Math.pow(2, zoomLevel - 8);
    const clusters = [];
    
    activeLocations.forEach(member => {
      let foundCluster = null;
      for (const cluster of clusters) {
        const distLat = Math.abs(cluster.centerLat - member.latitude);
        const distLon = Math.abs(cluster.centerLon - member.longitude);
        if (distLat < threshold && distLon < threshold) {
          foundCluster = cluster;
          break;
        }
      }
      
      if (foundCluster) {
        foundCluster.members.push(member);
        const count = foundCluster.members.length;
        foundCluster.centerLat = (foundCluster.centerLat * (count - 1) + member.latitude) / count;
        foundCluster.centerLon = (foundCluster.centerLon * (count - 1) + member.longitude) / count;
      } else {
        clusters.push({
          centerLat: member.latitude,
          centerLon: member.longitude,
          members: [member]
        });
      }
    });
    return clusters;
  }, [activeLocations, zoomLevel]);

  // Destination Arrival Tracking
  const currentActiveDestination = useMemo(() => {
    if (!itinerary?.daily_plans) return null;
    let found = null;
    itinerary.daily_plans.forEach((dayPlan) => {
      (dayPlan.activities || []).forEach((act) => {
        if (act.status === "current") {
          found = {
            place_name: act.place_name,
            lat: act.lat !== undefined && act.lat !== null ? Number(act.lat) : null,
            lon: act.lon !== undefined && act.lon !== null ? Number(act.lon) : null,
            day: dayPlan.day,
            time: act.time || "Flexible"
          };
        }
      });
    });
    return found;
  }, [itinerary]);

  const leaderStayDuration = useMemo(() => {
    if (!itinerary?.current_visit?.arrived_at || itinerary?.current_visit?.status !== "arrived") return null;
    const diffMs = now - parseUTCDate(itinerary.current_visit.arrived_at);
    return Math.max(0, Math.floor(diffMs / 1000)); // duration in seconds
  }, [itinerary, now]);

  const formatDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return "";
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return `${h}h ${mins}m`;
  };

  const currentDestination = mapPlaces[selectedDestinationIndex] || null;
  const targetDest = currentActiveDestination || currentDestination;

  const arrivalList = useMemo(() => {
    if (!targetDest || targetDest.lat === null || targetDest.lon === null) return [];
    
    // Reset arrival history when target place changes
    if (prevDestNameRef.current !== targetDest.place_name) {
      previousArrivalStatesRef.current = {};
      prevDestNameRef.current = targetDest.place_name;
    }
    
    const nowTime = new Date();
    const members = dashboard?.members || [];
    
    return members.map(m => {
      const loc = (memberLocations || []).find(l => l.user_id === m.user_id);
      
      let arrived = false;
      let status = "Offline / No Location";
      let isStale = true;
      let sharing = false;
      
      if (loc) {
        sharing = loc.is_sharing;
        const diffMs = nowTime - parseUTCDate(loc.last_updated);
        isStale = diffMs > 600000;
        
        if (loc.is_sharing && !isStale) {
          const distKm = haversineDistance(loc.latitude, loc.longitude, targetDest.lat, targetDest.lon);
          
          let previouslyArrived = previousArrivalStatesRef.current[m.user_id] || false;
          if (distKm !== null) {
            if (distKm <= 0.15) {
              arrived = true;
            } else if (distKm >= 0.25) {
              arrived = false;
            } else {
              arrived = previouslyArrived;
            }
          }
          previousArrivalStatesRef.current[m.user_id] = arrived;
          status = arrived ? "Arrived" : "Not Arrived";
        } else if (!loc.is_sharing) {
          status = "Sharing Disabled";
        } else {
          status = "Location Expired";
        }
      }
      
      return {
        user_id: m.user_id,
        username: m.username || m.email,
        role: m.role,
        arrived,
        status,
        isStale,
        isSharing: sharing
      };
    });
  }, [memberLocations, targetDest, dashboard, now]);
  
  const activeMembersForArrival = useMemo(() => {
    return arrivalList.filter(m => !m.isStale && m.isSharing);
  }, [arrivalList]);

  const sortedArrivals = useMemo(() => {
    return [...arrivalList].sort((a, b) => {
      if (a.role === "owner") return -1;
      if (b.role === "owner") return 1;
      return a.username.localeCompare(b.username);
    });
  }, [arrivalList]);

  const leaderArrived = useMemo(() => {
    return arrivalList.find(m => m.role === "owner")?.arrived || false;
  }, [arrivalList]);
  
  const arrivedCount = useMemo(() => {
    return activeMembersForArrival.filter(m => m.arrived).length;
  }, [activeMembersForArrival]);

  const createClusterIcon = (count) => {
    const html = `
      <div style="
          background: radial-gradient(circle, #6366f1 0%, #4f46e5 100%);
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 15px;
          border: 3px solid rgba(255, 255, 255, 0.8);
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      ">
          ${count}
      </div>
    `;
    return L.divIcon({
      html: html,
      className: 'custom-cluster-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
  };

  // Form Submissions
  const handlePromptExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!promptAmount || isNaN(promptAmount)) return;
    try {
      await actions.addExpense(expensePromptPlace, Number(promptAmount), promptDesc);
      setPromptAmount("");
      setPromptDesc("");
      setExpensePromptPlace(null);
    } catch (err) {
      console.error(err);
      alert("Failed to submit expense");
    }
  };

  const handleManualExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!manualPlace || !manualAmount || isNaN(manualAmount)) return;
    try {
      await actions.addExpense(manualPlace, Number(manualAmount), manualDesc);
      setManualPlace("");
      setManualAmount("");
      setManualDesc("");
    } catch (err) {
      console.error(err);
      alert("Failed to submit expense");
    }
  };

  // Simulation controls
  const handleSimulateArrive = async () => {
    const place = mapPlaces[selectedSimPlaceIndex];
    if (!place) return;
    try {
      if (isOwner) {
        await actions.updateLeaderLocation(place.lat, place.lon);
      } else {
        await actions.updateMemberLocation(place.lat, place.lon);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateLeave = async () => {
    const place = mapPlaces[selectedSimPlaceIndex];
    if (!place) return;
    try {
      if (isOwner) {
        // Teleport leader 1km away from coordinates to simulate leaving the location
        await actions.updateLeaderLocation(place.lat + 0.01, place.lon + 0.01);
      } else {
        await actions.updateMemberLocation(place.lat + 0.01, place.lon + 0.01);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!tripId) {
    return (
      <main className="collab-page">
        <section className="trip-picker">
          <h1>Invalid trip selected</h1>
          <p>Open collaboration from a saved itinerary.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="collab-page">
      <InviteMembersModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={actions.inviteMembers} />

      {/* 1. Real-time Proximity Expense Prompt Modal */}
      {expensePromptPlace && (
        <div className="collab-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="collab-modal" style={{ border: "2px solid #2563eb" }}>
            <div className="collab-modal-header">
              <h2>💰 Expense Prompt</h2>
              <button className="icon-button" onClick={() => setExpensePromptPlace(null)}>×</button>
            </div>
            <p>Leader left <strong>{expensePromptPlace}</strong>. How many rupees did you spend here?</p>
            <form onSubmit={handlePromptExpenseSubmit}>
              <label>
                Amount (in Rs.)
                <input
                  type="number"
                  required
                  placeholder="e.g. 500"
                  value={promptAmount}
                  onChange={(e) => setPromptAmount(e.target.value)}
                />
              </label>
              <label>
                Description
                <input
                  type="text"
                  placeholder="e.g. Lunch, snacks, souvenirs"
                  value={promptDesc}
                  onChange={(e) => setPromptDesc(e.target.value)}
                />
              </label>
              <div className="collab-modal-actions">
                <button type="submit" className="saved-trip-primary-btn">Submit Expense</button>
                <button type="button" onClick={() => setExpensePromptPlace(null)} className="saved-trip-secondary-btn" style={{ background: "#64748b" }}>Skip</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="collab-hero">
        <div>
          <span className="live-pill">Live room - Trip #{tripId}</span>
          <h1>Plan & Travel together</h1>
          <p>Invite buddies, vote on ideas, track leader location in real-time, and log expenses easily.</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => setInviteOpen(true)} disabled={!isOwner}>Invite Buddies</button>
          {isOwner && (
            <>
              <button onClick={() => setShowFollowersCard(true)} style={{ background: "#10b981" }}>Link Followers</button>
              <button onClick={() => actions.setVotingLocked(!dashboard?.voting_locked)}>
                {dashboard?.voting_locked ? "Unlock voting" : "Lock voting"}
              </button>
            </>
          )}
        </div>
      </section>

      {error && <p className="collab-error">{error}</p>}
      {loading && <div className="collab-loading">Syncing collaboration room...</div>}

      {/* Members rail */}
      <section className="member-rail">
        {(dashboard?.members || []).map((member) => {
          const loc = (memberLocations || []).find(l => l.user_id === member.user_id);
          const status = loc ? loc.status : "Offline";
          const isOnline = status === "Online";
          const isSharingDisabled = status === "Location Sharing Disabled";
          
          return (
            <div className="member-chip" key={member.id}>
              <span style={{ background: member.role === "owner" ? "#fee2e2" : "#dbeafe", color: member.role === "owner" ? "#b91c1c" : "#1e3a8a", position: "relative" }}>
                {member.role === "owner" ? "👑" : member.username?.slice(0, 1).toUpperCase() || member.email?.slice(0, 1).toUpperCase()}
                <span style={{
                  position: "absolute",
                  bottom: "-2px",
                  right: "-2px",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  border: "2px solid white",
                  background: isOnline ? "#22c55e" : isSharingDisabled ? "#dc2626" : "#94a3b8"
                }}></span>
              </span>
              <div>
                <strong>{member.username || member.email}</strong>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <small>{member.role === "owner" ? "Leader" : member.role === "follower" ? "Buddy (Follower)" : member.role}</small>
                  <span style={{
                    fontSize: "10px",
                    fontWeight: "600",
                    color: isOnline ? "#16a34a" : isSharingDisabled ? "#dc2626" : "#64748b"
                  }}>
                    • {status}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {(dashboard?.pending_invitations || []).map((invite) => (
          <div className="member-chip pending" key={invite.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span>✉️</span>
              <div>
                <strong>{invite.email}</strong>
                <small>pending {invite.role === "follower" ? "buddy" : invite.role}</small>
              </div>
            </div>
            {invite.invite_link && (
              <button
                type="button"
                className="copy-invite-btn"
                style={{
                  padding: "4px 8px",
                  fontSize: "12px",
                  background: "#ffffff",
                  color: "#2563eb",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "500",
                  marginLeft: "auto"
                }}
                onClick={() => handleCopyInviteLink(invite.invite_link, invite.email)}
                title="Copy Shareable Invite Link"
              >
                Copy Link
              </button>
            )}
          </div>
        ))}
      </section>

      {/* Advanced Itinerary Progress System Section (Phase 1 - Read-Only) */}
      {/* Advanced Itinerary Progress System Section (Phase 2) */}
      {itinerary?.daily_plans && itinerary.daily_plans.length > 0 && (
        <motion.section 
          className="itinerary-progress-section collab-section"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h3>📋 Itinerary Progress Dashboard</h3>
          <div className="progress-grid">
            
            {/* Left Column: Current Destination & Progress Bar */}
            <div className="progress-main-col">
              {/* Current Destination Card */}
              {(() => {
                const allActs = [];
                itinerary.daily_plans.forEach((dayPlan) => {
                  (dayPlan.activities || []).forEach((activity) => {
                    allActs.push({
                      ...activity,
                      day: dayPlan.day,
                      date: dayPlan.date
                    });
                  });
                });

                if (allActs.length === 0) return null;

                const hasAnyStatus = allActs.some(a => a.status === "current" || a.status === "completed" || a.status === "skipped");
                let curIdx = allActs.findIndex(a => a.status === "current");
                const isTripCompleted = hasAnyStatus && curIdx === -1 && allActs.every(a => a.status === "completed" || a.status === "skipped");

                if (curIdx === -1 && !isTripCompleted) {
                  curIdx = 0;
                }

                if (isTripCompleted) {
                  const completedCount = allActs.filter(a => a.status === "completed").length;
                  const skippedCount = allActs.filter(a => a.status === "skipped").length;
                  const activeTotal = allActs.length - skippedCount;
                  return (
                    <motion.div 
                      className="current-destination-card trip-completed"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
                    >
                      <span className="card-header-label">Trip State</span>
                      <h4 className="card-place-name">
                        🎉 Trip Completed!
                      </h4>
                      <div className="card-meta-grid">
                        <div className="card-meta-item">
                          <span className="card-meta-title">Status</span>
                          <span className="card-meta-value" style={{ color: "#34d399" }}>Completed</span>
                        </div>
                        <div className="card-meta-item">
                          <span className="card-meta-title">Destinations</span>
                          <span className="card-meta-value">{completedCount} of {activeTotal}</span>
                        </div>
                        <div className="card-meta-item">
                          <span className="card-meta-title">Skipped</span>
                          <span className="card-meta-value">{skippedCount} skipped</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                const currentAct = allActs[curIdx];

                const handleComplete = async () => {
                  if (progressionLoading) return;
                  setProgressionLoading(true);
                  try {
                    await actions.completeDestination(currentAct.place_name);
                  } catch (err) {
                    console.error(err);
                    alert(err.response?.data?.detail || "Failed to complete destination.");
                  } finally {
                    setProgressionLoading(false);
                  }
                };

                const handleSkip = async () => {
                  if (progressionLoading) return;
                  setProgressionLoading(true);
                  try {
                    await actions.skipDestination(currentAct.place_name);
                  } catch (err) {
                    console.error(err);
                    alert(err.response?.data?.detail || "Failed to skip destination.");
                  } finally {
                    setProgressionLoading(false);
                  }
                };

                const typeDetails = getActivityTypeDetails(currentAct);
                return (
                  <motion.div 
                    className="current-destination-card"
                    layout
                    initial={{ scale: 0.95, opacity: 0, x: -20 }}
                    animate={{ scale: 1, opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  >
                    <span className="card-header-label">Current Destination &middot; {typeDetails.emoji} {typeDetails.name}</span>
                    <h4 className="card-place-name">
                      {typeDetails.emoji} {currentAct.place_name || "Unknown Location"}
                    </h4>
                    
                    <div className="card-meta-grid">
                      <div className="card-meta-item">
                        <span className="card-meta-title">Status</span>
                        <span className="card-meta-value status-active">Active</span>
                      </div>
                      {leaderStayDuration !== null && (
                        <div className="card-meta-item">
                          <span className="card-meta-title">Stay Duration</span>
                          <span className="card-meta-value stay-duration-value">⏱ {formatDuration(leaderStayDuration)}</span>
                        </div>
                      )}
                      <div className="card-meta-item">
                        <span className="card-meta-title">Destination</span>
                        <span className="card-meta-value">
                          {curIdx + 1} of {allActs.length}
                        </span>
                      </div>
                      <div className="card-meta-item">
                        <span className="card-meta-title">Day</span>
                        <span className="card-meta-value">{currentAct.day}</span>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="progression-actions">
                        <button
                          onClick={handleComplete}
                          disabled={progressionLoading}
                          className="progression-btn-complete"
                        >
                          {progressionLoading ? "Updating..." : "✓ Mark Completed"}
                        </button>
                        <button
                          onClick={handleSkip}
                          disabled={progressionLoading}
                          className="progression-btn-skip"
                        >
                          {progressionLoading ? "Updating..." : "⏭ Skip"}
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })()}

              {/* Assisted Auto-Completion Prompt */}
              <AnimatePresence>
              {showAssistedCompletion && currentAct && (
                <motion.div 
                  className="assisted-completion-prompt-card"
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="prompt-header">
                    <span>💡 Assisted Auto-Completion Suggestion</span>
                  </div>
                  <div className="prompt-body">
                    <p>
                      You appear to have {getActivityTypeDetails(currentAct)?.name === "Transit" ? "arrived at the next destination" : "left " + currentAct.place_name}. Mark <strong>{currentAct.place_name}</strong> as completed?
                    </p>
                    <div className="prompt-buttons">
                      <button
                        onClick={async () => {
                          if (progressionLoading) return;
                          setProgressionLoading(true);
                          try {
                            await actions.completeDestination(currentAct.place_name);
                          } catch (err) {
                            console.error(err);
                            alert(err.response?.data?.detail || "Failed to complete destination.");
                          } finally {
                            setProgressionLoading(false);
                          }
                        }}
                        disabled={progressionLoading}
                        className="prompt-btn-complete"
                      >
                        {progressionLoading ? "Updating..." : "✓ Complete"}
                      </button>
                      <button
                        onClick={() => dismissAutoPrompt(currentAct.place_name)}
                        className="prompt-btn-dismiss"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
              </AnimatePresence>

              {/* Smart Suggestion Card (Advisory only) */}
              <AnimatePresence>
              {canEdit && currentActiveDestination && itinerary?.current_visit?.status === "arrived" && leaderStayDuration >= 1800 && (
                <motion.div 
                  className="smart-suggestion-card"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="suggestion-icon">💡</div>
                  <div className="suggestion-content">
                    <h5>Smart Suggestion</h5>
                    <p>
                      Leader has been at <strong>{currentActiveDestination.place_name}</strong> for {formatDuration(leaderStayDuration)}. Suggest marking this destination as completed.
                    </p>
                    <button
                      onClick={async () => {
                        if (progressionLoading) return;
                        setProgressionLoading(true);
                        try {
                          await actions.completeDestination(currentActiveDestination.place_name);
                        } catch (err) {
                          console.error(err);
                          alert(err.response?.data?.detail || "Failed to complete destination.");
                        } finally {
                          setProgressionLoading(false);
                        }
                      }}
                      disabled={progressionLoading}
                      className="suggestion-action-btn"
                    >
                      {progressionLoading ? "Updating..." : "✓ Mark Completed"}
                    </button>
                  </div>
                </motion.div>
              )}
              </AnimatePresence>

              {/* Trip Progress Bar */}
              {(() => {
                const allActs = [];
                itinerary.daily_plans.forEach((dayPlan) => {
                  (dayPlan.activities || []).forEach((activity) => {
                    allActs.push(activity);
                  });
                });

                const skippedCount = allActs.filter(a => a.status === "skipped").length;
                const completedCount = allActs.filter(a => a.status === "completed").length;
                const activeTotal = allActs.length - skippedCount;
                const percentage = activeTotal > 0 ? Math.round((completedCount / activeTotal) * 100) : 0;

                const filledWidth = Math.round(percentage / 10);
                const emptyWidth = 10 - filledWidth;
                const filledBlocks = "█".repeat(filledWidth);
                const emptyBlocks = "░".repeat(emptyWidth);

                return (
                  <motion.div 
                    className="trip-progress-box"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                  >
                    <div className="progress-box-header">
                      <span className="progress-title">Trip Progress</span>
                      <span className="progress-percentage">{percentage}%</span>
                    </div>

                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
                    </div>

                    <div className="retro-progress-bar">
                      <span className="retro-progress-filled">{filledBlocks}</span>
                      <span>{emptyBlocks}</span>
                    </div>

                    <div className="progress-info-text">
                      <strong>{completedCount}</strong> of <strong>{activeTotal}</strong> destinations completed {skippedCount > 0 && <span className="skipped-note" style={{ color: "#64748b", fontSize: "11px", marginLeft: "4px" }}>({skippedCount} skipped)</span>}
                    </div>
                  </motion.div>
                );
              })()}
            </div>

            {/* Right Column: Visual Timeline */}
            <div className="progress-timeline-col">
              <div className="timeline-days-wrapper">
                {itinerary.daily_plans.map((dayPlan) => {
                  const dayActivities = dayPlan.activities || [];
                  if (dayActivities.length === 0) return null;

                  return (
                    <motion.div 
                      key={dayPlan.day} 
                      className="timeline-day-block"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: dayPlan.day * 0.1, duration: 0.4 }}
                    >
                      <h4>Day {dayPlan.day}{dayPlan.date ? ` · ${dayPlan.date}` : ""}</h4>
                      
                      <div className="timeline-activities">
                        {dayActivities.map((activity, actIdx) => {
                          const status = activity.status || "upcoming";
                          
                          const details = getActivityTypeDetails(activity);
                          let statusIcon = details.emoji;
                          
                          const dayEndpoints = dailyEndpoints[dayPlan.day];
                          const isStart = dayEndpoints && activity.place_name === dayEndpoints.start;
                          const isEnd = dayEndpoints && activity.place_name === dayEndpoints.end;

                          if (status === "completed") statusIcon = "✓";
                          else if (status === "current") statusIcon = "➜";
                          else if (status === "skipped") statusIcon = "✕";

                          return (
                            <div 
                              key={actIdx} 
                              className={`timeline-activity-row ${status}`}
                            >
                              <span className={`timeline-status-icon ${status}`}>
                                {statusIcon}
                              </span>
                              <div className="timeline-activity-info">
                                <div className="timeline-activity-title" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span>{activity.place_name || "Activity"}</span>
                                  {isStart && <span className="endpoint-badge start-badge">🏁 START</span>}
                                  {isEnd && <span className="endpoint-badge end-badge">🏁 END</span>}
                                </div>
                                <div className="timeline-activity-time">
                                  {activity.time || "Flexible"}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

          </div>
        </motion.section>
      )}

      {showFollowersCard && isOwner && (
        <section className="collab-section" style={{ maxWidth: "1180px", margin: "0 auto 18px" }}>
          <div className="link-follower-card" style={{
            maxWidth: "650px",
            margin: "20px auto",
            background: "rgba(255, 255, 255, 0.95)",
            padding: "25px",
            borderRadius: "16px",
            boxShadow: "0 6px 30px rgba(0, 0, 0, 0.15)",
            border: "1px solid #e2e8f0"
          }}>
            <h3 style={{ marginTop: 0, color: "#1e293b", fontSize: "20px", fontWeight: "600", marginBottom: "10px", textAlign: "center" }}>Link Follower (Optional)</h3>
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px", textAlign: "center" }}>
              Add travel buddies to your trip. They will be linked as followers. Send the invite code to their email, enter the code below to verify them, and click **Done** when finished.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "20px" }}>
              {followers.map((follower, index) => (
                <div key={index} style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "16px",
                  position: "relative"
                }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", color: "#334155" }}>Buddy #{index + 1}</h4>
                  
                  {/* Email Input row */}
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="email"
                      placeholder="Follower's Email Address"
                      value={follower.email}
                      onChange={(e) => handleFollowerEmailChange(index, e.target.value)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "14px"
                      }}
                      disabled={follower.invited}
                      required
                    />
                    {!follower.invited && (
                      <button
                        type="button"
                        disabled={follower.loadingInvite}
                        onClick={() => handleSendInvite(index)}
                        className="saved-trip-primary-btn"
                        style={{ padding: "10px 18px", fontSize: "13px" }}
                      >
                        {follower.loadingInvite ? "Sending..." : "Send Invite"}
                      </button>
                    )}
                  </div>

                  {/* Verification Row (only visible if invited and not verified) */}
                  {follower.invited && !follower.verified && (
                    <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
                      <input
                        type="text"
                        placeholder="6-digit OTP Code"
                        maxLength={6}
                        value={follower.otp}
                        onChange={(e) => handleFollowerOtpChange(index, e.target.value.replace(/\D/g, ""))}
                        style={{
                          width: "140px",
                          padding: "10px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px"
                        }}
                        disabled={follower.loadingVerify}
                      />
                      <button
                        type="button"
                        disabled={follower.loadingVerify}
                        onClick={() => handleVerifyOtp(index)}
                        className="saved-trip-primary-btn"
                        style={{ padding: "10px 18px", fontSize: "13px", background: "#10b981" }}
                      >
                        {follower.loadingVerify ? "Verifying..." : "Verify Code"}
                      </button>
                    </div>
                  )}

                  {/* Status / Success Messages */}
                  {follower.message && (
                    <div style={{ marginTop: "10px", color: "#16a34a", fontSize: "13px", fontWeight: "500" }}>
                      ✓ {follower.message}
                    </div>
                  )}
                  {follower.error && (
                    <div style={{ marginTop: "10px", color: "#dc2626", fontSize: "13px", fontWeight: "500" }}>
                      ⚠ {follower.error}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={addFollowerField}
                className="saved-trip-secondary-btn"
                style={{ padding: "10px 18px" }}
              >
                + Add More Buddy
              </button>
              
              <button
                type="button"
                onClick={handleDoneFinalizing}
                className="saved-trip-primary-btn"
                style={{ padding: "10px 24px", background: "#4f46e5" }}
              >
                Done
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 2. Live Location Map & Leader Location Simulator */}
      <section className="map-container-wrapper">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px", marginBottom: "5px" }}>
          <h3 style={{ margin: 0 }}>📍 Multi-Member Live Tracking Map</h3>
          
          <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "600", color: "#1e293b", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isSharingLocal}
                onChange={handleSharingToggle}
                style={{ width: "16px", height: "16px" }}
              />
              Share Live Location
            </label>
            
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "600", color: "#1e293b", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={followLeader}
                onChange={(e) => setFollowLeader(e.target.checked)}
                style={{ width: "16px", height: "16px" }}
              />
              Follow Leader Mode
            </label>
          </div>
        </div>

        <p style={{ fontSize: "14px", color: "#64748b", margin: "0 0 14px 0" }}>
          Red marker indicates the Leader's live location. Other colors represent members' live positions. Blue markers represent planned itinerary activities.
        </p>

        {locationError && (
          <div style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#991b1b",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "15px",
            fontSize: "14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span>{locationError}</span>
            <button
              onClick={handleRetryLocation}
              style={{
                background: "#dc2626",
                color: "white",
                border: "none",
                padding: "6px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600"
              }}
            >
              Retry
            </button>
          </div>
        )}

        <div style={{ height: "400px", width: "100%", borderRadius: "12px", overflow: "hidden", marginBottom: "15px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
          <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            <ChangeMapView center={followLeader ? mapCenter : null} />
            <MapZoomListener onChangeZoom={setZoomLevel} />

            {/* Activities plan markers */}
            {mapPlaces.map((place, idx) => (
              <Marker key={idx} position={[place.lat, place.lon]}>
                <Popup>
                  <strong>{place.place_name}</strong><br />
                  Day {place.day} - {place.time}
                </Popup>
              </Marker>
            ))}

            {/* Render Clustered Member Markers */}
            {clusteredLocations.map((cluster, cIdx) => {
              if (cluster.members.length === 1) {
                const member = cluster.members[0];
                const isOffline = member.status === "Offline";
                const distText = member.role === "owner" ? "0.0 km (Leader)" : member.distance_from_leader;
                const timeText = formatLastUpdated(member.last_updated, isOffline);
                
                return (
                  <Marker 
                    key={`member-single-${cIdx}-${member.user_id}`} 
                    position={[member.latitude, member.longitude]} 
                    icon={member.icon}
                  >
                    <Popup>
                      <div style={{ fontSize: "13px", lineHeight: "1.4" }}>
                        <strong>👤 {member.username}</strong><br />
                        <strong>Role:</strong> {member.role === "owner" ? "Leader" : member.role}<br />
                        <strong>Status:</strong> <span style={{ color: member.status === "Online" ? "#16a34a" : "#dc2626", fontWeight: "600" }}>{member.status}</span><br />
                        <strong>Last Updated:</strong> {timeText}<br />
                        <strong>Distance from Leader:</strong> {distText}
                      </div>
                    </Popup>
                  </Marker>
                );
              } else {
                return (
                  <Marker
                    key={`member-cluster-${cIdx}`}
                    position={[cluster.centerLat, cluster.centerLon]}
                    icon={createClusterIcon(cluster.members.length)}
                  >
                    <Popup>
                      <div style={{ maxHeight: "160px", overflowY: "auto", fontSize: "13px" }}>
                        <strong>👥 {cluster.members.length} Members in this area:</strong>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                          {cluster.members.map(m => {
                            const isOffline = m.status === "Offline";
                            const distText = m.role === "owner" ? "0.0 km" : m.distance_from_leader;
                            return (
                              <div key={m.user_id} style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "4px" }}>
                                <strong>{m.username}</strong> ({m.role === "owner" ? "Leader" : m.role})<br />
                                Status: <span style={{ color: m.status === "Online" ? "#16a34a" : "#dc2626" }}>{m.status}</span> | Dist: {distText}<br />
                                <span style={{ fontSize: "11px", color: "#64748b" }}>{formatLastUpdated(m.last_updated, isOffline)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              }
            })}
          </MapContainer>
        </div>

        {/* Dynamic Legend and Destination Arrival Tracker */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "15px" }}>
          {/* Map Legend */}
          <div className="map-legend" style={{
            padding: "16px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            fontSize: "13px",
            color: "#475569",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#1e293b", fontSize: "14px" }}>🗺️ Map Legend</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: "#ef4444", border: "1px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}></span>
                <strong>Trip Leader</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: "#22c55e", border: "1px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}></span>
                <strong>Active Members</strong> (Green, Gold, Violet, Orange)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: "#3b82f6", border: "1px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}></span>
                <strong>Planned Activities</strong> (Blue)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: "#94a3b8", border: "1px solid white", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}></span>
                <strong>Offline / Sharing Disabled</strong>
              </div>
            </div>
          </div>

          {/* Arrival Detection Tracker */}
          {targetDest && (
            <div className="arrival-tracker-panel">
              <h4 className="arrival-panel-title">
                📍 Arrival Tracker
              </h4>
              
              <div className="tracking-target-section">
                {currentActiveDestination ? (
                  <div className="active-target-info">
                    <span className="active-target-badge">Active</span>{" "}
                    <span className="target-name">{currentActiveDestination.place_name}</span>
                  </div>
                ) : (
                  <div className="select-target-info">
                    <span className="target-label">Destination:</span>
                    <select
                      value={selectedDestinationIndex}
                      onChange={(e) => setSelectedDestinationIndex(Number(e.target.value))}
                      className="target-select"
                    >
                      {mapPlaces.map((place, idx) => (
                        <option key={idx} value={idx}>
                          Day {place.day}: {place.place_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              {/* Leader presence indicator inside the Arrival Tracker panel */}
              <div className="leader-status-box">
                <div className={`leader-presence-badge ${leaderArrived ? "present" : "away"}`}>
                  {leaderArrived ? "🟢 Leader Present" : "🔴 Leader Away"}
                </div>
                {leaderArrived && leaderStayDuration !== null && (
                  <div className="leader-stay-info">
                    <span className="stay-label">Stay Duration:</span>
                    <span className="stay-value">⏱ {formatDuration(leaderStayDuration)}</span>
                  </div>
                )}
              </div>
              
              <div className="members-arrival-list">
                {(() => {
                  const activeDay = currentAct?.day || 1;
                  const dayEndpoints = dailyEndpoints[activeDay];
                  const startPlace = flatActivities.find(a => a.day === activeDay && dayEndpoints && a.place_name === dayEndpoints.start);
                  const endPlace = flatActivities.find(a => a.day === activeDay && dayEndpoints && a.place_name === dayEndpoints.end);

                  return sortedArrivals.map((m, idx) => {
                    const isLeader = m.role === "owner";
                    const loc = (memberLocations || []).find(l => l.user_id === m.user_id);
                    
                    let endpointBadge = null;
                    if (loc && loc.is_sharing) {
                      if (startPlace && startPlace.lat !== null && startPlace.lon !== null) {
                        const distStart = haversineDistance(loc.latitude, loc.longitude, startPlace.lat, startPlace.lon);
                        if (distStart !== null && distStart <= 0.15) {
                          endpointBadge = <span className="endpoint-arrival-badge start">📍 At Start</span>;
                        }
                      }
                      if (!endpointBadge && endPlace && endPlace.lat !== null && endPlace.lon !== null) {
                        const distEnd = haversineDistance(loc.latitude, loc.longitude, endPlace.lat, endPlace.lon);
                        if (distEnd !== null && distEnd <= 0.15) {
                          endpointBadge = <span className="endpoint-arrival-badge end">🏁 At End</span>;
                        }
                      }
                    }

                    return (
                      <div key={idx} className={`member-arrival-row ${isLeader ? "is-leader" : ""}`}>
                        <span className="member-name-col">
                          {isLeader ? "👑 " : m.arrived ? "✓ " : "○ "}
                          <span className="username-text">{m.username}</span>
                          <small className="role-tag">
                            {isLeader ? "Leader" : m.role === "follower" ? "buddy" : m.role}
                          </small>
                          {endpointBadge}
                        </span>
                        <span className={`arrival-status-badge ${m.arrived ? "arrived" : m.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                          {m.status}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
              
              <div className="arrival-tracker-footer">
                👥 {arrivedCount} of {activeMembersForArrival.length} active members present
              </div>
            </div>
          )}
        </div>

        {/* Location Simulator Panel (Visible to editors & leader) */}
        {canEdit && (
          <div className="simulator-panel">
            <h4>⚙️ Live Location Simulator Panel ({isOwner ? "Leader" : "Member"})</h4>
            <p style={{ fontSize: "12px", color: "#475569", margin: "-6px 0 10px 0" }}>
              Test proximity tracking: Teleport to place and simulation of moving away.
            </p>
            {mapPlaces.length === 0 ? (
              <p style={{ color: "#ef4444", fontSize: "13px" }}>No places with coordinates are in the itinerary. Please edit saved trip to add coordinates first!</p>
            ) : (
              <div className="simulator-controls">
                <label style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  Destination:
                  <select
                    value={selectedSimPlaceIndex}
                    onChange={(e) => setSelectedSimPlaceIndex(Number(e.target.value))}
                    style={{ padding: "4px 8px" }}
                  >
                    {mapPlaces.map((place, idx) => (
                      <option key={idx} value={idx}>
                        Day {place.day}: {place.place_name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={handleSimulateArrive} className="saved-trip-primary-btn" style={{ padding: "6px 12px", background: "#059669" }}>
                  Teleport (Arrive)
                </button>
                <button type="button" onClick={handleSimulateLeave} className="saved-trip-danger-btn" style={{ padding: "6px 12px" }}>
                  Move Away (Leave)
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Expense Log & splits settlement table */}
      <section className="expense-section">
        <h3>💰 Trip Expenses & Bills Settlement</h3>
        <div className="expense-grid">
          
          {/* Expenses List */}
          <div className="expense-list-container">
            <h4>Logged Expenses</h4>
            <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
              <table className="expense-table">
                <thead>
                  <tr>
                    <th>Who</th>
                    <th>Where</th>
                    <th>Amount</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {(expensesData.expenses || []).length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", color: "#64748b" }}>No expenses logged yet.</td>
                    </tr>
                  ) : (
                    expensesData.expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td><strong>{exp.username}</strong></td>
                        <td>{exp.place_name}</td>
                        <td>Rs. {exp.amount}</td>
                        <td style={{ color: "#64748b", fontSize: "12px" }}>{exp.description}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Manual expense submission */}
            <form onSubmit={handleManualExpenseSubmit} className="expense-form">
              <h4>Log Custom Expense</h4>
              <div className="expense-form-row">
                <input
                  type="text"
                  placeholder="Place Name"
                  required
                  value={manualPlace}
                  onChange={(e) => setManualPlace(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Amount (Rs.)"
                  required
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                />
              </div>
              <input
                type="text"
                placeholder="Description (Optional)"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
              />
              <button type="submit" className="saved-trip-primary-btn" style={{ alignSelf: "flex-end" }}>Add Expense</button>
            </form>
          </div>

          {/* Expense Split & settlement calculations */}
          <div className="expense-split-container">
            <h4>Bill Split Summary</h4>
            <div className="split-summary-box">
              <div className="split-summary-item">
                <span>Total Spent</span>
                <strong>Rs. {expensesData.total_spent || 0}</strong>
              </div>
              <div className="split-summary-item">
                <span>Per-Person Share</span>
                <strong>Rs. {expensesData.share_per_person || 0}</strong>
              </div>
            </div>

            <h4>How to Settle the Bills</h4>
            {(expensesData.splits || []).length === 0 ? (
              <p style={{ color: "#059669", fontStyle: "italic", fontSize: "14px", marginTop: "10px" }}>
                Everyone is even! No transactions required.
              </p>
            ) : (
              <ul className="splits-list">
                {expensesData.splits.map((split, idx) => (
                  <li key={idx}>
                    <strong>{split.from_username}</strong> owes <strong>{split.to_username}</strong> Rs. {split.amount}
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </section>

      {/* Decision strips and suggestion components */}
      <DecisionSummary decisions={decisions} />
      <VotingBoard groupedSuggestions={groupedSuggestions} onVote={actions.vote} onReact={actions.react} onFinalize={actions.finalize} canFinalize={isOwner} />
      {canEdit && <SuggestionFeed suggestions={suggestions} onAddSuggestion={actions.addSuggestion} onComment={actions.comment} />}
      <ActivityRanking activities={activities} onRank={actions.rank} />

      {/* 4. Collapsible Group Chat Panel */}
      <div className={`group-chat-widget ${chatCollapsed ? "collapsed" : "expanded"}`}>
        <div className="chat-header" onClick={() => setChatCollapsed(!chatCollapsed)}>
          <div className="chat-header-title">
            💬 Group Chat {chatCollapsed && unreadCount > 0 && <span className="unread-badge">({unreadCount})</span>}
          </div>
          <button className="chat-toggle-btn">
            {chatCollapsed ? "▲" : "▼"}
          </button>
        </div>
        
        {!chatCollapsed && (
          <>
            <div className="chat-messages-container">
              {chatMessages.length === 0 ? (
                <div className="chat-empty-state">No messages yet. Send a message to start!</div>
              ) : (
                chatMessages.map((msg) => {
                  const currentUserId = (() => {
                    try {
                      const userStr = localStorage.getItem("user");
                      return userStr ? JSON.parse(userStr).id : null;
                    } catch {
                      return null;
                    }
                  })();
                  const isOwn = msg.user_id === currentUserId;
                  const memberLoc = memberLocations.find((l) => l.user_id === msg.user_id);
                  const isOnline = memberLoc ? memberLoc.status === "Online" : false;
                  
                  if (msg.message_type === "system") {
                    return (
                      <div key={msg.id} className="chat-msg system-msg">
                        <span className="system-msg-text">{msg.message}</span>
                      </div>
                    );
                  }
                  
                  return (
                    <div 
                      key={msg.id} 
                      className={`chat-msg ${isOwn ? "own-msg" : "other-msg"} ${
                        msg.message_type === "announcement" ? "announcement-msg" : ""
                      }`}
                    >
                      <div className="msg-sender">
                        <span className={`presence-dot ${isOnline ? "online" : "offline"}`} title={isOnline ? "Online" : "Offline"}></span>
                        <strong>{msg.username}</strong>
                        {msg.message_type === "announcement" && <span className="announcement-tag">📢 Announcement</span>}
                      </div>
                      <div className="msg-bubble">
                        {msg.message}
                      </div>
                      <div className="msg-timestamp">
                        {formatTime(msg.created_at)}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing Indicator */}
            {Object.values(typingUsers).length > 0 && (
              <div className="chat-typing-indicator">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <small>{getTypingText()}</small>
              </div>
            )}

            {/* Chat Input area */}
            <form onSubmit={handleSendMessage} className="chat-input-form">
              {isOwner && (
                <div className="chat-type-toggle">
                  <label>
                    <input 
                      type="radio" 
                      name="msg_type" 
                      value="text" 
                      checked={msgType === "text"} 
                      onChange={() => setMsgType("text")}
                    />
                    Text
                  </label>
                  <label>
                    <input 
                      type="radio" 
                      name="msg_type" 
                      value="announcement" 
                      checked={msgType === "announcement"} 
                      onChange={() => setMsgType("announcement")}
                    />
                    Announcement
                  </label>
                </div>
              )}
              <div className="chat-input-row">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={handleInputChange}
                  maxLength={1000}
                  required
                />
                <button type="submit">Send</button>
              </div>
            </form>
          </>
        )}
      </div>
      {successToast && (
        <div className="custom-toast">
          <span>{successToast}</span>
        </div>
      )}
    </main>
  );
}
