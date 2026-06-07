import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import api, { API_BASE_URL } from "../api";

export default function useTripCollaboration(tripId) {
  const [dashboard, setDashboard] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [decisions, setDecisions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expensesData, setExpensesData] = useState({ total_spent: 0, share_per_person: 0, expenses: [], splits: [] });
  const [leaderLocation, setLeaderLocation] = useState(null);
  const [memberLocations, setMemberLocations] = useState([]);
  const [expensePromptPlace, setExpensePromptPlace] = useState(null);
  const [itinerary, setItinerary] = useState(null);

  // Chat features states
  const [chatMessages, setChatMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef(null);

  const loadExpenses = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await api.get(`/api/trips/${tripId}/expenses`);
      setExpensesData(res.data);
    } catch (err) {
      console.error("Failed to load expenses:", err);
    }
  }, [tripId]);

  const loadLeaderLocation = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await api.get(`/api/trips/${tripId}/leader-location`);
      setLeaderLocation(res.data);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("Failed to load leader location:", err);
      }
    }
  }, [tripId]);

  const loadMemberLocations = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await api.get(`/api/trips/${tripId}/locations`);
      setMemberLocations(res.data);
    } catch (err) {
      console.error("Failed to load member locations:", err);
    }
  }, [tripId]);

  const loadChatHistory = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await api.get(`/api/trips/${tripId}/chat`);
      setChatMessages(res.data);
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  }, [tripId]);

  const loadAll = useCallback(async () => {
    if (!tripId) {
      setError("Invalid trip selected");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [dashboardRes, suggestionsRes, decisionsRes, itineraryRes] = await Promise.all([
        api.get(`/api/trips/${tripId}/collaboration/dashboard`),
        api.get(`/api/trips/${tripId}/collaboration/suggestions`, { params: { page_size: 50 } }),
        api.get(`/api/trips/${tripId}/collaboration/decisions`),
        api.get(`/itineraries/${tripId}`).catch(() => null),
      ]);
      setDashboard(dashboardRes.data);
      setSuggestions(suggestionsRes.data.items || []);
      setDecisions(decisionsRes.data);
      if (itineraryRes) setItinerary(itineraryRes.data);
      await Promise.all([loadExpenses(), loadLeaderLocation(), loadMemberLocations(), loadChatHistory()]);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setError("Trip not found");
      } else if (status === 403) {
        setError("You do not have access to this trip");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, loadExpenses, loadLeaderLocation, loadMemberLocations, loadChatHistory]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Clean up typing status automatically after 4 seconds of inactivity
  useEffect(() => {
    const timer = setInterval(() => {
      const cutoff = Date.now() - 4000;
      setTypingUsers((prev) => {
        let changed = false;
        const next = {};
        for (const [uid, info] of Object.entries(prev)) {
          if (info.timestamp > cutoff) {
            next[uid] = info;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!tripId || !token) return undefined;
    const wsBase = API_BASE_URL.replace("http://", "ws://").replace("https://", "wss://");
    const socket = new WebSocket(`${wsBase}/ws/trips/${tripId}?token=${encodeURIComponent(token)}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const payload = message.payload || message;
      if (message.event === "leader_location_updated") {
        setLeaderLocation({ lat: payload.lat, lon: payload.lon });
        loadMemberLocations();
      } else if (message.event === "member_locations_updated") {
        setMemberLocations(payload.locations || []);
      } else if (message.event === "expense_updated") {
        loadExpenses();
      } else if (message.event === "ask_expense") {
        setExpensePromptPlace(payload.place_name);
      } else if (message.event === "presence") {
        loadMemberLocations();
      } else if (message.event === "chat_message") {
        setChatMessages((prev) => {
          // De-duplicate messages using both DB id and client message_uuid
          if (prev.some((m) => m.id === payload.id || (payload.message_uuid && m.message_uuid === payload.message_uuid))) {
            return prev;
          }
          return [
            ...prev,
            {
              id: payload.id,
              user_id: payload.user_id,
              username: payload.username,
              message: payload.message,
              message_type: payload.message_type,
              message_uuid: payload.message_uuid,
              is_pinned: payload.is_pinned,
              created_at: payload.timestamp,
            },
          ];
        });
      } else if (message.event === "chat_typing") {
        const { user_id, username, is_typing } = payload;
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (is_typing) {
            next[user_id] = { username, timestamp: Date.now() };
          } else {
            delete next[user_id];
          }
          return next;
        });
      } else if (["suggestion_added", "vote_updated", "reaction_updated", "comment_added", "member_joined", "trip_updated", "trip_finalized"].includes(message.event)) {
        loadAll();
      } else if (message.event === "itinerary_progress_updated") {
        api.get(`/itineraries/${tripId}`)
          .then((res) => setItinerary(res.data))
          .catch((err) => console.error("Failed to load itinerary on progress update event:", err));
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [tripId, loadAll, loadExpenses, loadMemberLocations]);

  const inviteMembers = async (emails, role) => {
    if (!tripId) throw new Error("Invalid trip selected");
    const response = await api.post(`/api/trips/${tripId}/collaboration/invitations`, { emails, role });
    await loadAll();
    return response.data;
  };

  const addSuggestion = async (payload) => {
    if (!tripId) throw new Error("Invalid trip selected");
    const optimistic = {
      id: `tmp-${Date.now()}`,
      ...payload,
      created_at: new Date().toISOString(),
      vote_summary: { upvotes: 0, downvotes: 0 },
      reaction_summary: { counts: {}, mine: [] },
      comment_count: 0,
      score: 0,
    };
    setSuggestions((current) => [optimistic, ...current]);
    try {
      await api.post(`/api/trips/${tripId}/collaboration/suggestions`, payload);
      await loadAll();
    } catch (err) {
      setSuggestions((current) => current.filter((item) => item.id !== optimistic.id));
      throw err;
    }
  };

  const vote = async (suggestion, vote_value) => {
    setSuggestions((current) =>
      current.map((item) =>
        item.id === suggestion.id
          ? {
              ...item,
              vote_summary: {
                ...item.vote_summary,
                my_vote: vote_value,
                upvotes: vote_value === "up" ? item.vote_summary.upvotes + 1 : item.vote_summary.upvotes,
                downvotes: vote_value === "down" ? item.vote_summary.downvotes + 1 : item.vote_summary.downvotes,
              },
            }
          : item
      )
    );
    await api.put(`/api/collaboration/suggestions/${suggestion.id}/vote`, { vote_value });
    await loadAll();
  };

  const rank = async (suggestion, ranking) => {
    await api.put(`/api/collaboration/suggestions/${suggestion.id}/vote`, { ranking });
    await loadAll();
  };

  const react = async (suggestion, emoji) => {
    await api.post(`/api/collaboration/suggestions/${suggestion.id}/reactions`, { emoji });
    await loadAll();
  };

  const comment = async (suggestion, body) => {
    await api.post(`/api/collaboration/suggestions/${suggestion.id}/comments`, { body });
    await loadAll();
  };

  const setVotingLocked = async (voting_locked) => {
    if (!tripId) throw new Error("Invalid trip selected");
    await api.patch(`/api/trips/${tripId}/collaboration/voting`, { voting_locked });
    await loadAll();
  };

  const finalize = async (suggestion) => {
    await api.post(`/api/trips/${tripId}/collaboration/finalize/${suggestion.id}`);
    await loadAll();
  };

  const updateLeaderLocation = async (lat, lon) => {
    if (!tripId) return;
    await api.post(`/api/trips/${tripId}/leader-location`, { lat, lon });
  };

  const updateMemberLocation = async (lat, lon) => {
    if (!tripId) return;
    const response = await api.post(`/api/trips/${tripId}/locations`, { latitude: lat, longitude: lon });
    return response.data;
  };

  const toggleSharingStatus = async (isSharing) => {
    if (!tripId) return;
    const response = await api.patch(`/api/trips/${tripId}/collaboration/members/me/sharing`, null, {
      params: { is_sharing: isSharing }
    });
    return response.data;
  };

  const addExpense = async (place_name, amount, description = "") => {
    if (!tripId) return;
    await api.post(`/api/trips/${tripId}/expenses`, { place_name, amount, description });
  };

  const sendChatMessage = async (messageText, messageType = "text") => {
    if (!tripId) throw new Error("Invalid trip selected");
    
    // Generate UUID
    const uuid = typeof crypto !== "undefined" && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Parse current user from local storage
    let currentUserId = 0;
    let currentUsername = "Me";
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const parsed = JSON.parse(userStr);
        currentUserId = parsed.id || 0;
        currentUsername = parsed.username || "Me";
      }
    } catch (err) {
      console.error("Error parsing user from localStorage:", err);
    }
    
    const optimisticMsg = {
      id: `opt-${uuid}`,
      user_id: currentUserId,
      username: currentUsername,
      message: messageText,
      message_type: messageType,
      message_uuid: uuid,
      is_pinned: false,
      created_at: new Date().toISOString(),
    };
    
    // Optimistic append
    setChatMessages((prev) => [...prev, optimisticMsg]);
    
    try {
      const res = await api.post(`/api/trips/${tripId}/chat`, {
        message: messageText,
        message_type: messageType,
        message_uuid: uuid,
      });
      
      // Update with server details
      setChatMessages((prev) =>
        prev.map((m) => (m.message_uuid === uuid ? res.data : m))
      );
      return res.data;
    } catch (err) {
      // Rollback optimistic update
      setChatMessages((prev) => prev.filter((m) => m.message_uuid !== uuid));
      throw err;
    }
  };

  const sendTypingStatus = useCallback((isTyping) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: "chat_typing",
          payload: { is_typing: isTyping }
        })
      );
    }
  }, []);

  const groupedSuggestions = useMemo(
    () =>
      suggestions.reduce((groups, suggestion) => {
        groups[suggestion.suggestion_type] = groups[suggestion.suggestion_type] || [];
        groups[suggestion.suggestion_type].push(suggestion);
        return groups;
      }, {}),
    [suggestions]
  );

  return {
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
    actions: { 
      inviteMembers, 
      addSuggestion, 
      vote, 
      rank, 
      react, 
      comment, 
      setVotingLocked, 
      finalize, 
      updateLeaderLocation, 
      updateMemberLocation,
      toggleSharingStatus,
      addExpense, 
      sendChatMessage,
      sendTypingStatus,
      completeDestination: async (place_name) => {
        if (!tripId) return;
        const res = await api.post(`/api/trips/${tripId}/itinerary/complete`, { place_name });
        try {
          const itRes = await api.get(`/itineraries/${tripId}`);
          setItinerary(itRes.data);
        } catch (err) {
          console.error("Failed to load itinerary after complete:", err);
        }
        return res.data;
      },
      skipDestination: async (place_name) => {
        if (!tripId) return;
        const res = await api.post(`/api/trips/${tripId}/itinerary/skip`, { place_name });
        try {
          const itRes = await api.get(`/itineraries/${tripId}`);
          setItinerary(itRes.data);
        } catch (err) {
          console.error("Failed to load itinerary after skip:", err);
        }
        return res.data;
      },
      reload: loadAll 
    },
  };
}
