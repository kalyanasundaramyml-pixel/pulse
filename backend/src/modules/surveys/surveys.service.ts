import { Survey, Member } from '@prisma/client';
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
          maxChoices: q.maxChoices,
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

// ===== Draft save =====
// A survey is Welcome -> N named QUESTIONS blocks -> End. Welcome/End are
// created once (in createSurvey/duplicateSurvey) and can never be added,
// deleted, or reordered — only their title/body text is editable. Every
// block/question add/edit/delete/reorder/move is staged client-side and
// applied here in one transactional call — see the plan doc for the
// position-collision-avoiding step ordering.

async function countAnswersForQuestion(survey: Survey, questionId: string): Promise<number> {
  return survey.isAnonymous
    ? prisma.anonymousAnswer.count({ where: { questionId } })
    : prisma.attributedAnswer.count({ where: { questionId } });
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
  isAnonymous?: boolean;
  endDate?: string | null;
  blocks: DraftBlockInput[];
}

function optionsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const TEMP_POSITION_OFFSET = 100000;

export async function saveDraft(surveyId: string, member: Member, input: SaveDraftInput) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, member);
  assertDraft(survey);

  if (input.isAnonymous !== undefined && input.isAnonymous !== survey.isAnonymous && survey.publishedAt != null) {
    throw new ConflictError(
      'ANONYMITY_LOCKED',
      'This survey has already been published once, so its anonymous/attributed setting can no longer change — respondents relied on that promise.',
    );
  }
  if (input.title !== survey.title) {
    await assertUniqueSurveyTitle(survey.createdById, input.title, surveyId);
  }

  const currentBlocks = await prisma.surveyBlock.findMany({
    where: { surveyId },
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
    throw new ValidationError('A survey must have at least a Welcome and an End block');
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
    const answerCount = await countAnswersForQuestion(survey, q.id);
    if (answerCount > 0) {
      conflicts.push({ questionId: q.id, prompt: q.prompt, reason: 'has responses and cannot be deleted' });
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
        const answerCount = await countAnswersForQuestion(survey, q.id);
        if (answerCount > 0) {
          conflicts.push({
            questionId: q.id,
            prompt: q.prompt,
            reason: 'already has responses, so its type/options/max choices can no longer change',
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
    await tx.survey.update({
      where: { id: surveyId },
      data: {
        title: input.title,
        description: input.description,
        isAnonymous: input.isAnonymous,
        endDate: input.endDate === undefined ? undefined : input.endDate ? new Date(input.endDate) : null,
      },
    });

    // 1. Temp-park every block — existing blocks move off their current
    //    position (which may collide with another block's final target
    //    position later in step 5) and new blocks are created directly at a
    //    temp position. Nothing is at its final 0..N-1 position after this.
    const blockRealId: string[] = [];
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      if (b.id) {
        await tx.surveyBlock.update({ where: { id: b.id }, data: { position: TEMP_POSITION_OFFSET + i } });
        blockRealId[i] = b.id;
      } else {
        const created = await tx.surveyBlock.create({
          data: { surveyId, position: TEMP_POSITION_OFFSET + i, blockType: 'QUESTIONS', name: b.name },
        });
        blockRealId[i] = created.id;
      }
    }

    // 2. Move every surviving question to its (possibly new) block, parked
    //    at a temp position — BEFORE any block is deleted, since a question
    //    can only be reassigned to a block that still exists.
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      for (let qi = 0; qi < b.questions.length; qi++) {
        const q = b.questions[qi];
        if (q.id) {
          await tx.question.update({
            where: { id: q.id },
            data: { blockId: blockRealId[i], position: TEMP_POSITION_OFFSET + qi },
          });
        }
      }
    }

    // 3. Delete blocks dropped from the payload — safe now (surviving
    //    questions were already moved out in step 2; anything left cascades,
    //    and the pre-flight check already proved it has no responses).
    if (blocksToDelete.length > 0) {
      await tx.surveyBlock.deleteMany({ where: { id: { in: blocksToDelete.map((b) => b.id) } } });
    }

    // 4. Delete questions dropped from the payload whose block survived.
    if (questionsToDelete.length > 0) {
      await tx.question.deleteMany({ where: { id: { in: questionsToDelete.map((q) => q.id) } } });
    }

    // 5. Reposition every surviving/new block to its final position, and
    //    write Welcome/End title+body / QUESTIONS block name.
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      await tx.surveyBlock.update({
        where: { id: blockRealId[i] },
        data: { position: i, name: b.name, title: b.title, body: b.body },
      });
    }

    // 6. Create new questions directly at their final position (real
    //    positions 0..N-1 in the target block were vacated by step 2's
    //    temp-park, so no collision is possible).
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      for (let qi = 0; qi < b.questions.length; qi++) {
        const q = b.questions[qi];
        if (!q.id) {
          await tx.question.create({
            data: {
              surveyId,
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
          await tx.questionOption.deleteMany({ where: { questionId: q.id } });
          await tx.questionOption.createMany({
            data: q.options.map((label, idx) => ({ questionId: q.id!, position: idx, label })),
          });
        }
        await tx.question.update({
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

  return getSurveyDetail(surveyId, member);
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
