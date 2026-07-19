export function RatingDistributionChart({ average, distribution }: { average: number; distribution: Record<number, number> }) {
  const entries = Object.entries(distribution)
    .map(([value, count]) => [Number(value), count] as const)
    .sort((a, b) => a[0] - b[0]);
  const max = Math.max(1, ...entries.map(([, count]) => count));

  return (
    <div className="rating-chart">
      <p className="rating-average">Average: {average.toFixed(2)}</p>
      <div className="rating-bars">
        {entries.map(([value, count]) => (
          <div className="rating-bar-row" key={value}>
            <span className="rating-bar-label">{value}</span>
            <div className="rating-bar-track">
              <div className="rating-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="rating-bar-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
