import { OneOnOneBlock, OneOnOneTemplate, QuestionType, User } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors';
import { assertTemplateOwnerOrAdmin, assertCanViewOrUseTemplate, assertIsRecipient, getTemplateOr404 } from './oneOnOneAuth';
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

// ===== Templates =====

export async function createTemplate(user: User, input: { title: string; description?: string; isTemplate?: boolean }) {
  return prisma.oneOnOneTemplate.create({
    data: {
      title: input.title,
      description: input.description,
      isTemplate: input.isTemplate ?? true,
      createdById: user.id,
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

export async function listTemplates(user: User, scope: 'created' | 'all' | 'public') {
  if (scope === 'all' && user.role !== 'ADMIN') {
    throw new ForbiddenError('Only Admins may list all one-on-one templates');
  }
  if (scope === 'public') {
    return prisma.oneOnOneTemplate.findMany({
      where: { isPublic: true, createdById: { not: user.id } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }
  return prisma.oneOnOneTemplate.findMany({
    where: scope === 'all' ? {} : { createdById: user.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTemplateDetail(templateId: string, user: User) {
  const template = await assertCanViewOrUseTemplate(templateId, user);
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
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.oneOnOneRun.groupBy({ by: ['respondentUserId'], where: { templateId }, _count: { _all: true } }),
  ]);
  const runCountByUser = new Map(runCounts.map((r) => [r.respondentUserId, r._count._all]));
  return {
    ...template,
    blocks,
    recipients: recipients.map((r) => ({ ...r, runCount: runCountByUser.get(r.userId) ?? 0 })),
  };
}

export async function updateTemplate(
  templateId: string,
  user: User,
  input: { title?: string; description?: string; isArchived?: boolean; isPublic?: boolean },
) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  // Archiving and the public flag are allowed regardless of publish status —
  // only renaming/re-describing requires being back in DRAFT first.
  if (input.title !== undefined || input.description !== undefined) {
    assertDraft(template);
  }
  if (input.isPublic && !template.isTemplate) {
    throw new ValidationError('Only templates can be made public');
  }
  return prisma.oneOnOneTemplate.update({ where: { id: templateId }, data: input });
}

export async function publishTemplate(templateId: string, user: User) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
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
    actorId: user.id,
    action: 'ONE_ON_ONE_PUBLISHED',
    targetType: 'OneOnOneTemplate',
    targetId: templateId,
    metadata: { recipientCount },
  });
  return published;
}

export async function unpublishTemplate(templateId: string, user: User) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  if (template.status !== 'PUBLISHED') {
    throw new ConflictError('TEMPLATE_NOT_PUBLISHED', 'Only a published one-on-one can be unpublished for editing');
  }
  const draft = await prisma.oneOnOneTemplate.update({ where: { id: templateId }, data: { status: 'DRAFT' } });
  await recordAuditLog({ actorId: user.id, action: 'ONE_ON_ONE_UNPUBLISHED', targetType: 'OneOnOneTemplate', targetId: templateId });
  return draft;
}

export async function duplicateTemplate(templateId: string, user: User, asTemplate: boolean) {
  const template = await assertCanViewOrUseTemplate(templateId, user);
  const blocks = await prisma.oneOnOneBlock.findMany({
    where: { templateId },
    orderBy: { position: 'asc' },
    include: {
      questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
    },
  });

  // Recipients only carry over when the acting user already owns the source
  // template (e.g. initiating a live one-on-one from your own pre-populated
  // template). A non-owner forking or initiating from someone else's public
  // template never inherits their recipients — those are a different
  // leader's own reports, not the copier's.
  const isOwner = template.createdById === user.id;
  const recipients = isOwner
    ? await prisma.oneOnOneRecipient.findMany({ where: { templateId }, select: { userId: true } })
    : [];

  const duplicate = await prisma.oneOnOneTemplate.create({
    data: {
      title: `Copy of ${template.title}`,
      description: template.description,
      createdById: user.id,
      isPublic: false,
      isTemplate: asTemplate,
      recipients: { create: recipients.map((r) => ({ userId: r.userId })) },
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
          options: { create: q.options.map((o) => ({ position: o.position, label: o.label })) },
        },
      });
    }
  }

  await recordAuditLog({
    actorId: user.id,
    action: 'ONE_ON_ONE_TEMPLATE_DUPLICATED',
    targetType: 'OneOnOneTemplate',
    targetId: duplicate.id,
    metadata: { sourceTemplateId: templateId },
  });

  return duplicate;
}

export async function deleteTemplate(templateId: string, user: User) {
  await assertTemplateOwnerOrAdmin(templateId, user);
  const runCount = await prisma.oneOnOneRun.count({ where: { templateId } });
  if (runCount > 0) {
    throw new ConflictError(
      'TEMPLATE_HAS_RUNS',
      'This template already has 1:1 history and cannot be deleted. Archive it instead to hide it from new use.',
    );
  }
  await prisma.oneOnOneTemplate.delete({ where: { id: templateId } });
}

// ===== Blocks =====
// Same Welcome -> N named QUESTIONS blocks -> End structure as Survey.

async function getBlockOr404(templateId: string, blockId: string): Promise<OneOnOneBlock> {
  const block = await prisma.oneOnOneBlock.findFirst({ where: { id: blockId, templateId } });
  if (!block) {
    throw new NotFoundError('Block not found');
  }
  return block;
}

export async function addBlock(templateId: string, user: User, name: string) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertDraft(template);
  const blocks = await prisma.oneOnOneBlock.findMany({ where: { templateId } });
  const endBlock = blocks.find((b) => b.blockType === 'END');
  if (!endBlock) {
    throw new NotFoundError('End block not found');
  }
  return prisma.$transaction(async (tx) => {
    await tx.oneOnOneBlock.update({ where: { id: endBlock.id }, data: { position: endBlock.position + 1 } });
    return tx.oneOnOneBlock.create({
      data: { templateId, position: endBlock.position, blockType: 'QUESTIONS', name },
    });
  });
}

export async function updateBlock(
  templateId: string,
  blockId: string,
  user: User,
  input: { name?: string; title?: string; body?: string },
) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertDraft(template);
  await getBlockOr404(templateId, blockId);
  return prisma.oneOnOneBlock.update({
    where: { id: blockId },
    data: { name: input.name, title: input.title, body: input.body },
  });
}

