import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { AnswerInput, Question, TakeOneOnOneResponse } from '../../types/api';
import { ApiError } from '../../api/client';
import { RatingInput } from '../../components/surveys/RatingInput';
import { ChoiceInput } from '../../components/surveys/ChoiceInput';
import { TextInput } from '../../components/surveys/TextInput';
import { CommentField } from '../../components/surveys/CommentField';

function formatAnswer(question: Question, answer: AnswerInput | undefined): string {
  if (!answer) return '(no answer)';
  if (question.questionType === 'RATING') {
    return answer.ratingValue != null ? String(answer.ratingValue) : '(no answer)';
  }
  if (question.questionType === 'TEXT') {
    return answer.textValue || '(no answer)';
  }
  const labels = (answer.selectedOptionIds ?? [])
    .map((optId) => question.options.find((o) => o.id === optId)?.label)
    .filter(Boolean);
  return labels.length > 0 ? labels.join(', ') : '(no answer)';
}

export function OneOnOneTakePage() {
  const { runId } = useParams<{ runId: string }>();
  const [data, setData] = useState<TakeOneOnOneResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerInput>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (!runId) return;
    oneOnOnesApi
      .takeRun(runId)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load this 1:1'))
      .finally(() => setLoading(false));
  }, [runId]);

  function updateAnswer(questionId: string, patch: Partial<AnswerInput>) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch, questionId } }));
  }

  async function handleSubmit() {
    if (!runId || !data) return;
    setError(null);
    setSubmitting(true);
    try {
      await oneOnOnesApi.submitRun(runId, Object.values(answers));
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error && !data) return <p className="form-error">{error}</p>;
  if (!data) return null;

  const isCompleted = submitted || data.run.status === 'COMPLETED';
  const welcome = data.blocks.find((b) => b.blockType === 'WELCOME');
  const end = data.blocks.find((b) => b.blockType === 'END');
  const questionBlocks = data.blocks.filter((b) => b.blockType === 'QUESTIONS');

  return (
    <div className="page survey-take-page">
      <h1>{data.template.title}</h1>
      {data.template.description && <p>{data.template.description}</p>}
      <p className="muted">This 1:1 is linked to your name and reviewed by your creator.</p>

      {welcome && (welcome.title || welcome.body) && (
        <div className="take-block-intro">
          {welcome.title && <h2>{welcome.title}</h2>}
          {welcome.body && <p>{welcome.body}</p>}
        </div>
      )}

      {isCompleted ? (
        <>
          <p className="form-success">
            Submitted{data.run.submittedAt ? ` on ${new Date(data.run.submittedAt).toLocaleDateString()}` : ''}. This
            1:1 is complete and can't be changed.
          </p>
          {questionBlocks.map((block) => (
            <div className="question-form" key={block.id}>
              {block.name && <h2 className="take-block-heading">{block.name}</h2>}
              {block.questions.map((q) => (
                <div className="question-block" key={q.id}>
                  <label>{q.prompt}</label>
                  <p>{formatAnswer(q, data.answers?.find((a) => a.questionId === q.id) ?? answers[q.id])}</p>
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        <>
          {questionBlocks.map((block) => (
            <div className="question-form" key={block.id}>
              {block.name && <h2 className="take-block-heading">{block.name}</h2>}
              {block.questions.map((q) => (
                <div className="question-block" key={q.id}>
                  <label>
                    {q.prompt} {q.isRequired && <span className="required">*</span>}
                  </label>
                  {previewMode ? (
                    <p className="muted">{formatAnswer(q, answers[q.id])}</p>
                  ) : (
                    <>
                      {q.questionType === 'RATING' && (
                        <>
                          <RatingInput
                            min={q.ratingScaleMin ?? 1}
                            max={q.ratingScaleMax ?? 5}
                            value={answers[q.id]?.ratingValue}
                            onChange={(value) => updateAnswer(q.id, { ratingValue: value })}
                          />
                          <CommentField
                            value={answers[q.id]?.commentText ?? ''}
                            onChange={(commentText) => updateAnswer(q.id, { commentText })}
                          />
                        </>
                      )}
                      {q.questionType === 'TEXT' && (
                        <TextInput
                          value={answers[q.id]?.textValue ?? ''}
                          onChange={(value) => updateAnswer(q.id, { textValue: value })}
                        />
                      )}
                      {(q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTI_CHOICE') && (
                        <>
                          <ChoiceInput
                            options={q.options}
                            multi={q.questionType === 'MULTI_CHOICE'}
                            selected={answers[q.id]?.selectedOptionIds ?? []}
                            onChange={(selectedOptionIds) => updateAnswer(q.id, { selectedOptionIds })}
                          />
                          <CommentField
                            value={answers[q.id]?.commentText ?? ''}
                            onChange={(commentText) => updateAnswer(q.id, { commentText })}
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
          {end && (end.title || end.body) && (
            <div className="take-block-intro">
              {end.title && <h2>{end.title}</h2>}
              {end.body && <p>{end.body}</p>}
            </div>
          )}
          {error && <p className="form-error">{error}</p>}
          <p className="muted">
            {previewMode
              ? 'Review your answers below, then confirm to submit.'
              : 'You can only submit this once, so double-check your answers before submitting.'}
          </p>
          <div className="take-actions">
            {previewMode ? (
              <>
                <button onClick={() => setPreviewMode(false)} disabled={submitting}>
                  Back to edit
                </button>
                <button onClick={handleSubmit} disabled={submitting} className="primary">
                  {submitting ? 'Submitting...' : 'Confirm & submit'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setPreviewMode(true)} disabled={submitting}>
                  Preview & Submit
                </button>
                <button onClick={handleSubmit} disabled={submitting} className="primary">
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
