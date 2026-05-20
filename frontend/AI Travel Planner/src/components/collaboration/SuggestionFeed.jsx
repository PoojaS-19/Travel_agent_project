import { useState } from "react";

export default function SuggestionFeed({ suggestions, onAddSuggestion, onComment }) {
  const [form, setForm] = useState({
    suggestion_type: "activity",
    title: "",
    description: "",
    estimated_cost: "",
    location: "",
    tags: "",
  });
  const [commentDrafts, setCommentDrafts] = useState({});

  const submit = async (event) => {
    event.preventDefault();
    await onAddSuggestion({
      ...form,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    });
    setForm({ suggestion_type: "activity", title: "", description: "", estimated_cost: "", location: "", tags: "" });
  };

  return (
    <section className="collab-section feed-layout">
      <form className="suggestion-form" onSubmit={submit}>
        <h2>Suggest an idea</h2>
        <select value={form.suggestion_type} onChange={(event) => setForm({ ...form, suggestion_type: event.target.value })}>
          <option value="destination">Destination</option>
          <option value="hotel">Hotel</option>
          <option value="restaurant">Restaurant</option>
          <option value="activity">Activity</option>
        </select>
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title" required />
        <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location" />
        <input value={form.estimated_cost} onChange={(event) => setForm({ ...form, estimated_cost: event.target.value })} placeholder="Estimated cost" type="number" min="0" />
        <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Tags, comma separated" />
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Why should the group consider it?" />
        <button type="submit">Add suggestion</button>
      </form>

      <div className="suggestion-feed">
        <h2>Suggestion feed</h2>
        {suggestions.length === 0 && <p className="empty-state">Start with a destination, stay, meal, or activity idea.</p>}
        {suggestions.map((suggestion) => (
          <article className="feed-item" key={suggestion.id}>
            <div className="feed-item-header">
              <span>{suggestion.suggestion_type}</span>
              <strong>{suggestion.title}</strong>
            </div>
            <p>{suggestion.description || suggestion.location}</p>
            <div className="tag-row">
              {(suggestion.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
            </div>
            <form
              className="comment-row"
              onSubmit={async (event) => {
                event.preventDefault();
                const body = commentDrafts[suggestion.id];
                if (!body) return;
                await onComment(suggestion, body);
                setCommentDrafts({ ...commentDrafts, [suggestion.id]: "" });
              }}
            >
              <input
                value={commentDrafts[suggestion.id] || ""}
                onChange={(event) => setCommentDrafts({ ...commentDrafts, [suggestion.id]: event.target.value })}
                placeholder={`${suggestion.comment_count} comments`}
              />
              <button type="submit">Reply</button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
