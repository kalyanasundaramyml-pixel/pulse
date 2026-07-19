export function RatingInput({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const scale = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="rating-input">
      {scale.map((n) => (
        <button
          key={n}
          type="button"
          className={value === n ? 'selected' : ''}
          onClick={() => onChange(n)}
          aria-pressed={value === n}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
