import { useEffect, useRef, useState } from 'react';
import { DraftBlock, DraftQuestion } from '../../types/draft';
import { newDraftBlock, newDraftQuestion } from '../../lib/draft';
import { QuestionEditor } from './QuestionEditor';

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Two stacked blocks with an item dropping from one into the other — reads
// as "move to another block" at a glance, rather than a generic arrow.
function MoveToBlockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="15" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <rect x="3" y="13" width="15" height="5" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M18 5.5h3.5v10h-3.5M19 13.7 18 15.5 19 17.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoveToBlockButton({
  currentBlockClientId,
  questionBlocks,
  onMove,
}: {
  currentBlockClientId: string;
  questionBlocks: DraftBlock[];
  onMove: (toBlockClientId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const otherBlocks = questionBlocks.filter((b) => b.clientId !== currentBlockClientId);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (otherBlocks.length === 0) return null;

  return (
    <div className="move-to-block" ref={containerRef}>
      <button
        type="button"
        className="icon-button"
        aria-label="Move to block"
        title="Move to block"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoveToBlockIcon />
      </button>
      {open && (
        <div className="move-to-block-menu" role="menu">
          <div className="move-to-block-menu-label">Move to</div>
          {otherBlocks.map((b) => (
            <button
              type="button"
              role="menuitem"
              className="move-to-block-menu-item"
              key={b.clientId}
              onClick={() => {
                onMove(b.clientId);
                setOpen(false);
              }}
            >
              {b.name || 'Untitled block'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockNameInput({ block, onChange }: { block: DraftBlock; onChange: (name: string) => void }) {
  return (
    <input
      className="block-name-input"
      value={block.name ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function BlockTextEditor({
  block,
  onChange,
}: {
  block: DraftBlock;
  onChange: (input: { title: string; body: string }) => void;
}) {
  return (
    <div className="block-text-editor">
      <label>
        Heading
        <input
          value={block.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value, body: block.body ?? '' })}
        />
      </label>
      <label>
        Message
        <textarea
          value={block.body ?? ''}
          onChange={(e) => onChange({ title: block.title ?? '', body: e.target.value })}
          rows={3}
        />
      </label>
    </div>
  );
}

export function BlockList({
  blocks,
  editable,
  onChange,
}: {
  blocks: DraftBlock[];
  editable: boolean;
  onChange: (next: DraftBlock[]) => void;
}) {
  const [editingQuestion, setEditingQuestion] = useState<{ blockClientId: string; question: DraftQuestion } | null>(
    null,
  );
  const [newBlockName, setNewBlockName] = useState('');

  const sorted = blocks; // order in the array IS the position — parent owns ordering
  const welcome = sorted.find((b) => b.blockType === 'WELCOME');
  const end = sorted.find((b) => b.blockType === 'END');
  const questionBlocks = sorted.filter((b) => b.blockType === 'QUESTIONS');

  function updateBlock(blockClientId: string, patch: Partial<DraftBlock>) {
    onChange(blocks.map((b) => (b.clientId === blockClientId ? { ...b, ...patch } : b)));
  }

  function handleAddBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!newBlockName.trim()) return;
    const endIdx = blocks.findIndex((b) => b.blockType === 'END');
    const next = [...blocks];
    next.splice(endIdx, 0, newDraftBlock(newBlockName.trim()));
    onChange(next);
    setNewBlockName('');
  }

  function handleDeleteBlock(blockClientId: string) {
    const block = blocks.find((b) => b.clientId === blockClientId);
    const label = block?.name || 'this block';
    const questionCount = block?.questions.length ?? 0;
    const warning =
      questionCount > 0
        ? `Delete "${label}" and its ${questionCount} question${questionCount === 1 ? '' : 's'}?`
        : `Delete "${label}"?`;
    if (!window.confirm(warning)) return;
    onChange(blocks.filter((b) => b.clientId !== blockClientId));
  }

  function handleMoveBlock(blockClientId: string, direction: -1 | 1) {
    const idx = questionBlocks.findIndex((b) => b.clientId === blockClientId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= questionBlocks.length) return;
    const reordered = [...questionBlocks];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    onChange(welcome ? [welcome, ...reordered, ...(end ? [end] : [])] : [...reordered, ...(end ? [end] : [])]);
  }

  function updateQuestionsInBlock(blockClientId: string, questions: DraftQuestion[]) {
    updateBlock(blockClientId, { questions });
  }

  function handleAddQuestion(blockClientId: string, input: Omit<DraftQuestion, 'clientId' | 'id'>) {
    const block = blocks.find((b) => b.clientId === blockClientId);
    if (!block) return;
    updateQuestionsInBlock(blockClientId, [...block.questions, { ...newDraftQuestion(), ...input }]);
  }

  function handleUpdateQuestion(
    blockClientId: string,
    questionClientId: string,
    input: Omit<DraftQuestion, 'clientId' | 'id'>,
  ) {
    const block = blocks.find((b) => b.clientId === blockClientId);
    if (!block) return;
    updateQuestionsInBlock(
      blockClientId,
      block.questions.map((q) => (q.clientId === questionClientId ? { ...q, ...input } : q)),
    );
  }

  function handleDeleteQuestion(blockClientId: string, questionClientId: string) {
    const block = blocks.find((b) => b.clientId === blockClientId);
    if (!block) return;
    const question = block.questions.find((q) => q.clientId === questionClientId);
    const label = question?.prompt || 'this question';
    if (!window.confirm(`Delete "${label}"?`)) return;
    updateQuestionsInBlock(
      blockClientId,
      block.questions.filter((q) => q.clientId !== questionClientId),
    );
  }

  function handleMoveQuestion(block: DraftBlock, questionClientId: string, direction: -1 | 1) {
    const idx = block.questions.findIndex((q) => q.clientId === questionClientId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= block.questions.length) return;
    const reordered = [...block.questions];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    updateQuestionsInBlock(block.clientId, reordered);
  }

  function handleMoveQuestionToBlock(fromBlockClientId: string, questionClientId: string, toBlockClientId: string) {
    const fromBlock = blocks.find((b) => b.clientId === fromBlockClientId);
    const question = fromBlock?.questions.find((q) => q.clientId === questionClientId);
    if (!fromBlock || !question) return;
    onChange(
      blocks.map((b) => {
        if (b.clientId === fromBlockClientId) {
          return { ...b, questions: b.questions.filter((q) => q.clientId !== questionClientId) };
        }
        if (b.clientId === toBlockClientId) {
          return { ...b, questions: [...b.questions, question] };
        }
        return b;
      }),
    );
  }

  return (
    <div className="block-list">
      {welcome && (
        <section className="block-card">
          <h3>Welcome</h3>
          {editable ? (
            <BlockTextEditor block={welcome} onChange={(input) => updateBlock(welcome.clientId, input)} />
          ) : (
            <>
              {welcome.title && <p className="block-title-display">{welcome.title}</p>}
              {welcome.body && <p>{welcome.body}</p>}
            </>
          )}
        </section>
      )}

      {questionBlocks.map((block, idx) => {
        const isEditingThisBlock = editingQuestion?.blockClientId === block.clientId;
        return (
          <section className="block-card" key={block.clientId}>
            <div className="block-header">
              {editable ? (
                <BlockNameInput block={block} onChange={(name) => updateBlock(block.clientId, { name })} />
              ) : (
                <h3>{block.name}</h3>
              )}
              {editable && (
                <div className="block-header-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Move block up"
                    title="Move block up"
                    onClick={() => handleMoveBlock(block.clientId, -1)}
                    disabled={idx === 0}
                  >
                    <ChevronUpIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Move block down"
                    title="Move block down"
                    onClick={() => handleMoveBlock(block.clientId, 1)}
                    disabled={idx === questionBlocks.length - 1}
                  >
                    <ChevronDownIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Delete block"
                    title="Delete block"
                    onClick={() => handleDeleteBlock(block.clientId)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
            <ul className="question-list">
              {block.questions.map((q, qIdx) => (
                <li key={q.clientId}>
                  <span className="question-type-tag">{q.questionType}</span>
                  <span>{q.prompt}</span>
                  {editable && (
                    <span className="question-item-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Move question up"
                        title="Move question up"
                        onClick={() => handleMoveQuestion(block, q.clientId, -1)}
                        disabled={qIdx === 0}
                      >
                        <ChevronUpIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Move question down"
                        title="Move question down"
                        onClick={() => handleMoveQuestion(block, q.clientId, 1)}
                        disabled={qIdx === block.questions.length - 1}
                      >
                        <ChevronDownIcon />
                      </button>
                      <MoveToBlockButton
                        currentBlockClientId={block.clientId}
                        questionBlocks={questionBlocks}
                        onMove={(toBlockClientId) => handleMoveQuestionToBlock(block.clientId, q.clientId, toBlockClientId)}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Edit question"
                        title="Edit question"
                        onClick={() => setEditingQuestion({ blockClientId: block.clientId, question: q })}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Delete question"
                        title="Delete question"
                        onClick={() => handleDeleteQuestion(block.clientId, q.clientId)}
                      >
                        <TrashIcon />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {editable && isEditingThisBlock && (
              <QuestionEditor
                key={editingQuestion.question.clientId}
                existingQuestion={editingQuestion.question}
                onSubmit={(input) => {
                  handleUpdateQuestion(block.clientId, editingQuestion.question.clientId, input);
                  setEditingQuestion(null);
                }}
                onCancel={() => setEditingQuestion(null)}
              />
            )}
            {editable && !isEditingThisBlock && (
              <QuestionEditor onSubmit={(input) => handleAddQuestion(block.clientId, input)} />
            )}
          </section>
        );
      })}

      {editable && (
        <form className="add-block-form" onSubmit={handleAddBlock}>
          <input
            placeholder="New block name (e.g. Culture, Growth)"
            value={newBlockName}
            onChange={(e) => setNewBlockName(e.target.value)}
          />
          <button type="submit">+ Add block</button>
        </form>
      )}

      {end && (
        <section className="block-card">
          <h3>End</h3>
          {editable ? (
            <BlockTextEditor block={end} onChange={(input) => updateBlock(end.clientId, input)} />
          ) : (
            <>
              {end.title && <p className="block-title-display">{end.title}</p>}
              {end.body && <p>{end.body}</p>}
            </>
          )}
        </section>
      )}
    </div>
  );
}
