import { useCallback, useEffect, useMemo, useState } from "react";
import api, { API_BASE_URL } from "../api";

export default function useTripCollaboration(tripId) {
  const [dashboard, setDashboard] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [decisions, setDecisions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError("");
    try {
      const [dashboardRes, suggestionsRes, decisionsRes] = await Promise.all([
        api.get(`/api/trips/${tripId}/collaboration/dashboard`),
        api.get(`/api/trips/${tripId}/collaboration/suggestions`, { params: { page_size: 50 } }),
        api.get(`/api/trips/${tripId}/collaboration/decisions`),
      ]);
      setDashboard(dashboardRes.data);
      setSuggestions(suggestionsRes.data.items || []);
      setDecisions(decisionsRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load collaboration data");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!tripId || !token) return undefined;
    const wsBase = API_BASE_URL.replace("http://", "ws://").replace("https://", "wss://");
    const socket = new WebSocket(`${wsBase}/ws/trips/${tripId}?token=${encodeURIComponent(token)}`);
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (["suggestion_added", "vote_updated", "reaction_updated", "comment_added", "member_joined", "trip_updated", "trip_finalized"].includes(message.event)) {
        loadAll();
      }
    };
    return () => socket.close();
  }, [tripId, loadAll]);

  const inviteMembers = async (emails, role) => {
    const response = await api.post(`/api/trips/${tripId}/collaboration/invitations`, { emails, role });
    await loadAll();
    return response.data;
  };

  const addSuggestion = async (payload) => {
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
    await api.patch(`/api/trips/${tripId}/collaboration/voting`, { voting_locked });
    await loadAll();
  };

  const finalize = async (suggestion) => {
    await api.post(`/api/trips/${tripId}/collaboration/finalize/${suggestion.id}`);
    await loadAll();
  };

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
    loading,
    error,
    actions: { inviteMembers, addSuggestion, vote, rank, react, comment, setVotingLocked, finalize, reload: loadAll },
  };
}
