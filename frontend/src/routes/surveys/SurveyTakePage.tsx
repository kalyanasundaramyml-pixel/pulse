import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { responsesApi } from '../../api/responses';
import { AnswerInput, Question, TakeSurveyResponse } from '../../types/api';
import { ApiError } from '../../api/client';
import { AnonymityBadge } from '../../components/surveys/AnonymityBadge';
import { RatingInput } from '../../components/surveys/RatingInput';
import { ChoiceInput } from '../../components/surveys/ChoiceInput';
import { TextInput } from '../../components/surveys/TextInput';
import { CommentField } from '../../components/surveys/CommentField';

// Read-only rendering of a locked (already-submitted) answer.
function describeAnswer(question: Question, answer: AnswerInput | undefined): string {
  if (!answer) return 'No answer given.';
  const comment = answer.commentText ? ` (comment: ${answer.commentText})` : '';
  if (question.questionType === 'RATING') {
    return answer.ratingValue != null ? `${answer.ratingValue}${comment}` : `No answer given.${comment}`;
  }
  if (question.questionType === 'TEXT') {
    return answer.textValue || 'No answer given.';
  }
  const labels = (answer.selectedOptionIds ?? [])
    .map((optionId) => question.options.find((o) => o.id === optionId)?.label ?? optionId)
    .join(', ');
  return `${labels || 'No answer given.'}${comment}`;
}

export function SurveyTakePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TakeSurveyResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerInput>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (!id) return;
    responsesApi
      .take(id)
      .then((res) => {
        setData(res);
        const initial: Record<string, AnswerInput> = {};
        for (const a of res.myResponse?.answers ?? []) {
          initial[a.questionId] = a;
        }
        setAnswers(initial);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load survey'))
      .finally(() => setLoading(false));
  }, [id]);

  function updateAnswer(questionId: string, patch: Partial<AnswerInput>) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch, questionId } }));
  }

  async function handleSubmit() {
    if (!id || !data) return;
    setError(null);
    setSuccessMessage(null);
    setSubmitting(true);
    const answerList = Object.values(answers);
    try {
      await responsesApi.submit(id, answerList);
      setSuccessMessage(
        data.alreadyResponded ? 'Your updated response has been submitted.' : 'Your response has been submitted.',
      );
      const now = new Date().toISOString();
      setData({
        ...data,
        alreadyResponded: true,
        canResubmit: false,
        myResponse: { answers: answerList, submittedAt: data.myResponse?.submittedAt ?? now, updatedAt: now },
      });
      setPreviewMode(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error && !data) return <p className="form-error">{error}</p>;
  if (!data) return null;

  const welcome = data.blocks.find((b) => b.blockType === 'WELCOME');
  const end = data.blocks.find((b) => b.blockType === 'END');
  const questionBlocks = data.blocks.filter((b) => b.blockType === 'QUESTIONS');
  // A response is locked once submitted, unless the creator has explicitly
  // reopened it for this person (a one-time grant, consumed on the next save).
  const isLocked = data.alreadyResponded && !data.canResubmit;
  const canAcceptResponses = data.survey.status === 'PUBLISHED' || data.canResubmit;

  return (
    <div className="page survey-take-page">
      <h1>{data.survey.title}</h1>
      {data.survey.description && <p>{data.survey.description}</p>}
      <AnonymityBadge isAnonymous={data.survey.isAnonymous} />

      {!canAcceptResponses ? (
        <p className="muted">This survey is not currently accepting responses.</p>
      ) : (
        <>
          {isLocked && (
            <p className="muted">
              You already responded to this survey on {new Date(data.myResponse!.submittedAt).toLocaleDateString()}.
              Responses cannot be edited once submitted.
            </p>
          )}
          {data.canResubmit && (
            <p className="form-success">
              Your creator has reopened this survey for you — you may submit an updated response below.
            </p>
          )}
          {previewMode && !isLocked && (
            <p className="muted">Review your answers below, then confirm to submit.</p>
          )}

          {welcome && (welcome.title || welcome.body) && (
            <div className="take-block-intro">
              {welcome.title && <h2>{welcome.title}</h2>}
              {welcome.body && <p>{welcome.body}</p>}
            </div>
          )}

          {questionBlocks.map((block) => (
            <div className="question-form" key={block.id}>
              {block.name && <h2 className="take-block-heading">{block.name}</h2>}
              {block.questions.map((q) => (
                <div className="question-block" key={q.id}>
                  <label>
                    {q.prompt} {q.isRequired && <span className="required">*</span>}
                  </label>
                  {isLocked || previewMode ? (
                    <p className="muted">{describeAnswer(q, answers[q.id])}</p>
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
          {successMessage && <p className="form-success">{successMessage}</p>}
          {!isLocked && (
            <div className="take-actions">
              {previewMode ? (
                <>
                  <button onClick={() => setPreviewMode(false)} disabled={submitting}>
                    Back to edit
                  </button>
                  <button onClick={handleSubmit} disabled={submitting} className="primary">
                    {submitting ? 'Saving...' : 'Confirm & submit'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setPreviewMode(true)} disabled={submitting}>
                    Preview & Submit
                  </button>
                  <button onClick={handleSubmit} disabled={submitting} className="primary">
                    {submitting ? 'Saving...' : data.alreadyResponded ? 'Submit updated response' : 'Submit response'}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
