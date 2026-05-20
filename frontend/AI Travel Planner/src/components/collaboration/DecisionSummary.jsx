export default function DecisionSummary({ decisions }) {
  const blocks = [
    ["Top destination", decisions?.top_destination],
    ["Top hotel", decisions?.top_hotel],
    ["Top restaurants", decisions?.top_restaurants?.[0]],
    ["Top activity", decisions?.top_activities?.[0]],
  ];

  return (
    <section className="decision-strip">
      {blocks.map(([label, item]) => (
        <article key={label}>
          <span>{label}</span>
          <strong>{item?.title || "Waiting for votes"}</strong>
          <small>{item ? `Score ${item.score}` : "No clear winner yet"}</small>
        </article>
      ))}
    </section>
  );
}
