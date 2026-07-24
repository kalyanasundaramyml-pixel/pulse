import { Survey, SurveyBlock, QuestionType, Member } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import {
  assertSurveyOwnerOrAdmin,
  assertCanViewOrUseTemplate,
  assertCanManageViewers,
  getSurveyOr404,
} from './surveyAuth';
import { recordAuditLog } from '../../lib/auditLog';

function assertDraft(survey: Survey) {
  if (survey.status !== 'DRAFT') {
    throw new ConflictError('SURVEY_NOT_DRAFT', 'This action is only allowed while the survey is a draft');
  }
}

// A creator can never have two surveys (draft or not, template or not) with the
// same title. Auto-generated titles (create, duplicate) get silently
// disambiguated with a " (2)", " (3)"... suffix; a deliberate rename instead
// rejects via assertUniqueSurveyTitle so the person picks a different name.
async function findUniqueSurveyTitle(createdById: string, baseTitle: string): Promise<string> {
  let candidate = baseTitle;
  let n = 1;
  while (await prisma.survey.findFirst({ where: { createdById, title: candidate }, select: { id: true } })) {
    n += 1;
    candidate = `${baseTitle} (${n})`;
  }
  return candidate;
}

async function assertUniqueSurveyTitle(createdById: string, title: string, excludeId?: string) {
  const existing = await prisma.survey.findFirst({
    where: { createdById, title, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError('DUPLICATE_TITLE', `You already have a survey named "${title}".`);
  }
}

export async function createSurvey(
  member: Member,
  input: { title: string; description?: string; isAnonymous: boolean; endDate?: string | null; isTemplate?: boolean },
) {
  const title = await findUniqueSurveyTitle(member.id, input.title);
  return prisma.survey.create({
    data: {
      title,
      description: input.description,
      isAnonymous: input.isAnonymous,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      isTemplate: input.isTemplate ?? false,
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

export async function listSurveys(
  member: Member,
  opts: {
    scope: 'created' | 'targeted' | 'all' | 'public' | 'audit' | 'viewing';
    status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  },
) {
  if (opts.scope === 'all' && member.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Only Admins may list all surveys');
  }
  if (opts.scope === 'audit' && member.role !== 'AUDITOR') {
    throw new AppError(403, 'FORBIDDEN', 'Only Auditors may list surveys under audit');
  }

  const withCounts = {
    _count: { select: { questions: true, recipients: true, responseAccess: true, attributedResponses: true } },
  };

  if (opts.scope === 'targeted') {
    const surveys = await prisma.survey.findMany({
      where: {
        status: opts.status,
        recipients: { some: { memberId: member.id } },
      },
      orderBy: { createdAt: 'desc' },
      include: withCounts,
    });

    // Whether *this* member has already responded — the same self-check
    // getTakeSurvey exposes as `alreadyResponded`, just computed in bulk here
    // so the list can split "Pending" from "Completed". Checking one's own
    // response status is never a privacy concern, anonymous survey or not.
    const anonymousIds = surveys.filter((s) => s.isAnonymous).map((s) => s.id);
    const attributedIds = surveys.filter((s) => !s.isAnonymous).map((s) => s.id);
    const [anonResponded, attrResponded] = await Promise.all([
      anonymousIds.length
        ? prisma.surveyResponseAccess.findMany({
            where: { memberId: member.id, surveyId: { in: anonymousIds } },
            select: { surveyId: true },
          })
        : Promise.resolve([]),
      attributedIds.length
        ? prisma.attributedResponse.findMany({
            where: { respondentMemberId: member.id, surveyId: { in: attributedIds } },
            select: { surveyId: true },
          })
        : Promise.resolve([]),
    ]);
    const respondedIds = new Set([...anonResponded.map((r) => r.surveyId), ...attrResponded.map((r) => r.surveyId)]);

    return surveys.map((s) => ({ ...s, hasResponded: respondedIds.has(s.id) }));
  }

  if (opts.scope === 'all') {
    return prisma.survey.findMany({ where: { status: opts.status }, orderBy: { createdAt: 'desc' }, include: withCounts });
  }

  if (opts.scope === 'public') {
    return prisma.survey.findMany({
      where: { isTemplate: true, isPublic: true, createdById: { not: member.id } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } }, ...withCounts },
    });
  }

  if (opts.scope === 'audit') {
    return prisma.survey.findMany({
      where: { status: opts.status, createdBy: { groupId: member.groupId } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } }, ...withCounts },
    });
  }

  if (opts.scope === 'viewing') {
    return prisma.survey.findMany({
      where: { status: opts.status, viewers: { some: { memberId: member.id } } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } }, ...withCounts },
    });
  }

  return prisma.survey.findMany({
    where: { createdById: member.id, status: opts.status },
    orderBy: { createdAt: 'desc' },
    include: withCounts,
  });
}

