interface TrendPoint {
  runId: string;
  submittedAt: string;
  value: number | null;
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD_LEFT = 32;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;

export function TrendChart({ points, min, max }: { points: TrendPoint[]; min: number; max: number }) {
  const range = max - min || 1;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) => PAD_LEFT + (points.length === 1 ? plotWidth / 2 : (i / (points.length - 1)) * plotWidth);
  const yFor = (value: number) => PAD_TOP + plotHeight - ((value - min) / range) * plotHeight;

  const answered = points
    .map((p, i) => ({ ...p, x: xFor(i), y: p.value != null ? yFor(p.value) : null }))
    .filter((p) => p.y != null) as Array<TrendPoint & { x: number; y: number }>;

  const linePoints = answered.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg
      className="trend-chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label="Trend of responses over time"
    >
      <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + plotHeight} stroke="var(--border)" />
      <line
        x1={PAD_LEFT}
        y1={PAD_TOP + plotHeight}
        x2={WIDTH - PAD_RIGHT}
        y2={PAD_TOP + plotHeight}
        stroke="var(--border)"
      />
      <text x={PAD_LEFT - 6} y={PAD_TOP + 4} textAnchor="end" className="trend-chart-axis-label">
        {max}
      </text>
      <text x={PAD_LEFT - 6} y={PAD_TOP + plotHeight + 4} textAnchor="end" className="trend-chart-axis-label">
        {min}
      </text>

      {answered.length > 1 && <polyline points={linePoints} fill="none" stroke="var(--brand)" strokeWidth={2} />}

      {points.map((p, i) => {
        const x = xFor(i);
        const y = p.value != null ? yFor(p.value) : null;
        return (
          <g key={p.runId}>
            {y != null && <circle cx={x} cy={y} r={4} fill="var(--brand)" />}
            <text x={x} y={PAD_TOP + plotHeight + 20} textAnchor="middle" className="trend-chart-axis-label">
              {new Date(p.submittedAt).toLocaleDateString()}
            </text>
            {y != null ? (
              <text x={x} y={y - 10} textAnchor="middle" className="trend-chart-value-label">
                {p.value}
              </text>
            ) : (
              <text x={x} y={PAD_TOP + plotHeight / 2} textAnchor="middle" className="trend-chart-axis-label">
                —
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