export async function deleteBlock(templateId: string, blockId: string, user: User) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertDraft(template);
  const block = await getBlockOr404(templateId, blockId);
  if (block.blockType !== 'QUESTIONS') {
    throw new ValidationError('The Welcome and End blocks cannot be deleted');
  }
  const questions = await prisma.oneOnOneQuestion.findMany({ where: { blockId }, select: { id: true } });
  for (const q of questions) {
    const answerCount = await countAnswersForQuestion(q.id);
    if (answerCount > 0) {
      throw new ConflictError(
        'QUESTION_HAS_RESPONSES',
        'Cannot delete a block containing a question that already has responses across past runs.',
      );
    }
  }
  await prisma.oneOnOneBlock.delete({ where: { id: blockId } });
}

export async function reorderBlocks(templateId: string, user: User, blockIds: string[]) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertDraft(template);
  const blocks = await prisma.oneOnOneBlock.findMany({ where: { templateId } });
  const questionBlocks = blocks.filter((b) => b.blockType === 'QUESTIONS');
  const questionBlockIds = new Set(questionBlocks.map((b) => b.id));
  if (blockIds.length !== questionBlocks.length || !blockIds.every((id) => questionBlockIds.has(id))) {
    throw new ValidationError('blockIds must match the full set of question blocks on this template');
  }
  const welcome = blocks.find((b) => b.blockType === 'WELCOME');
  const end = blocks.find((b) => b.blockType === 'END');
  if (!welcome || !end) {
    throw new NotFoundError('Welcome/End block not found');
  }
  const finalOrder = [welcome.id, ...blockIds, end.id];

  await prisma.$transaction(
    finalOrder.map((id, idx) => prisma.oneOnOneBlock.update({ where: { id }, data: { position: idx + 1000 } })),
  );
  await prisma.$transaction(
    finalOrder.map((id, idx) => prisma.oneOnOneBlock.update({ where: { id }, data: { position: idx } })),
  );
}

// ===== Questions =====

interface QuestionInput {
  questionType: QuestionType;
  prompt: string;
  isRequired: boolean;
  ratingScaleMin?: number;
  ratingScaleMax?: number;
  options?: string[];
}