export async function getSurveyDetail(surveyId: string, member: Member) {
  await assertCanViewOrUseTemplate(surveyId, member);
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      blocks: {
        orderBy: { position: 'asc' },
        include: {
          questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
        },
      },
      recipients: { include: { member: { select: { id: true, name: true, email: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
  });
  if (!survey) {
    throw new NotFoundError('Survey not found');
  }
  return survey;
}

export async function updateSurvey(
  surveyId: string,
  member: Member,
  input: { title?: string; description?: string; isAnonymous?: boolean; endDate?: string | null; isPublic?: boolean },
) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  if (input.isAnonymous !== undefined && input.isAnonymous !== survey.isAnonymous && survey.publishedAt != null) {
    throw new ConflictError(
      'ANONYMITY_LOCKED',
      'This survey has already been published once, so its anonymous/attributed setting can no longer change — respondents relied on that promise.',
    );
  }
  if (input.isPublic && !survey.isTemplate) {
    throw new ValidationError('Only templates can be made public');
  }
  if (input.title !== undefined && input.title !== survey.title) {
    await assertUniqueSurveyTitle(survey.createdById, input.title, surveyId);
  }
  return prisma.survey.update({
    where: { id: surveyId },
    data: {
      title: input.title,
      description: input.description,
      isAnonymous: input.isAnonymous,
      endDate: input.endDate === undefined ? undefined : input.endDate ? new Date(input.endDate) : null,
      isPublic: input.isPublic,
    },
  });
}

export async function deleteSurvey(surveyId: string, member: Member) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  if (member.role !== 'ADMIN') {
    assertDraft(survey);
  }
  await prisma.survey.delete({ where: { id: surveyId } });
  await recordAuditLog({
    actorId: member.id,
    action: 'SURVEY_DELETED',
    targetType: 'Survey',
    targetId: surveyId,
    metadata: { title: survey.title, status: survey.status },
  });
}

export async function publishSurvey(surveyId: string, member: Member) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  if (survey.isTemplate) {
    throw new ConflictError(
      'SURVEY_IS_TEMPLATE',
      'A template can\'t be published directly — use "Start a survey" to create a live copy first.',
    );
  }
  const [questionCount, recipientCount] = await Promise.all([
    prisma.question.count({ where: { surveyId } }),
    prisma.surveyRecipient.count({ where: { surveyId } }),
  ]);
  if (questionCount === 0) {
    throw new ValidationError('Cannot publish a survey with no questions');
  }
  if (recipientCount === 0) {
    throw new ValidationError('Cannot publish a survey with no recipients');
  }
  const published = await prisma.survey.update({
    where: { id: surveyId },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });
  await recordAuditLog({
    actorId: member.id,
    action: 'SURVEY_PUBLISHED',
    targetType: 'Survey',
    targetId: surveyId,
    metadata: { isAnonymous: survey.isAnonymous, recipientCount },
  });
  return published;
}

