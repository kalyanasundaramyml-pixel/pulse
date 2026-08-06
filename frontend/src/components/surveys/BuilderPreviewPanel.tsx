import { ReactNode, useState } from 'react';
import { AnswerInput } from '../../types/api';
import { DraftBlock } from '../../types/draft';
import { RatingInput } from './RatingInput';
import { ChoiceInput } from './ChoiceInput';
import { TextInput } from './TextInput';
import { CommentField } from './CommentField';

// Renders the exact same markup/components/CSS classes as the real take
// pages (SurveyTakePage / OneOnOneTakePage) so this is a true preview, not
// an approximation — anything that renders here is what a respondent will
// actually see, laid out the same way. Takes the in-progress draft (not the
// last-saved survey) so edits show up here live, before Save is clicked.
export function BuilderPreviewPanel({
  title,
  description,
  blocks,
  topNote,
  submitLabel = 'Submit response',
}: {
  title: string;
  description?: string | null;
  blocks: DraftBlock[];
  topNote?: ReactNode;
  submitLabel?: string;
}) {
  const [answers, setAnswers] = useState<Record<string, AnswerInput>>({});

  function updateAnswer(questionId: string, patch: Partial<AnswerInput>) {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch, questionId } }));
  }

  // Draft arrays are already in visual order (no explicit position field —
  // array order IS the order), unlike the persisted Block[] this used to take.
  const welcome = blocks.find((b) => b.blockType === 'WELCOME');
  const end = blocks.find((b) => b.blockType === 'END');
  const questionBlocks = blocks.filter((b) => b.blockType === 'QUESTIONS');

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
            <div className="question-form" key={block.clientId}>
              {block.name && <h2 className="take-block-heading">{block.name}</h2>}
              {block.questions.map((q) => {
                // Draft options are just label strings (no id until saved) —
                // synthesize one from index for this preview-only selection
                // state; nothing here ever submits to the server.
                const previewOptions = (q.options ?? []).map((label, idx) => ({ id: String(idx), label }));
                return (
                  <div className="question-block" key={q.clientId}>
                    <label>
                      {q.prompt || <span className="muted">(no prompt yet)</span>}{' '}
                      {q.isRequired && <span className="required">*</span>}
                    </label>
                    {q.questionType === 'RATING' && (
                      <>
                        <RatingInput
                          min={q.ratingScaleMin ?? 1}
                          max={q.ratingScaleMax ?? 5}
                          value={answers[q.clientId]?.ratingValue}
                          onChange={(value) => updateAnswer(q.clientId, { ratingValue: value })}
                        />
                        <CommentField
                          value={answers[q.clientId]?.commentText ?? ''}
                          onChange={(commentText) => updateAnswer(q.clientId, { commentText })}
                        />
                      </>
                    )}
                    {q.questionType === 'TEXT' && (
                      <TextInput
                        value={answers[q.clientId]?.textValue ?? ''}
                        onChange={(value) => updateAnswer(q.clientId, { textValue: value })}
                      />
                    )}
                    {q.questionType === 'MULTI_CHOICE' && (
                      <>
                        <ChoiceInput
                          options={previewOptions}
                          maxChoices={q.maxChoices ?? 1}
                          selected={answers[q.clientId]?.selectedOptionIds ?? []}
                          onChange={(selectedOptionIds) => updateAnswer(q.clientId, { selectedOptionIds })}
                        />
                        <CommentField
                          value={answers[q.clientId]?.commentText ?? ''}
                          onChange={(commentText) => updateAnswer(q.clientId, { commentText })}
                        />
                      </>
                    )}
                  </div>
                );
              })}
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
