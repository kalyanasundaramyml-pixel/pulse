import { QuestionOption } from '../../types/api';

export function ChoiceTallyChart({ tally, options }: { tally: Record<string, number>; options: QuestionOption[] }) {
  const max = Math.max(1, ...Object.values(tally));
  return (
    <div className="choice-chart">
      {options.map((o) => {
        const count = tally[o.id] ?? 0;
        return (
          <div className="choice-bar-row" key={o.id}>
            <span className="choice-bar-label">{o.label}</span>
            <div className="choice-bar-track">
              <div className="choice-bar-fill" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="choice-bar-count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