export async function closeSurvey(surveyId: string, member: Member) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  if (survey.status !== 'PUBLISHED') {
    throw new ConflictError('SURVEY_NOT_PUBLISHED', 'Only a published survey can be closed');
  }
  const closed = await prisma.survey.update({ where: { id: surveyId }, data: { status: 'CLOSED', closedAt: new Date() } });
  await recordAuditLog({ actorId: member.id, action: 'SURVEY_CLOSED', targetType: 'Survey', targetId: surveyId });
  return closed;
}

export async function unpublishSurvey(surveyId: string, member: Member) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  if (survey.status !== 'PUBLISHED' && survey.status !== 'CLOSED') {
    throw new ConflictError('SURVEY_NOT_LIVE', 'Only a published or closed survey can be unpublished for editing');
  }
  // publishedAt / closedAt are left untouched — the isAnonymous lock keys off
  // "has this survey ever been published", not its current status.
  const draft = await prisma.survey.update({ where: { id: surveyId }, data: { status: 'DRAFT' } });
  await recordAuditLog({ actorId: member.id, action: 'SURVEY_UNPUBLISHED', targetType: 'Survey', targetId: surveyId });
  return draft;
}

export async function reopenSurvey(surveyId: string, member: Member, endDate?: string | null) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  if (survey.status !== 'CLOSED') {
    throw new ConflictError('SURVEY_NOT_CLOSED', 'Only a closed survey can be reopened');
  }
  const reopened = await prisma.survey.update({
    where: { id: surveyId },
    data: {
      status: 'PUBLISHED',
      closedAt: null,
      // Clears the old end date by default so reopening doesn't immediately
      // auto-close again on the very next request.
      endDate: endDate ? new Date(endDate) : null,
    },
  });
  await recordAuditLog({ actorId: member.id, action: 'SURVEY_REOPENED', targetType: 'Survey', targetId: surveyId });
  return reopened;
}

