import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Block, Question } from '../../types/api';
import { QuestionInput } from '../../api/surveys';
import { QuestionEditor } from './QuestionEditor';
import { ApiError } from '../../api/client';

export interface BlockApi {
  addBlock: (name: string) => Promise<unknown>;
  updateBlock: (blockId: string, input: { name?: string; title?: string; body?: string }) => Promise<unknown>;
  deleteBlock: (blockId: string) => Promise<unknown>;
  reorderBlocks: (blockIds: string[]) => Promise<unknown>;
  addQuestion: (blockId: string, input: QuestionInput) => Promise<unknown>;
  updateQuestion: (blockId: string, questionId: string, input: Partial<QuestionInput>) => Promise<unknown>;
  deleteQuestion: (blockId: string, questionId: string) => Promise<unknown>;
  reorderQuestions: (blockId: string, questionIds: string[]) => Promise<unknown>;
}

export interface BlockListHandle {
  flush: () => Promise<void>;
  discard: () => void;
}

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

// When deferSave is true, edits are held locally (reported via onDraftChange) instead
// of persisted on blur — the parent decides when to flush() or discard() them, so a
// block-text edit shows up in the same Save/Discard workflow as the title/description.
function BlockNameInput({
  block,
  deferSave,
  onSave,
  onDraftChange,
}: {
  block: Block;
  deferSave: boolean;
  onSave: (name: string) => void;
  onDraftChange?: (name: string) => void;
}) {
  const [name, setName] = useState(block.name ?? '');
  return (
    <input
      className="block-name-input"
      value={name}
      onChange={(e) => {
        setName(e.target.value);
        if (deferSave) onDraftChange?.(e.target.value);
      }}
      onBlur={() => {
        if (deferSave) return;
        if (name.trim() && name.trim() !== block.name) onSave(name.trim());
      }}
    />
  );
}

function BlockTextEditor({
  block,
  deferSave,
  onSave,
  onDraftChange,
}: {
  block: Block;
  deferSave: boolean;
  onSave: (input: { title: string; body: string }) => void;
  onDraftChange?: (input: { title: string; body: string }) => void;
}) {
  const [title, setTitle] = useState(block.title ?? '');
  const [body, setBody] = useState(block.body ?? '');
  return (
    <div className="block-text-editor">
      <label>
        Heading
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (deferSave) onDraftChange?.({ title: e.target.value, body });
          }}
          onBlur={() => {
            if (!deferSave) onSave({ title, body });
          }}
        />
      </label>
      <label>
        Message
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (deferSave) onDraftChange?.({ title, body: e.target.value });
          }}
          onBlur={() => {
            if (!deferSave) onSave({ title, body });
          }}
          rows={3}
        />
      </label>
    </div>
  );
}

export const BlockList = forwardRef<
  BlockListHandle,
  {
    blocks: Block[];
    api: BlockApi;
    editable: boolean;
    onChanged: () => void | Promise<void>;
    deferSave?: boolean;
    onDirtyChange?: (dirty: boolean) => void;
  }
