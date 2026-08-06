import { Block, Question } from '../types/api';
import { DraftBlock, DraftQuestion } from '../types/draft';

// crypto.randomUUID() only exists in secure contexts (HTTPS or localhost) —
// this app is deployed over plain HTTP on a LAN (see README/COOKIE_SECURE),
// so client-side draft ids use a simple counter instead.
let clientIdCounter = 0;
function makeClientId(): string {
  clientIdCounter += 1;
  return `client-${Date.now()}-${clientIdCounter}`;
}

export function blockToDraft(b: Block): DraftBlock {
  return {
    clientId: makeClientId(),
    id: b.id,
    blockType: b.blockType,
    name: b.name ?? undefined,
    title: b.title ?? undefined,
    body: b.body ?? undefined,
    questions: b.questions.map(questionToDraft),
  };
}

export function questionToDraft(q: Question): DraftQuestion {
  return {
    clientId: makeClientId(),
    id: q.id,
    // Defensive: the maxChoices migration eliminates SINGLE_CHOICE rows, but
    // fall back safely if stale cached data ever surfaces one.
    questionType: q.questionType === 'SINGLE_CHOICE' ? 'MULTI_CHOICE' : q.questionType,
    prompt: q.prompt,
    isRequired: q.isRequired,
    ratingScaleMin: q.ratingScaleMin ?? undefined,
    ratingScaleMax: q.ratingScaleMax ?? undefined,
    maxChoices: q.maxChoices ?? 1,
    options: q.options.length ? q.options.map((o) => o.label) : undefined,
  };
}

export function newDraftBlock(name: string): DraftBlock {
  return { clientId: makeClientId(), blockType: 'QUESTIONS', name, questions: [] };
}

export function newDraftQuestion(): DraftQuestion {
  return {
    clientId: makeClientId(),
    questionType: 'RATING',
    prompt: '',
    isRequired: true,
    ratingScaleMin: 1,
    ratingScaleMax: 5,
  };
}

// Wire payload for PUT .../:id/draft — strips clientId, keeps id only when present.
export function blocksToPayload(blocks: DraftBlock[]) {
  return blocks.map((b) => ({
    id: b.id,
    blockType: b.blockType,
    name: b.name,
    title: b.title,
    body: b.body,
    questions: b.questions.map((q) => ({
      id: q.id,
      questionType: q.questionType,
      prompt: q.prompt,
      isRequired: q.isRequired,
      ratingScaleMin: q.ratingScaleMin,
      ratingScaleMax: q.ratingScaleMax,
      maxChoices: q.questionType === 'MULTI_CHOICE' ? (q.maxChoices ?? 1) : undefined,
      options: q.options,
    })),
  }));
}

// Client-side mirror of the backend's Zod rules — fast feedback, not a
// substitute for the server's authoritative validation.
export function validateDraftBlocks(blocks: DraftBlock[]): string[] {
  const errors: string[] = [];
  for (const b of blocks) {
    if (b.blockType !== 'QUESTIONS') continue;
    for (const q of b.questions) {
      if (!q.prompt.trim()) errors.push(`A question in "${b.name || 'a block'}" is missing its prompt.`);
      if (q.questionType === 'RATING') {
        if (q.ratingScaleMin == null || q.ratingScaleMax == null || q.ratingScaleMin >= q.ratingScaleMax) {
          errors.push(`"${q.prompt || 'Untitled question'}" needs a valid rating range (min < max).`);
        }
      }
      if (q.questionType === 'MULTI_CHOICE') {
        const cleaned = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
        if (cleaned.length < 2) errors.push(`"${q.prompt || 'Untitled question'}" needs at least 2 options.`);
        const maxChoices = q.maxChoices ?? 1;
        if (maxChoices < 1 || maxChoices > cleaned.length) {
          errors.push(`"${q.prompt || 'Untitled question'}" has an invalid max choices value.`);
        }
      }
    }
  }
  return errors;
}
