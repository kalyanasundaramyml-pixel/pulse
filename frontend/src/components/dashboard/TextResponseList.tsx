export function TextResponseList({ responses }: { responses: string[] }) {
  if (responses.length === 0) {
    return <p className="muted">No text responses yet.</p>;
  }
  return (
    <ul className="text-response-list">
      {responses.map((r, idx) => (
        <li key={idx}>{r}</li>
      ))}
    </ul>
  );
}
