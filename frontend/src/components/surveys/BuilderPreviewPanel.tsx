import { ReactNode, useState } from 'react';
import { AnswerInput, Block } from '../../types/api';
import { RatingInput } from './RatingInput';
import { ChoiceInput } from './ChoiceInput';
import { TextInput } from './TextInput';
import { CommentField } from './CommentField';

// Renders the exact same markup/components/CSS classes as the real take
// pages (SurveyTakePage / OneOnOneTakePage) so this is a true preview, not
// an approximation — anything that renders here is what a respondent will
// actually see, laid out the same way.
export function BuilderPreviewPanel({
  title,
  description,
  blocks,
  topNote,
  submitLabel = 'Submit response',
}: {
  title: string;
  description?: string | null;
  blocks: Block[];
  topNote?: ReactNode;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, AnswerInput>>({});

  function updateAnswer(questionId: string, patch: Partial<AnswerInput>) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch, questionId } }));
  }

  const sorted = [...blocks].sort((a, b) => a.position - b.position);
  const welcome = sorted.find((b) => b.blockType === 'WELCOME');
  const end = sorted.find((b) => b.blockType === 'END');
  const questionBlocks = sorted.filter((b) => b.blockType === 'QUESTIONS');

  return (
    <div className="builder-preview">
      <h3>Preview — what respondents will see</h3>
      <div className="preview-mockup">
        <div className="survey-take-page">
          <h1>{title || 'Untitled'}</h1>
          {description && <p>{description}</p>}
          {topNote}

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
                    {q.prompt || <span className="muted">(no prompt yet)</span>}{' '}
                    {q.isRequired && <span className="required">*</span>}
                  </label>
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

          <button className="primary" disabled title="Preview only">
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