async function countAnswersForQuestion(questionId: string): Promise<number> {
  return prisma.oneOnOneAnswer.count({ where: { questionId } });
}

export async function addQuestion(templateId: string, blockId: string, user: User, input: QuestionInput) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertDraft(template);
  const block = await getBlockOr404(templateId, blockId);
  if (block.blockType !== 'QUESTIONS') {
    throw new ValidationError('Questions can only be added to a named question block');
  }
  const maxPosition = await prisma.oneOnOneQuestion.aggregate({ where: { blockId }, _max: { position: true } });
  const position = (maxPosition._max.position ?? -1) + 1;

  return prisma.oneOnOneQuestion.create({
    data: {
      templateId,
      blockId,
      position,
      questionType: input.questionType,
      prompt: input.prompt,
      isRequired: input.isRequired,
      ratingScaleMin: input.ratingScaleMin,
      ratingScaleMax: input.ratingScaleMax,
      options: input.options
        ? { create: input.options.map((label, idx) => ({ position: idx, label })) }
        : undefined,
    },
    include: { options: true },
  });
}

export async function updateQuestion(
  templateId: string,
  blockId: string,
  questionId: string,
  user: User,
  input: Partial<QuestionInput>,
) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertDraft(template);
  const question = await prisma.oneOnOneQuestion.findFirst({ where: { id: questionId, blockId } });
  if (!question) {
    throw new NotFoundError('Question not found');
  }
  const isStructuralChange =
    (input.questionType !== undefined && input.questionType !== question.questionType) || input.options !== undefined;
  if (isStructuralChange) {
    const answerCount = await countAnswersForQuestion(questionId);
    if (answerCount > 0) {
      throw new ConflictError(
        'QUESTION_HAS_RESPONSES',
        'This question already has responses across past runs, so its type/options can no longer be restructured — that would corrupt trend history. You can still edit its prompt, required flag, or rating scale.',
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.options) {
      await tx.oneOnOneQuestionOption.deleteMany({ where: { questionId } });
      await tx.oneOnOneQuestionOption.createMany({
        data: input.options.map((label, idx) => ({ questionId, position: idx, label })),
      });
    }
    return tx.oneOnOneQuestion.update({
      where: { id: questionId },
      data: {
        questionType: input.questionType,
        prompt: input.prompt,
        isRequired: input.isRequired,
        ratingScaleMin: input.ratingScaleMin,
        ratingScaleMax: input.ratingScaleMax,
      },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  });
}

export async function deleteQuestion(templateId: string, blockId: string, questionId: string, user: User) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertDraft(template);
  const question = await prisma.oneOnOneQuestion.findFirst({ where: { id: questionId, blockId } });
  if (!question) {
    throw new NotFoundError('Question not found');
  }
  const answerCount = await countAnswersForQuestion(questionId);
  if (answerCount > 0) {
    throw new ConflictError('QUESTION_HAS_RESPONSES', 'Cannot delete a question that already has responses across past runs.');
  }
  await prisma.oneOnOneQuestion.delete({ where: { id: questionId } });
}

export async function reorderQuestions(templateId: string, blockId: string, user: User, questionIds: string[]) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertDraft(template);
  await getBlockOr404(templateId, blockId);
  const existing = await prisma.oneOnOneQuestion.findMany({ where: { blockId }, select: { id: true } });
  const existingIds = new Set(existing.map((q) => q.id));
  if (questionIds.length !== existing.length || !questionIds.every((id) => existingIds.has(id))) {
    throw new ValidationError('questionIds must match the full set of question ids in this block');
  }
  await prisma.$transaction(
    questionIds.map((id, idx) => prisma.oneOnOneQuestion.update({ where: { id }, data: { position: idx + 1000 } })),
  );
  await prisma.$transaction(
    questionIds.map((id, idx) => prisma.oneOnOneQuestion.update({ where: { id }, data: { position: idx } })),
  );
}

// ===== Recipients =====

function assertNoSelfRecipient(template: { createdById: string }, userIds: string[]) {
  if (userIds.includes(template.createdById)) {
    throw new ValidationError('A 1:1 template cannot include its own creator as a recipient.');
  }
}