>(function BlockList({ blocks, api, editable, onChanged, deferSave = false, onDirtyChange }, ref) {
  const [editingQuestion, setEditingQuestion] = useState<{ blockId: string; question: Question } | null>(null);
  const [newBlockName, setNewBlockName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const pendingText = useRef<Record<string, { title: string; body: string }>>({});
  const pendingNames = useRef<Record<string, string>>({});

  const sorted = [...blocks].sort((a, b) => a.position - b.position);
  const welcome = sorted.find((b) => b.blockType === 'WELCOME');
  const end = sorted.find((b) => b.blockType === 'END');
  const questionBlocks = sorted.filter((b) => b.blockType === 'QUESTIONS');

  function markDirty(blockId: string, patch: { title?: string; body?: string; name?: string }) {
    if (patch.name !== undefined) pendingNames.current[blockId] = patch.name;
    if (patch.title !== undefined || patch.body !== undefined) {
      const existing = pendingText.current[blockId] ?? { title: '', body: '' };
      pendingText.current[blockId] = { ...existing, ...patch };
    }
    onDirtyChange?.(true);
  }

  async function flush() {
    const blockIds = new Set([...Object.keys(pendingText.current), ...Object.keys(pendingNames.current)]);
    for (const blockId of blockIds) {
      const input: { name?: string; title?: string; body?: string } = {};
      const textPatch = pendingText.current[blockId];
      const namePatch = pendingNames.current[blockId];
      if (textPatch) {
        input.title = textPatch.title;
        input.body = textPatch.body;
      }
      if (namePatch !== undefined) input.name = namePatch;
      await api.updateBlock(blockId, input);
    }
    pendingText.current = {};
    pendingNames.current = {};
    onDirtyChange?.(false);
    await onChanged();
  }

  function discard() {
    pendingText.current = {};
    pendingNames.current = {};
    onDirtyChange?.(false);
    setResetKey((k) => k + 1);
  }

  useImperativeHandle(ref, () => ({ flush, discard }));

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  async function handleMoveBlock(blockId: string, direction: -1 | 1) {
    const idx = questionBlocks.findIndex((b) => b.id === blockId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= questionBlocks.length) return;
    const order = questionBlocks.map((b) => b.id);
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    await run(() => api.reorderBlocks(order));
  }

  async function handleMoveQuestion(block: Block, questionId: string, direction: -1 | 1) {
    const idx = block.questions.findIndex((q) => q.id === questionId);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= block.questions.length) return;
    const order = block.questions.map((q) => q.id);
    [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
    await run(() => api.reorderQuestions(block.id, order));
  }

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!newBlockName.trim()) return;
    await run(() => api.addBlock(newBlockName.trim()));
    setNewBlockName('');
  }

  return (
    <div className="block-list">
      {error && <p className="form-error">{error}</p>}

      {welcome && (
        <section className="block-card">
          <h3>Welcome</h3>
          {editable ? (
            <BlockTextEditor
              key={`${welcome.id}-${resetKey}`}
              block={welcome}
              deferSave={deferSave}
              onSave={(input) => run(() => api.updateBlock(welcome.id, input))}
              onDraftChange={(input) => markDirty(welcome.id, input)}
            />
          ) : (
            <>
              {welcome.title && <p className="block-title-display">{welcome.title}</p>}
              {welcome.body && <p>{welcome.body}</p>}
            </>
          )}
        </section>
      )}

      {questionBlocks.map((block, idx) => {
        const isEditingThisBlock = editingQuestion?.blockId === block.id;
        return (
          <section className="block-card" key={block.id}>
            <div className="block-header">
              {editable ? (
                <BlockNameInput
                  key={`${block.id}-${resetKey}`}
                  block={block}
                  deferSave={deferSave}
                  onSave={(name) => run(() => api.updateBlock(block.id, { name }))}
                  onDraftChange={(name) => markDirty(block.id, { name })}
                />
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
                    onClick={() => handleMoveBlock(block.id, -1)}
                    disabled={idx === 0}
                  >
                    <ChevronUpIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Move block down"
                    title="Move block down"
                    onClick={() => handleMoveBlock(block.id, 1)}
                    disabled={idx === questionBlocks.length - 1}
                  >
                    <ChevronDownIcon />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Delete block"
                    title="Delete block"
                    onClick={() => run(() => api.deleteBlock(block.id))}
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}
            </div>
            <ul className="question-list">
              {block.questions.map((q, qIdx) => (
                <li key={q.id}>
                  <span className="question-type-tag">{q.questionType}</span>
                  <span>{q.prompt}</span>
                  {editable && (
                    <span className="question-item-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Move question up"
                        title="Move question up"
                        onClick={() => handleMoveQuestion(block, q.id, -1)}
                        disabled={qIdx === 0}
                      >
                        <ChevronUpIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Move question down"
                        title="Move question down"
                        onClick={() => handleMoveQuestion(block, q.id, 1)}
                        disabled={qIdx === block.questions.length - 1}
                      >
                        <ChevronDownIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Edit question"
                        title="Edit question"
                        onClick={() => setEditingQuestion({ blockId: block.id, question: q })}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Delete question"
                        title="Delete question"
                        onClick={() => run(() => api.deleteQuestion(block.id, q.id))}
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
                key={editingQuestion.question.id}
                existingQuestion={editingQuestion.question}
                onSubmit={async (input) => {
                  await api.updateQuestion(block.id, editingQuestion.question.id, input);
                  setEditingQuestion(null);
                  await onChanged();
                }}
                onCancel={() => setEditingQuestion(null)}
              />
            )}
            {editable && !isEditingThisBlock && (
              <QuestionEditor onSubmit={async (input) => { await api.addQuestion(block.id, input); await onChanged(); }} />
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
            <BlockTextEditor
              key={`${end.id}-${resetKey}`}
              block={end}
              deferSave={deferSave}
              onSave={(input) => run(() => api.updateBlock(end.id, input))}
              onDraftChange={(input) => markDirty(end.id, input)}
            />
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
});
