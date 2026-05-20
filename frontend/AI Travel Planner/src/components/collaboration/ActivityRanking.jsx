export default function ActivityRanking({ activities, onRank }) {
  return (
    <section className="collab-section">
      <div className="collab-section-title">
        <h2>Activity ranking</h2>
        <span>1 is highest priority</span>
      </div>
      <div className="ranking-list">
        {(activities || []).length === 0 && <p className="empty-state">Add activities to start ranking.</p>}
        {(activities || []).map((activity) => (
          <article key={activity.id} className="ranking-item">
            <div>
              <strong>{activity.title}</strong>
              <span>{activity.vote_summary.average_ranking ? `Average rank ${activity.vote_summary.average_ranking}` : "Unranked"}</span>
            </div>
            <div className="rank-buttons">
              {[1, 2, 3, 4, 5].map((rank) => (
                <button
                  key={rank}
                  className={activity.vote_summary.my_ranking === rank ? "active" : ""}
                  onClick={() => onRank(activity, rank)}
                >
                  {rank}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
