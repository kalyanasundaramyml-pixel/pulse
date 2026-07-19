export function TextInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <textarea
      className="text-answer-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      maxLength={5000}
    />
  );
}
