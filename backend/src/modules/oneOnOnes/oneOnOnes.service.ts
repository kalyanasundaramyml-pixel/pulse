import { OneOnOneTemplate, Member } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors';
import {
  assertTemplateOwnerOrAdmin,
  assertCanViewOrUseTemplate,
  assertCanViewTemplateDetail,
  assertCanAuditTemplate,
  assertIsRecipient,
  getTemplateOr404,
} from './oneOnOneAuth';
import { recordAuditLog } from '../../lib/auditLog';

// A pure template (isTemplate:true) can never be published — publishTemplate
// rejects it outright — so its status can never leave DRAFT. That means this
// single check is safe to apply uniformly to templates and live one-on-ones
// alike, exactly mirroring Survey's assertDraft.
function assertDraft(template: OneOnOneTemplate) {
  if (template.status !== 'DRAFT') {
    throw new ConflictError('TEMPLATE_NOT_DRAFT', 'This action is only allowed while this is a draft');
  }
}

// A creator can never have two 1:1 templates/live one-on-ones (draft or not)
// with the same title. Auto-generated titles (create, duplicate) get silently
// disambiguated with a " (2)", " (3)"... suffix; a deliberate rename instead
// rejects via assertUniqueTemplateTitle so the person picks a different name.
async function findUniqueTemplateTitle(createdById: string, baseTitle: string): Promise<string> {
  let candidate = baseTitle;
  let n = 1;
  while (await prisma.oneOnOneTemplate.findFirst({ where: { createdById, title: candidate }, select: { id: true } })) {
    n += 1;
    candidate = `${baseTitle} (${n})`;
  }
  return candidate;
}