export async function setRecipients(templateId: string, user: User, userIds: string[]) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertNoSelfRecipient(template, userIds);
  await prisma.$transaction([
    prisma.oneOnOneRecipient.deleteMany({ where: { templateId, userId: { notIn: userIds } } }),
    ...userIds.map((userId) =>
      prisma.oneOnOneRecipient.upsert({
        where: { templateId_userId: { templateId, userId } },
        create: { templateId, userId },
        update: {},
      }),
    ),
  ]);
}

export async function addRecipients(templateId: string, user: User, userIds: string[]) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  assertNoSelfRecipient(template, userIds);
  await prisma.$transaction(
    userIds.map((userId) =>
      prisma.oneOnOneRecipient.upsert({
        where: { templateId_userId: { templateId, userId } },
        create: { templateId, userId },
        update: {},
      }),
    ),
  );
}

export async function removeRecipient(templateId: string, targetUserId: string, user: User) {
  await assertTemplateOwnerOrAdmin(templateId, user);
  await prisma.oneOnOneRecipient
    .delete({ where: { templateId_userId: { templateId, userId: targetUserId } } })
    .catch(() => {
      throw new NotFoundError('Recipient not found');
    });
}

// ===== Runs (leader side) =====

export async function startRun(templateId: string, user: User, recipientUserId: string) {
  const template = await assertTemplateOwnerOrAdmin(templateId, user);
  if (template.isTemplate || template.status !== 'PUBLISHED') {
    throw new ConflictError(
      'TEMPLATE_NOT_PUBLISHED',
      'This one-on-one must be published before you can start a run with a recipient.',
    );
  }
  const recipient = await prisma.oneOnOneRecipient.findUnique({
    where: { templateId_userId: { templateId, userId: recipientUserId } },
  });
  if (!recipient) {
    throw new ValidationError('That user is not a recipient of this template');
  }
  const run = await prisma.oneOnOneRun.create({
    data: { templateId, respondentUserId: recipientUserId, initiatedById: user.id },
  });
  await recordAuditLog({
    actorId: user.id,
    action: 'ONE_ON_ONE_RUN_STARTED',
    targetType: 'OneOnOneRun',
    targetId: run.id,
    metadata: { templateId, recipientUserId },
  });
  return run;
}

export async function listRuns(templateId: string, user: User, recipientUserId?: string) {
  await assertTemplateOwnerOrAdmin(templateId, user);
  return prisma.oneOnOneRun.findMany({
    where: { templateId, respondentUserId: recipientUserId },
    orderBy: { createdAt: 'desc' },
    include: { respondentUser: { select: { id: true, name: true, email: true } } },
  });
}

// ===== Trend (leader side) =====

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

export async function getTrend(templateId: string, user: User, recipientUserId: string) {
  await assertTemplateOwnerOrAdmin(templateId, user);

  const [questions, runs] = await Promise.all([
    prisma.oneOnOneQuestion.findMany({
      where: { templateId },
      orderBy: [{ block: { position: 'asc' } }, { position: 'asc' }],
      include: { options: { orderBy: { position: 'asc' } } },
    }),
    prisma.oneOnOneRun.findMany({
      where: { templateId, respondentUserId: recipientUserId, status: 'COMPLETED' },
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
      return { questionId: q.id, prompt: q.prompt, type: q.questionType, points };
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
    template: { id: templateId },
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
      if (question.questionType === 'SINGLE_CHOICE' && selected.length > 1) {
        throw new ValidationError(`Question "${question.prompt}" only allows one selected option`);
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

export async function getMyRuns(user: User) {
  return prisma.oneOnOneRun.findMany({
    where: { respondentUserId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { template: { select: { id: true, title: true, description: true } } },
  });
}

async function getRunForRespondent(runId: string, user: User) {
  const run = await prisma.oneOnOneRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw new NotFoundError('One-on-one run not found');
  }
  if (run.respondentUserId !== user.id) {
    throw new ForbiddenError('This one-on-one run was not assigned to you');
  }
  return run;
}

export async function getTakeRun(runId: string, user: User) {
  const run = await getRunForRespondent(runId, user);
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
        options: q.options.map((o) => ({ id: o.id, label: o.label })),
      })),
    })),
    answers: myAnswers,
  };
}

export async function submitRun(runId: string, user: User, answers: AnswerInput[]) {
  const run = await getRunForRespondent(runId, user);
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
