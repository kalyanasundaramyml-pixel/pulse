export function CommentField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="comment-field">
      <label className="comment-field-label">Add a comment (optional)</label>
      <textarea
        className="text-answer-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Anything you'd like to add?"
      />
    </div>
  );
}