export async function duplicateSurvey(surveyId: string, member: Member, asTemplate: boolean) {
  const survey = await assertCanViewOrUseTemplate(surveyId, member);
  const [blocks, recipients] = await Promise.all([
    prisma.surveyBlock.findMany({
      where: { surveyId },
      orderBy: { position: 'asc' },
      include: {
        questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
      },
    }),
    prisma.surveyRecipient.findMany({ where: { surveyId }, select: { memberId: true } }),
  ]);

  const title = await findUniqueSurveyTitle(member.id, `Copy of ${survey.title}`);
  const duplicate = await prisma.survey.create({
    data: {
      title,
      description: survey.description,
      isAnonymous: survey.isAnonymous,
      isTemplate: asTemplate,
      isPublic: false,
      createdById: member.id,
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

  // Questions are created as a second pass (not nested in the survey.create
  // above) because each Question needs both the new surveyId and the new
  // blockId, and the new block ids don't exist until the create above returns.
  for (const oldBlock of blocks) {
    const newBlock = duplicate.blocks.find((b) => b.position === oldBlock.position);
    if (!newBlock) continue;
    for (const q of oldBlock.questions) {
      await prisma.question.create({
        data: {
          surveyId: duplicate.id,
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
    actorId: member.id,
    action: 'SURVEY_DUPLICATED',
    targetType: 'Survey',
    targetId: duplicate.id,
    metadata: { sourceSurveyId: surveyId },
  });

  return duplicate;
}

// ===== Blocks =====
// A survey is Welcome -> N named QUESTIONS blocks -> End. Welcome/End are
// created once (in createSurvey/duplicateSurvey) and can never be added,
// deleted, or reordered — only their title/body text is editable. Only
// QUESTIONS blocks can be added, renamed, deleted, and reordered among
// themselves.

async function getBlockOr404(surveyId: string, blockId: string): Promise<SurveyBlock> {
  const block = await prisma.surveyBlock.findFirst({ where: { id: blockId, surveyId } });
  if (!block) {
    throw new NotFoundError('Block not found');
  }
  return block;
}

export async function addBlock(surveyId: string, member: Member, name: string) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  const blocks = await prisma.surveyBlock.findMany({ where: { surveyId } });
  const endBlock = blocks.find((b) => b.blockType === 'END');
  if (!endBlock) {
    throw new NotFoundError('End block not found');
  }
  return prisma.$transaction(async (tx) => {
    await tx.surveyBlock.update({ where: { id: endBlock.id }, data: { position: endBlock.position + 1 } });
    return tx.surveyBlock.create({
      data: { surveyId, position: endBlock.position, blockType: 'QUESTIONS', name },
    });
  });
}

export async function updateBlock(
  surveyId: string,
  blockId: string,
  member: Member,
  input: { name?: string; title?: string; body?: string },
) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  await getBlockOr404(surveyId, blockId);
  return prisma.surveyBlock.update({
    where: { id: blockId },
    data: { name: input.name, title: input.title, body: input.body },
  });
}

export async function deleteBlock(surveyId: string, blockId: string, member: Member) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  const block = await getBlockOr404(surveyId, blockId);
  if (block.blockType !== 'QUESTIONS') {
    throw new ValidationError('The Welcome and End blocks cannot be deleted');
  }
  const questions = await prisma.question.findMany({ where: { blockId }, select: { id: true } });
  for (const q of questions) {
    const answerCount = await countAnswersForQuestion(survey, q.id);
    if (answerCount > 0) {
      throw new ConflictError(
        'QUESTION_HAS_RESPONSES',
        'Cannot delete a block containing a question that already has responses.',
      );
    }
  }
  await prisma.surveyBlock.delete({ where: { id: blockId } });
}

export async function reorderBlocks(surveyId: string, member: Member, blockIds: string[]) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  const blocks = await prisma.surveyBlock.findMany({ where: { surveyId } });
  const questionBlocks = blocks.filter((b) => b.blockType === 'QUESTIONS');
  const questionBlockIds = new Set(questionBlocks.map((b) => b.id));
  if (blockIds.length !== questionBlocks.length || !blockIds.every((id) => questionBlockIds.has(id))) {
    throw new ValidationError('blockIds must match the full set of question blocks on this survey');
  }
  const welcome = blocks.find((b) => b.blockType === 'WELCOME');
  const end = blocks.find((b) => b.blockType === 'END');
  if (!welcome || !end) {
    throw new NotFoundError('Welcome/End block not found');
  }
  const finalOrder = [welcome.id, ...blockIds, end.id];

  await prisma.$transaction(
    finalOrder.map((id, idx) => prisma.surveyBlock.update({ where: { id }, data: { position: idx + 1000 } })),
  );
  await prisma.$transaction(
    finalOrder.map((id, idx) => prisma.surveyBlock.update({ where: { id }, data: { position: idx } })),
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

export async function addQuestion(surveyId: string, blockId: string, member: Member, input: QuestionInput) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  const block = await getBlockOr404(surveyId, blockId);
  if (block.blockType !== 'QUESTIONS') {
    throw new ValidationError('Questions can only be added to a named question block');
  }
  const maxPosition = await prisma.question.aggregate({ where: { blockId }, _max: { position: true } });
  const position = (maxPosition._max.position ?? -1) + 1;

  return prisma.question.create({
    data: {
      surveyId,
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

async function countAnswersForQuestion(survey: Survey, questionId: string): Promise<number> {
  return survey.isAnonymous
    ? prisma.anonymousAnswer.count({ where: { questionId } })
    : prisma.attributedAnswer.count({ where: { questionId } });
}

export async function updateQuestion(
  surveyId: string,
  blockId: string,
  questionId: string,
  member: Member,
  input: Partial<QuestionInput>,
) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  const question = await prisma.question.findFirst({ where: { id: questionId, blockId } });
  if (!question) {
    throw new NotFoundError('Question not found');
  }
  const isStructuralChange =
    (input.questionType !== undefined && input.questionType !== question.questionType) || input.options !== undefined;
  if (isStructuralChange) {
    const answerCount = await countAnswersForQuestion(survey, questionId);
    if (answerCount > 0) {
      throw new ConflictError(
        'QUESTION_HAS_RESPONSES',
        'This question already has responses, so its type/options can no longer be restructured. You can still edit its prompt, required flag, or rating scale.',
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.options) {
      await tx.questionOption.deleteMany({ where: { questionId } });
      await tx.questionOption.createMany({
        data: input.options.map((label, idx) => ({ questionId, position: idx, label })),
      });
    }
    return tx.question.update({
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

export async function deleteQuestion(surveyId: string, blockId: string, questionId: string, member: Member) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  const question = await prisma.question.findFirst({ where: { id: questionId, blockId } });
  if (!question) {
    throw new NotFoundError('Question not found');
  }
  const answerCount = await countAnswersForQuestion(survey, questionId);
  if (answerCount > 0) {
    throw new ConflictError('QUESTION_HAS_RESPONSES', 'Cannot delete a question that already has responses.');
  }
  await prisma.question.delete({ where: { id: questionId } });
}

export async function reorderQuestions(surveyId: string, blockId: string, member: Member, questionIds: string[]) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);
  await getBlockOr404(surveyId, blockId);
  const existing = await prisma.question.findMany({ where: { blockId }, select: { id: true } });
  const existingIds = new Set(existing.map((q) => q.id));
  if (questionIds.length !== existing.length || !questionIds.every((id) => existingIds.has(id))) {
    throw new ValidationError('questionIds must match the full set of question ids in this block');
  }
  await prisma.$transaction(
    questionIds.map((id, idx) => prisma.question.update({ where: { id }, data: { position: idx + 1000 } })),
  );
  await prisma.$transaction(
    questionIds.map((id, idx) => prisma.question.update({ where: { id }, data: { position: idx } })),
  );
}

// ===== Recipients =====

async function findRespondedMemberIds(surveyId: string, survey: Survey, candidateMemberIds: string[]): Promise<Set<string>> {
  if (candidateMemberIds.length === 0) {
    return new Set();
  }
  if (survey.isAnonymous) {
    const rows = await prisma.surveyResponseAccess.findMany({
      where: { surveyId, memberId: { in: candidateMemberIds } },
      select: { memberId: true },
    });
    return new Set(rows.map((r) => r.memberId));
  }
  const rows = await prisma.attributedResponse.findMany({
    where: { surveyId, respondentMemberId: { in: candidateMemberIds } },
    select: { respondentMemberId: true },
  });
  return new Set(rows.map((r) => r.respondentMemberId));
}

export async function setRecipients(surveyId: string, member: Member, memberIds: string[]) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);

  // A recipient who already responded must stay on the target list even if the
  // caller's payload omitted them — dropping them here wouldn't delete their
  // response, it would just misrepresent who was actually invited.
  const currentRecipients = await prisma.surveyRecipient.findMany({ where: { surveyId }, select: { memberId: true } });
  const droppedCandidates = currentRecipients.map((r) => r.memberId).filter((id) => !memberIds.includes(id));
  const respondedIds = await findRespondedMemberIds(surveyId, survey, droppedCandidates);
  const protectedIds = droppedCandidates.filter((id) => respondedIds.has(id));
  const finalMemberIds = Array.from(new Set([...memberIds, ...protectedIds]));

  await prisma.$transaction([
    prisma.surveyRecipient.deleteMany({ where: { surveyId, memberId: { notIn: finalMemberIds } } }),
    ...finalMemberIds.map((memberId) =>
      prisma.surveyRecipient.upsert({
        where: { surveyId_memberId: { surveyId, memberId } },
        create: { surveyId, memberId },
        update: {},
      }),
    ),
  ]);

  return { protectedMemberIds: protectedIds };
}

export async function addRecipients(surveyId: string, member: Member, memberIds: string[]) {
  await assertSurveyOwnerOrAdmin(surveyId, member);
  await prisma.$transaction(
    memberIds.map((memberId) =>
      prisma.surveyRecipient.upsert({
        where: { surveyId_memberId: { surveyId, memberId } },
        create: { surveyId, memberId },
        update: {},
      }),
    ),
  );
}

export async function removeRecipient(surveyId: string, targetMemberId: string, member: Member) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  const respondedIds = await findRespondedMemberIds(surveyId, survey, [targetMemberId]);
  if (respondedIds.has(targetMemberId)) {
    throw new ConflictError('ALREADY_RESPONDED', 'Cannot remove a recipient who has already responded to this survey');
  }
  await prisma.surveyRecipient.delete({ where: { surveyId_memberId: { surveyId, memberId: targetMemberId } } }).catch(() => {
    throw new NotFoundError('Recipient not found');
  });
}

// Grants one specific recipient a single further submission. A respondent
// otherwise can never edit or resubmit once they've responded — this is the
// only way back in, and it's scoped to exactly one person at a time.
export async function reopenForRecipient(surveyId: string, targetMemberId: string, member: Member) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  if (survey.isAnonymous) {
    throw new ValidationError('Anonymous surveys cannot be reopened for a specific person');
  }
  const recipient = await prisma.surveyRecipient.findUnique({
    where: { surveyId_memberId: { surveyId, memberId: targetMemberId } },
  });
  if (!recipient) {
    throw new NotFoundError('Recipient not found');
  }
  const respondedIds = await findRespondedMemberIds(surveyId, survey, [targetMemberId]);
  if (!respondedIds.has(targetMemberId)) {
    throw new ConflictError('NOT_YET_RESPONDED', 'This person has not submitted a response yet — there is nothing to reopen');
  }
  await prisma.surveyRecipient.update({
    where: { surveyId_memberId: { surveyId, memberId: targetMemberId } },
    data: { resubmitAllowed: true },
  });
}

// ===== Viewer grants =====
// A narrow exception granted by an Auditor (or Admin) letting one specific
// member/creator see this survey's dashboard regardless of group. Applies at
// any survey status — unlike most mutations here, this is never gated by
// assertDraft.

export async function listViewers(surveyId: string, member: Member) {
  await assertCanManageViewers(surveyId, member);
  const viewers = await prisma.surveyViewer.findMany({
    where: { surveyId },
    include: { member: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return viewers.map((v) => v.member);
}

export async function grantViewer(surveyId: string, targetMemberId: string, member: Member) {
  await assertCanManageViewers(surveyId, member);
  await prisma.surveyViewer.upsert({
    where: { surveyId_memberId: { surveyId, memberId: targetMemberId } },
    create: { surveyId, memberId: targetMemberId, grantedById: member.id },
    update: {},
  });
  await recordAuditLog({
    actorId: member.id,
    action: 'SURVEY_VIEWER_GRANTED',
    targetType: 'Survey',
    targetId: surveyId,
    metadata: { memberId: targetMemberId },
  });
}

export async function revokeViewer(surveyId: string, targetMemberId: string, member: Member) {
  await assertCanManageViewers(surveyId, member);
  await prisma.surveyViewer.delete({ where: { surveyId_memberId: { surveyId, memberId: targetMemberId } } }).catch(() => {
    throw new NotFoundError('Viewer grant not found');
  });
  await recordAuditLog({
    actorId: member.id,
    action: 'SURVEY_VIEWER_REVOKED',
    targetType: 'Survey',
    targetId: surveyId,
    metadata: { memberId: targetMemberId },
  });
}

export { getSurveyOr404 };