async function assertUniqueTemplateTitle(createdById: string, title: string, excludeId?: string) {
  const existing = await prisma.oneOnOneTemplate.findFirst({
    where: { createdById, title, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError('DUPLICATE_TITLE', `You already have a one-on-one named "${title}".`);
  }
}

// ===== Templates =====

export async function createTemplate(member: Member, input: { title: string; description?: string; isTemplate?: boolean }) {
  const title = await findUniqueTemplateTitle(member.id, input.title);
  return prisma.oneOnOneTemplate.create({
    data: {
      title,
      description: input.description,
      isTemplate: input.isTemplate ?? true,
      createdById: member.id,
      blocks: {
        create: [
          { position: 0, blockType: 'WELCOME', title: 'Welcome' },
          { position: 1, blockType: 'QUESTIONS', name: 'Block 1' },
          { position: 2, blockType: 'END', title: 'Thank you' },
        ],
      },
    },
  });
}

export async function listTemplates(member: Member, scope: 'created' | 'all' | 'public' | 'audit') {
  if (scope === 'all' && member.role !== 'ADMIN') {
    throw new ForbiddenError('Only Admins may list all one-on-one templates');
  }
  if (scope === 'audit' && member.role !== 'AUDITOR') {
    throw new ForbiddenError('Only Auditors may list one-on-ones under audit');
  }
  if (scope === 'public') {
    return prisma.oneOnOneTemplate.findMany({
      where: { isPublic: true, createdById: { not: member.id } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }
  if (scope === 'audit') {
    return prisma.oneOnOneTemplate.findMany({
      where: { createdBy: { groupId: member.groupId } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }
  return prisma.oneOnOneTemplate.findMany({
    where: scope === 'all' ? {} : { createdById: member.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTemplateDetail(templateId: string, member: Member) {
  const template = await assertCanViewTemplateDetail(templateId, member);
  const [blocks, recipients, runCounts] = await Promise.all([
    prisma.oneOnOneBlock.findMany({
      where: { templateId },
      orderBy: { position: 'asc' },
      include: {
        questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
      },
    }),
    prisma.oneOnOneRecipient.findMany({
      where: { templateId },
      include: { member: { select: { id: true, name: true, email: true } } },
    }),
    prisma.oneOnOneRun.groupBy({ by: ['respondentMemberId'], where: { templateId }, _count: { _all: true } }),
  ]);
  const runCountByMember = new Map(runCounts.map((r) => [r.respondentMemberId, r._count._all]));
  return {
    ...template,
    blocks,
    recipients: recipients.map((r) => ({ ...r, runCount: runCountByMember.get(r.memberId) ?? 0 })),
  };
}

export async function updateTemplate(
  templateId: string,
  member: Member,
  input: { title?: string; description?: string; isArchived?: boolean; isPublic?: boolean },
) {
  const template = await assertTemplateOwnerOrAdmin(templateId, member);
  // Archiving and the public flag are allowed regardless of publish status —
  // only renaming/re-describing requires being back in DRAFT first.
  if (input.title !== undefined || input.description !== undefined) {
    assertDraft(template);
  }
  if (input.title !== undefined && input.title !== template.title) {
    await assertUniqueTemplateTitle(template.createdById, input.title, templateId);
  }
  if (input.isPublic && !template.isTemplate) {
    throw new ValidationError('Only templates can be made public');
  }
  return prisma.oneOnOneTemplate.update({ where: { id: templateId }, data: input });
}

export async function publishTemplate(templateId: string, member: Member) {
  const template = await assertTemplateOwnerOrAdmin(templateId, member);
  assertDraft(template);
  if (template.isTemplate) {
    throw new ConflictError(
      'TEMPLATE_IS_TEMPLATE',
      'A template can\'t be published directly — use "Initiate" to create a live one-on-one first.',
    );
  }
  const [questionCount, recipientCount] = await Promise.all([
    prisma.oneOnOneQuestion.count({ where: { templateId } }),
    prisma.oneOnOneRecipient.count({ where: { templateId } }),
  ]);
  if (questionCount === 0) {
    throw new ValidationError('Cannot publish a one-on-one with no questions');
  }
  if (recipientCount === 0) {
    throw new ValidationError('Cannot publish a one-on-one with no recipients');
  }
  const published = await prisma.oneOnOneTemplate.update({ where: { id: templateId }, data: { status: 'PUBLISHED' } });
  await recordAuditLog({
    actorId: member.id,
    action: 'ONE_ON_ONE_PUBLISHED',
    targetType: 'OneOnOneTemplate',
    targetId: templateId,
    metadata: { recipientCount },
  });
  return published;
}

export async function unpublishTemplate(templateId: string, member: Member) {
  const template = await assertTemplateOwnerOrAdmin(templateId, member);
  if (template.status !== 'PUBLISHED') {
    throw new ConflictError('TEMPLATE_NOT_PUBLISHED', 'Only a published one-on-one can be unpublished for editing');
  }
  const draft = await prisma.oneOnOneTemplate.update({ where: { id: templateId }, data: { status: 'DRAFT' } });
  await recordAuditLog({ actorId: member.id, action: 'ONE_ON_ONE_UNPUBLISHED', targetType: 'OneOnOneTemplate', targetId: templateId });
  return draft;
}

export async function duplicateTemplate(templateId: string, member: Member, asTemplate: boolean) {
  const template = await assertCanViewOrUseTemplate(templateId, member);
  const blocks = await prisma.oneOnOneBlock.findMany({
    where: { templateId },
    orderBy: { position: 'asc' },
    include: {
      questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
    },
  });

  // Recipients only carry over when the acting member already owns the source
  // template (e.g. initiating a live one-on-one from your own pre-populated
  // template). A non-owner forking or initiating from someone else's public
  // template never inherits their recipients — those are a different
  // creator's own reports, not the copier's.
  const isOwner = template.createdById === member.id;
  const recipients = isOwner
    ? await prisma.oneOnOneRecipient.findMany({ where: { templateId }, select: { memberId: true } })
    : [];

  const title = await findUniqueTemplateTitle(member.id, `Copy of ${template.title}`);
  const duplicate = await prisma.oneOnOneTemplate.create({
    data: {
      title,
      description: template.description,
      createdById: member.id,
      isPublic: false,
      isTemplate: asTemplate,
      recipients: { create: recipients.map((r) => ({ memberId: r.memberId })) },
      blocks: {
        create: blocks.map((b) => ({
          position: b.position,
          blockType: b.blockType,
          name: b.name,
          title: b.title,
          body: b.body,
        })),
      },
    },
    include: { blocks: true },
  });

  // Second pass, same reasoning as Survey's duplicate: a question needs both
  // the new templateId and the new blockId, and the new block ids don't
  // exist until the create above returns.
  for (const oldBlock of blocks) {
    const newBlock = duplicate.blocks.find((b) => b.position === oldBlock.position);
    if (!newBlock) continue;
    for (const q of oldBlock.questions) {
      await prisma.oneOnOneQuestion.create({
        data: {
          templateId: duplicate.id,
          blockId: newBlock.id,
          position: q.position,
          questionType: q.questionType,
          prompt: q.prompt,
          isRequired: q.isRequired,
          ratingScaleMin: q.ratingScaleMin,
          ratingScaleMax: q.ratingScaleMax,
          maxChoices: q.maxChoices,
          options: { create: q.options.map((o) => ({ position: o.position, label: o.label })) },
        },
      });
    }
  }

  await recordAuditLog({
    actorId: member.id,
    action: 'ONE_ON_ONE_TEMPLATE_DUPLICATED',
    targetType: 'OneOnOneTemplate',
    targetId: duplicate.id,
    metadata: { sourceTemplateId: templateId },
  });

  return duplicate;
}

export async function deleteTemplate(templateId: string, member: Member) {
  await assertTemplateOwnerOrAdmin(templateId, member);
  const runCount = await prisma.oneOnOneRun.count({ where: { templateId } });
  if (runCount > 0) {
    throw new ConflictError(
      'TEMPLATE_HAS_RUNS',
      'This template already has 1:1 history and cannot be deleted. Archive it instead to hide it from new use.',
    );
  }
  await prisma.oneOnOneTemplate.delete({ where: { id: templateId } });
}

// ===== Draft save =====
// Same Welcome -> N named QUESTIONS blocks -> End structure as Survey. Every
// block/question add/edit/delete/reorder/move is staged client-side and
// applied here in one transactional call — see the plan doc for the
// position-collision-avoiding step ordering.

async function countAnswersForQuestion(questionId: string): Promise<number> {
  return prisma.oneOnOneAnswer.count({ where: { questionId } });
}

type DraftQuestionType = 'RATING' | 'TEXT' | 'MULTI_CHOICE';

interface DraftQuestionInput {
  id?: string;
  questionType: DraftQuestionType;
  prompt: string;
  isRequired: boolean;
  ratingScaleMin?: number;
  ratingScaleMax?: number;
  maxChoices?: number;
  options?: string[];
}

interface DraftBlockInput {
  id?: string;
  blockType: 'WELCOME' | 'QUESTIONS' | 'END';
  name?: string;
  title?: string;
  body?: string;
  questions: DraftQuestionInput[];
}

interface SaveDraftInput {
  title: string;
  description?: string;
  blocks: DraftBlockInput[];
}

function optionsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const TEMP_POSITION_OFFSET = 100000;

export async function saveDraft(templateId: string, member: Member, input: SaveDraftInput) {
  const template = await assertTemplateOwnerOrAdmin(templateId, member);
  assertDraft(template);

  if (input.title !== template.title) {
    await assertUniqueTemplateTitle(template.createdById, input.title, templateId);
  }

  const currentBlocks = await prisma.oneOnOneBlock.findMany({
    where: { templateId },
    orderBy: { position: 'asc' },
    include: { questions: { include: { options: { orderBy: { position: 'asc' } } } } },
  });
  const currentBlockById = new Map(currentBlocks.map((b) => [b.id, b]));
  const currentQuestionById = new Map(currentBlocks.flatMap((b) => b.questions.map((q) => [q.id, q] as const)));

  const welcome = currentBlocks.find((b) => b.blockType === 'WELCOME');
  const end = currentBlocks.find((b) => b.blockType === 'END');
  if (!welcome || !end) throw new NotFoundError('Welcome/End block not found');

  // ----- structural validation of the block list shape -----
  if (input.blocks.length < 2) {
    throw new ValidationError('A one-on-one must have at least a Welcome and an End block');
  }
  const first = input.blocks[0];
  const last = input.blocks[input.blocks.length - 1];
  if (first.id !== welcome.id || first.blockType !== 'WELCOME') {
    throw new ValidationError('The first block must be the existing Welcome block');
  }
  if (last.id !== end.id || last.blockType !== 'END') {
    throw new ValidationError('The last block must be the existing End block');
  }
  const middleBlocks = input.blocks.slice(1, -1);
  const seenBlockIds = new Set<string>();
  for (const b of input.blocks) {
    if (b.id) {
      if (seenBlockIds.has(b.id)) throw new ValidationError('Duplicate block id in payload');
      seenBlockIds.add(b.id);
    }
  }
  for (const b of middleBlocks) {
    if (b.blockType !== 'QUESTIONS') {
      throw new ValidationError('Only named question blocks may appear between Welcome and End');
    }
    if (b.id && (b.id === welcome.id || b.id === end.id)) {
      throw new ValidationError('Welcome/End blocks cannot be reordered into the middle');
    }
    if (b.id && !currentBlockById.has(b.id)) {
      throw new NotFoundError(`Block ${b.id} not found`);
    }
  }

  // ----- structural validation + diff of the question list -----
  const payloadQuestionIds = new Set<string>();
  const seenQuestionIds = new Set<string>();
  for (const b of input.blocks) {
    for (const q of b.questions) {
      if (q.id) {
        if (seenQuestionIds.has(q.id)) throw new ValidationError('Duplicate question id in payload');
        seenQuestionIds.add(q.id);
        payloadQuestionIds.add(q.id);
        if (!currentQuestionById.has(q.id)) throw new NotFoundError(`Question ${q.id} not found`);
      }
    }
  }

  const blocksToDelete = currentBlocks.filter((b) => b.blockType === 'QUESTIONS' && !seenBlockIds.has(b.id));
  const questionsToDelete = [...currentQuestionById.values()].filter((q) => !payloadQuestionIds.has(q.id));

  // ----- pre-flight conflict check: nothing is written until this passes -----
  const conflicts: { questionId: string; prompt: string; reason: string }[] = [];
  for (const q of questionsToDelete) {
    const answerCount = await countAnswersForQuestion(q.id);
    if (answerCount > 0) {
      conflicts.push({ questionId: q.id, prompt: q.prompt, reason: 'has responses across past runs and cannot be deleted' });
    }
  }
  for (const b of input.blocks) {
    for (const q of b.questions) {
      if (!q.id) continue;
      const current = currentQuestionById.get(q.id)!;
      const currentOptionLabels = current.options.map((o) => o.label);
      const isStructural =
        q.questionType !== current.questionType ||
        (q.options !== undefined && !optionsEqual(q.options, currentOptionLabels)) ||
        (q.questionType === 'MULTI_CHOICE' && (q.maxChoices ?? 1) !== current.maxChoices);
      if (isStructural) {
        const answerCount = await countAnswersForQuestion(q.id);
        if (answerCount > 0) {
          conflicts.push({
            questionId: q.id,
            prompt: q.prompt,
            reason: 'already has responses across past runs, so its type/options/max choices can no longer change',
          });
        }
      }
    }
  }
  if (conflicts.length > 0) {
    throw new ConflictError(
      'QUESTION_HAS_RESPONSES',
      `Cannot save — some questions already have responses: ${conflicts.map((c) => `"${c.prompt}"`).join(', ')}.`,
      conflicts,
    );
  }

  // ----- write transaction -----
  await prisma.$transaction(async (tx) => {
    await tx.oneOnOneTemplate.update({
      where: { id: templateId },
      data: { title: input.title, description: input.description },
    });

    // 1. Temp-park every block — existing blocks move off their current
    //    position (which may collide with another block's final target
    //    position later in step 5) and new blocks are created directly at a
    //    temp position. Nothing is at its final 0..N-1 position after this.
    const blockRealId: string[] = [];
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      if (b.id) {
        await tx.oneOnOneBlock.update({ where: { id: b.id }, data: { position: TEMP_POSITION_OFFSET + i } });
        blockRealId[i] = b.id;
      } else {
        const created = await tx.oneOnOneBlock.create({
          data: { templateId, position: TEMP_POSITION_OFFSET + i, blockType: 'QUESTIONS', name: b.name },
        });
        blockRealId[i] = created.id;
      }
    }

    // 2. Move every surviving question to its (possibly new) block, parked
    //    at a temp position — before any block is deleted.
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      for (let qi = 0; qi < b.questions.length; qi++) {
        const q = b.questions[qi];
        if (q.id) {
          await tx.oneOnOneQuestion.update({
            where: { id: q.id },
            data: { blockId: blockRealId[i], position: TEMP_POSITION_OFFSET + qi },
          });
        }
      }
    }

    // 3. Delete blocks dropped from the payload.
    if (blocksToDelete.length > 0) {
      await tx.oneOnOneBlock.deleteMany({ where: { id: { in: blocksToDelete.map((b) => b.id) } } });
    }

    // 4. Delete questions dropped from the payload whose block survived.
    if (questionsToDelete.length > 0) {
      await tx.oneOnOneQuestion.deleteMany({ where: { id: { in: questionsToDelete.map((q) => q.id) } } });
    }

    // 5. Reposition every surviving/new block to its final position.
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      await tx.oneOnOneBlock.update({
        where: { id: blockRealId[i] },
        data: { position: i, name: b.name, title: b.title, body: b.body },
      });
    }

    // 6. Create new questions directly at their final position.
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      for (let qi = 0; qi < b.questions.length; qi++) {
        const q = b.questions[qi];
        if (!q.id) {
          await tx.oneOnOneQuestion.create({
            data: {
              templateId,
              blockId: blockRealId[i],
              position: qi,
              questionType: q.questionType,
              prompt: q.prompt,
              isRequired: q.isRequired,
              ratingScaleMin: q.ratingScaleMin,
              ratingScaleMax: q.ratingScaleMax,
              maxChoices: q.questionType === 'MULTI_CHOICE' ? (q.maxChoices ?? 1) : 1,
              options: q.options ? { create: q.options.map((label, idx) => ({ position: idx, label })) } : undefined,
            },
          });
        }
      }
    }

    // 7. Finalize existing questions: scalar fields + final position, and
    //    replace options if the option list changed.
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      for (let qi = 0; qi < b.questions.length; qi++) {
        const q = b.questions[qi];
        if (!q.id) continue;
        const current = currentQuestionById.get(q.id)!;
        const currentOptionLabels = current.options.map((o) => o.label);
        if (q.options !== undefined && !optionsEqual(q.options, currentOptionLabels)) {
          await tx.oneOnOneQuestionOption.deleteMany({ where: { questionId: q.id } });
          await tx.oneOnOneQuestionOption.createMany({
            data: q.options.map((label, idx) => ({ questionId: q.id!, position: idx, label })),
          });
        }
        await tx.oneOnOneQuestion.update({
          where: { id: q.id },
          data: {
            blockId: blockRealId[i],
            position: qi,
            questionType: q.questionType,
            prompt: q.prompt,
            isRequired: q.isRequired,
            ratingScaleMin: q.ratingScaleMin,
            ratingScaleMax: q.ratingScaleMax,
            maxChoices: q.questionType === 'MULTI_CHOICE' ? (q.maxChoices ?? 1) : 1,
          },
        });
      }
    }
  });

  return getTemplateDetail(templateId, member);
}

// ===== Recipients =====

function assertNoSelfRecipient(template: { createdById: string }, memberIds: string[]) {
  if (memberIds.includes(template.createdById)) {
    throw new ValidationError('A 1:1 template cannot include its own creator as a recipient.');
  }
}

export async function setRecipients(templateId: string, member: Member, memberIds: string[]) {
  const template = await assertTemplateOwnerOrAdmin(templateId, member);
  assertNoSelfRecipient(template, memberIds);
  await prisma.$transaction([
    prisma.oneOnOneRecipient.deleteMany({ where: { templateId, memberId: { notIn: memberIds } } }),
    ...memberIds.map((memberId) =>
      prisma.oneOnOneRecipient.upsert({
        where: { templateId_memberId: { templateId, memberId } },
        create: { templateId, memberId },
        update: {},
      }),
    ),
  ]);
}

export async function addRecipients(templateId: string, member: Member, memberIds: string[]) {
  const template = await assertTemplateOwnerOrAdmin(templateId, member);
  assertNoSelfRecipient(template, memberIds);
  await prisma.$transaction(
    memberIds.map((memberId) =>
      prisma.oneOnOneRecipient.upsert({
        where: { templateId_memberId: { templateId, memberId } },
        create: { templateId, memberId },
        update: {},
      }),
    ),
  );
}

export async function removeRecipient(templateId: string, targetMemberId: string, member: Member) {
  await assertTemplateOwnerOrAdmin(templateId, member);
  await prisma.oneOnOneRecipient
    .delete({ where: { templateId_memberId: { templateId, memberId: targetMemberId } } })
    .catch(() => {
      throw new NotFoundError('Recipient not found');
    });
}

// ===== Runs (creator side) =====

export async function startRun(templateId: string, member: Member, recipientMemberId: string) {
  const template = await assertTemplateOwnerOrAdmin(templateId, member);
  if (template.isTemplate || template.status !== 'PUBLISHED') {
    throw new ConflictError(
      'TEMPLATE_NOT_PUBLISHED',
      'This one-on-one must be published before you can start a run with a recipient.',
    );
  }
  const recipient = await prisma.oneOnOneRecipient.findUnique({
    where: { templateId_memberId: { templateId, memberId: recipientMemberId } },
  });
  if (!recipient) {
    throw new ValidationError('That member is not a recipient of this template');
  }
  const run = await prisma.oneOnOneRun.create({
    data: { templateId, respondentMemberId: recipientMemberId, initiatedById: member.id },
  });
  await recordAuditLog({
    actorId: member.id,
    action: 'ONE_ON_ONE_RUN_STARTED',
    targetType: 'OneOnOneRun',
    targetId: run.id,
    metadata: { templateId, recipientMemberId },
  });
  return run;
}

export async function listRuns(templateId: string, member: Member, recipientMemberId?: string) {
  await assertCanAuditTemplate(templateId, member);
  return prisma.oneOnOneRun.findMany({
    where: { templateId, respondentMemberId: recipientMemberId },
    orderBy: { createdAt: 'desc' },
    include: { respondentMember: { select: { id: true, name: true, email: true } } },
  });
}

// ===== Trend (creator side) =====

interface RatingPoint {
  runId: string;
  submittedAt: Date;
  value: number | null;
  comment: string | null;
}
interface ChoicePoint {
  runId: string;
  submittedAt: Date;
  selectedLabels: string[];
  comment: string | null;
}
interface TextPoint {
  runId: string;
  submittedAt: Date;
  text: string | null;
}

export async function getTrend(templateId: string, member: Member, recipientMemberId: string) {
  const isSelf = recipientMemberId === member.id;
  if (isSelf) {
    // Recipients may view their own trend across runs without owning the template —
    // but only if they actually have run history with it, so this can't be used to
    // browse an arbitrary template's question list.
    const hasRun = await prisma.oneOnOneRun.findFirst({ where: { templateId, respondentMemberId: recipientMemberId } });
    if (!hasRun) {
      throw new NotFoundError('No one-on-one history found for this template');
    }
  } else {
    await assertCanAuditTemplate(templateId, member);
  }

  const [template, recipient, questions, runs] = await Promise.all([
    prisma.oneOnOneTemplate.findUniqueOrThrow({ where: { id: templateId }, select: { title: true } }),
    prisma.member.findUniqueOrThrow({ where: { id: recipientMemberId }, select: { id: true, name: true } }),
    prisma.oneOnOneQuestion.findMany({
      where: { templateId },
      orderBy: [{ block: { position: 'asc' } }, { position: 'asc' }],
      include: { options: { orderBy: { position: 'asc' } } },
    }),
    prisma.oneOnOneRun.findMany({
      where: { templateId, respondentMemberId: recipientMemberId, status: 'COMPLETED' },
      orderBy: { submittedAt: 'asc' },
      include: { answers: { include: { selectedOptions: true } } },
    }),
  ]);

  const questionSeries = questions.map((q) => {
    if (q.questionType === 'RATING') {
      const points: RatingPoint[] = runs.map((run) => {
        const answer = run.answers.find((a) => a.questionId === q.id);
        return {
          runId: run.id,
          submittedAt: run.submittedAt!,
          value: answer?.ratingValue ?? null,
          comment: answer?.commentText ?? null,
        };
      });
      return {
        questionId: q.id,
        prompt: q.prompt,
        type: q.questionType,
        ratingScaleMin: q.ratingScaleMin,
        ratingScaleMax: q.ratingScaleMax,
        points,
      };
    }
    if (q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTI_CHOICE') {
      const optionLabelById = new Map(q.options.map((o) => [o.id, o.label]));
      const points: ChoicePoint[] = runs.map((run) => {
        const answer = run.answers.find((a) => a.questionId === q.id);
        return {
          runId: run.id,
          submittedAt: run.submittedAt!,
          selectedLabels: (answer?.selectedOptions ?? []).map((so) => optionLabelById.get(so.optionId) ?? '?'),
          comment: answer?.commentText ?? null,
        };
      });
      return { questionId: q.id, prompt: q.prompt, type: q.questionType, points };
    }
    // TEXT
    const points: TextPoint[] = runs.map((run) => {
      const answer = run.answers.find((a) => a.questionId === q.id);
      return { runId: run.id, submittedAt: run.submittedAt!, text: answer?.textValue ?? null };
    });
    return { questionId: q.id, prompt: q.prompt, type: q.questionType, points };
  });

  return {
    template: { id: templateId, title: template.title },
    recipient: { id: recipient.id, name: recipient.name },
    runCount: runs.length,
    questions: questionSeries,
  };
}

// ===== Taking a run (recipient side) =====

interface AnswerInput {
  questionId: string;
  ratingValue?: number | null;
  textValue?: string | null;
  selectedOptionIds?: string[];
  commentText?: string | null;
}

async function validateAnswers(templateId: string, answers: AnswerInput[]) {
  const questions = await prisma.oneOnOneQuestion.findMany({
    where: { templateId },
    include: { options: true },
  });
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  const answersByQuestionId = new Map(answers.map((a) => [a.questionId, a]));

  for (const question of questions) {
    const answer = answersByQuestionId.get(question.id);
    if (!answer) {
      if (question.isRequired) {
        throw new ValidationError(`Question "${question.prompt}" is required`);
      }
      continue;
    }
    if (question.questionType === 'RATING') {
      if (answer.ratingValue == null) {
        throw new ValidationError(`Question "${question.prompt}" requires a rating value`);
      }
      if (
        (question.ratingScaleMin != null && answer.ratingValue < question.ratingScaleMin) ||
        (question.ratingScaleMax != null && answer.ratingValue > question.ratingScaleMax)
      ) {
        throw new ValidationError(`Rating for "${question.prompt}" is out of range`);
      }
    } else if (question.questionType === 'TEXT') {
      if (question.isRequired && !answer.textValue) {
        throw new ValidationError(`Question "${question.prompt}" requires a text answer`);
      }
    } else if (question.questionType === 'SINGLE_CHOICE' || question.questionType === 'MULTI_CHOICE') {
      const validOptionIds = new Set(question.options.map((o) => o.id));
      const selected = answer.selectedOptionIds ?? [];
      if (question.isRequired && selected.length === 0) {
        throw new ValidationError(`Question "${question.prompt}" requires a selection`);
      }
      if (selected.length > question.maxChoices) {
        throw new ValidationError(`Question "${question.prompt}" allows at most ${question.maxChoices} selected option(s)`);
      }
      for (const optionId of selected) {
        if (!validOptionIds.has(optionId)) {
          throw new ValidationError(`Invalid option selected for "${question.prompt}"`);
        }
      }
    }
  }

  for (const answer of answers) {
    if (!questionsById.has(answer.questionId)) {
      throw new ValidationError(`Unknown questionId: ${answer.questionId}`);
    }
  }
}

export async function getMyRuns(member: Member) {
  return prisma.oneOnOneRun.findMany({
    where: { respondentMemberId: member.id },
    orderBy: { createdAt: 'desc' },
    include: { template: { select: { id: true, title: true, description: true } } },
  });
}

async function getRunForRespondent(runId: string, member: Member) {
  const run = await prisma.oneOnOneRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw new NotFoundError('One-on-one run not found');
  }
  if (run.respondentMemberId !== member.id) {
    throw new ForbiddenError('This one-on-one run was not assigned to you');
  }
  return run;
}

export async function getTakeRun(runId: string, member: Member) {
  const run = await getRunForRespondent(runId, member);
  const template = await getTemplateOr404(run.templateId);
  const blocks = await prisma.oneOnOneBlock.findMany({
    where: { templateId: run.templateId },
    orderBy: { position: 'asc' },
    include: {
      questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
    },
  });

  let myAnswers: AnswerInput[] | null = null;
  if (run.status === 'COMPLETED') {
    const answers = await prisma.oneOnOneAnswer.findMany({
      where: { runId },
      include: { selectedOptions: true },
    });
    myAnswers = answers.map((a) => ({
      questionId: a.questionId,
      ratingValue: a.ratingValue ?? undefined,
      textValue: a.textValue ?? undefined,
      selectedOptionIds: a.selectedOptions.map((so) => so.optionId),
      commentText: a.commentText ?? undefined,
    }));
  }

  return {
    run: { id: run.id, status: run.status, createdAt: run.createdAt, submittedAt: run.submittedAt },
    template: { id: template.id, title: template.title, description: template.description },
    blocks: blocks.map((b) => ({
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
        maxChoices: q.maxChoices,
        options: q.options.map((o) => ({ id: o.id, label: o.label })),
      })),
    })),
    answers: myAnswers,
  };
}

export async function submitRun(runId: string, member: Member, answers: AnswerInput[]) {
  const run = await getRunForRespondent(runId, member);
  if (run.status !== 'PENDING') {
    throw new ConflictError('RUN_ALREADY_SUBMITTED', 'This one-on-one has already been submitted and cannot be changed.');
  }
  await validateAnswers(run.templateId, answers);

  await prisma.$transaction(async (tx) => {
    for (const answer of answers) {
      const created = await tx.oneOnOneAnswer.create({
        data: {
          runId,
          questionId: answer.questionId,
          ratingValue: answer.ratingValue,
          textValue: answer.textValue,
          commentText: answer.commentText,
        },
      });
      if (answer.selectedOptionIds?.length) {
        await tx.oneOnOneAnswerOption.createMany({
          data: answer.selectedOptionIds.map((optionId) => ({ answerId: created.id, optionId })),
        });
      }
    }
    await tx.oneOnOneRun.update({ where: { id: runId }, data: { status: 'COMPLETED', submittedAt: new Date() } });
  });

  return { runId };
}

export { getTemplateOr404, assertTemplateOwnerOrAdmin, assertIsRecipient };
