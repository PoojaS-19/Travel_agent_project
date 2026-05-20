const labels = {
  destination: "Destinations",
  hotel: "Hotels",
  restaurant: "Restaurants",
  activity: "Activities",
};

export default function VotingBoard({ groupedSuggestions, onVote, onReact, onFinalize, canFinalize }) {
  return (
    <section className="collab-section">
      <div className="collab-section-title">
        <h2>Voting board</h2>
        <span>Live group preference signals</span>
      </div>
      <div className="voting-columns">
        {Object.entries(labels).map(([type, title]) => (
          <div className="vote-column" key={type}>
            <h3>{title}</h3>
            {(groupedSuggestions[type] || []).length === 0 && <p className="empty-state">No suggestions yet.</p>}
            {(groupedSuggestions[type] || []).map((suggestion) => (
              <article className="vote-card" key={suggestion.id}>
                <div>
                  <strong>{suggestion.title}</strong>
                  <p>{suggestion.location || suggestion.description || "Group idea"}</p>
                </div>
                <div className="vote-score">{suggestion.score}</div>
                <div className="vote-actions">
                  <button onClick={() => onVote(suggestion, "up")}>👍 {suggestion.vote_summary.upvotes}</button>
                  <button onClick={() => onVote(suggestion, "down")}>👎 {suggestion.vote_summary.downvotes}</button>
                  {["❤️", "🔥", "✨"].map((emoji) => (
                    <button key={emoji} onClick={() => onReact(suggestion, emoji)}>{emoji} {suggestion.reaction_summary.counts[emoji] || 0}</button>
                  ))}
                  {canFinalize && <button onClick={() => onFinalize(suggestion)}>Finalize</button>}
                </div>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
