import { useState } from 'react';
import { Question, QuestionType } from '../../types/api';
import { QuestionInput } from '../../api/surveys';
import { ApiError } from '../../api/client';

const TYPE_LABELS: Record<QuestionType, string> = {
  RATING: 'Rating scale',
  TEXT: 'Free text',
  SINGLE_CHOICE: 'Single choice',
  MULTI_CHOICE: 'Multiple choice',
};

export function QuestionEditor({
  existingQuestion,
  onSubmit,
  onCancel,
}: {
  existingQuestion?: Question;
  onSubmit: (input: QuestionInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const isEditing = !!existingQuestion;
  const [questionType, setQuestionType] = useState<QuestionType>(existingQuestion?.questionType ?? 'RATING');
  const [prompt, setPrompt] = useState(existingQuestion?.prompt ?? '');
  const [isRequired, setIsRequired] = useState(existingQuestion?.isRequired ?? true);
  const [ratingMin, setRatingMin] = useState(existingQuestion?.ratingScaleMin ?? 1);
  const [ratingMax, setRatingMax] = useState(existingQuestion?.ratingScaleMax ?? 5);
  const [options, setOptions] = useState(
    existingQuestion && existingQuestion.options.length > 0 ? existingQuestion.options.map((o) => o.label) : ['', ''],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addOptionField() {
    setOptions((prev) => [...prev, '']);
  }

  function removeOptionField(idx: number) {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!prompt.trim()) {
      setError('Question prompt is required');
      return;
    }
    const input: QuestionInput = { questionType, prompt: prompt.trim(), isRequired };
    if (questionType === 'RATING') {
      if (ratingMin >= ratingMax) {
        setError('Rating min must be less than max');
        return;
      }
      input.ratingScaleMin = ratingMin;
      input.ratingScaleMax = ratingMax;
    }
    if (questionType === 'SINGLE_CHOICE' || questionType === 'MULTI_CHOICE') {
      const cleaned = options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2) {
        setError('Choice questions need at least 2 options');
        return;
      }
      input.options = cleaned;
    }
    setSubmitting(true);
    try {
      await onSubmit(input);
      if (!isEditing) {
        setPrompt('');
        setOptions(['', '']);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save question');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="question-editor" onSubmit={handleSubmit}>
      <label>
        Question type
        <select value={questionType} onChange={(e) => setQuestionType(e.target.value as QuestionType)}>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prompt
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. How satisfied are you?" />
      </label>
      <label className="checkbox-label">
        <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
        Required
      </label>

      {questionType === 'RATING' && (
        <div className="rating-scale-fields">
          <label>
            Min
            <input type="number" value={ratingMin} onChange={(e) => setRatingMin(Number(e.target.value))} />
          </label>
          <label>
            Max
            <input type="number" value={ratingMax} onChange={(e) => setRatingMax(Number(e.target.value))} />
          </label>
        </div>
      )}

      {(questionType === 'SINGLE_CHOICE' || questionType === 'MULTI_CHOICE') && (
        <div className="option-fields">
          {options.map((opt, idx) => (
            <div key={idx} className="option-field-row">
              <input
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder={`Option ${idx + 1}`}
              />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOptionField(idx)}>
                  &times;
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addOptionField}>
            + Add option
          </button>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}
      <div className="survey-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : isEditing ? 'Save changes' : 'Add question'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
