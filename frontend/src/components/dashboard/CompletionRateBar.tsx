export function CompletionRateBar({ targetCount, respondedCount, rate }: { targetCount: number; respondedCount: number; rate: number }) {
  return (
    <div className="completion-bar">
      <div className="completion-bar-track">
        <div className="completion-bar-fill" style={{ width: `${Math.round(rate * 100)}%` }} />
      </div>
      <p>
        {respondedCount} of {targetCount} recipients responded ({Math.round(rate * 100)}%)
      </p>
    </div>
  );
}
