import { QuestionType, Survey, User } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { assertSurveyOwnerOrAdmin, assertCanViewOrUseTemplate, getSurveyOr404 } from './surveyAuth';
import { recordAuditLog } from '../../lib/auditLog';

function assertDraft(survey: Survey) {
  if (survey.status !== 'DRAFT') {
    throw new ConflictError('SURVEY_NOT_DRAFT', 'This action is only allowed while the survey is a draft');
  }
}

export async function createSurvey(
  user: User,
  input: { title: string; description?: string; isAnonymous: boolean; endDate?: string | null; isTemplate?: boolean },
) {
  return prisma.survey.create({
    data: {
      title: input.title,
      description: input.description,
      isAnonymous: input.isAnonymous,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      isTemplate: input.isTemplate ?? false,
      createdById: user.id,
    },
  });
}

export async function listSurveys(
  user: User,
  opts: { scope: 'created' | 'targeted' | 'all' | 'public'; status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED' },
) {
  if (opts.scope === 'all' && user.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Only Admins may list all surveys');
  }

  if (opts.scope === 'targeted') {
    return prisma.survey.findMany({
      where: {
        status: opts.status,
        recipients: { some: { userId: user.id } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (opts.scope === 'all') {
    return prisma.survey.findMany({ where: { status: opts.status }, orderBy: { createdAt: 'desc' } });
  }

  if (opts.scope === 'public') {
    return prisma.survey.findMany({
      where: { isTemplate: true, isPublic: true, createdById: { not: user.id } },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  return prisma.survey.findMany({
    where: { createdById: user.id, status: opts.status },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getSurveyDetail(surveyId: string, user: User) {
  await assertCanViewOrUseTemplate(surveyId, user);
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
      recipients: { include: { user: { select: { id: true, name: true, email: true } } } },
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
  user: User,
  input: { title?: string; description?: string; isAnonymous?: boolean; endDate?: string | null; isPublic?: boolean },
) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
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

export async function deleteSurvey(surveyId: string, user: User) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
  assertDraft(survey);
  await prisma.survey.delete({ where: { id: surveyId } });
}

export async function publishSurvey(surveyId: string, user: User) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
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
    actorId: user.id,
    action: 'SURVEY_PUBLISHED',
    targetType: 'Survey',
    targetId: surveyId,
    metadata: { isAnonymous: survey.isAnonymous, recipientCount },
  });
  return published;
}

export async function closeSurvey(surveyId: string, user: User) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
  if (survey.status !== 'PUBLISHED') {
    throw new ConflictError('SURVEY_NOT_PUBLISHED', 'Only a published survey can be closed');
  }
  const closed = await prisma.survey.update({ where: { id: surveyId }, data: { status: 'CLOSED', closedAt: new Date() } });
  await recordAuditLog({ actorId: user.id, action: 'SURVEY_CLOSED', targetType: 'Survey', targetId: surveyId });
  return closed;
}

export async function unpublishSurvey(surveyId: string, user: User) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
  if (survey.status !== 'PUBLISHED' && survey.status !== 'CLOSED') {
    throw new ConflictError('SURVEY_NOT_LIVE', 'Only a published or closed survey can be unpublished for editing');
  }
  // publishedAt / closedAt are left untouched — the isAnonymous lock keys off
  // "has this survey ever been published", not its current status.
  const draft = await prisma.survey.update({ where: { id: surveyId }, data: { status: 'DRAFT' } });
  await recordAuditLog({ actorId: user.id, action: 'SURVEY_UNPUBLISHED', targetType: 'Survey', targetId: surveyId });
  return draft;
}

export async function reopenSurvey(surveyId: string, user: User, endDate?: string | null) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
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
  await recordAuditLog({ actorId: user.id, action: 'SURVEY_REOPENED', targetType: 'Survey', targetId: surveyId });
  return reopened;
}

export async function duplicateSurvey(surveyId: string, user: User, asTemplate: boolean) {
  const survey = await assertCanViewOrUseTemplate(surveyId, user);
  const [questions, recipients] = await Promise.all([
    prisma.question.findMany({
      where: { surveyId },
      orderBy: { position: 'asc' },
      include: { options: { orderBy: { position: 'asc' } } },
    }),
    prisma.surveyRecipient.findMany({ where: { surveyId }, select: { userId: true } }),
  ]);

  const duplicate = await prisma.survey.create({
    data: {
      title: `Copy of ${survey.title}`,
      description: survey.description,
      isAnonymous: survey.isAnonymous,
      isTemplate: asTemplate,
      isPublic: false,
      createdById: user.id,
      recipients: { create: recipients.map((r) => ({ userId: r.userId })) },
      questions: {
        create: questions.map((q) => ({
          position: q.position,
          questionType: q.questionType,
          prompt: q.prompt,
          isRequired: q.isRequired,
          ratingScaleMin: q.ratingScaleMin,
          ratingScaleMax: q.ratingScaleMax,
          options: { create: q.options.map((o) => ({ position: o.position, label: o.label })) },
        })),
      },
    },
  });

  await recordAuditLog({
    actorId: user.id,
    action: 'SURVEY_DUPLICATED',
    targetType: 'Survey',
    targetId: duplicate.id,
    metadata: { sourceSurveyId: surveyId },
  });

  return duplicate;
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

export async function addQuestion(surveyId: string, user: User, input: QuestionInput) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
  assertDraft(survey);
  const maxPosition = await prisma.question.aggregate({ where: { surveyId }, _max: { position: true } });
  const position = (maxPosition._max.position ?? -1) + 1;

  return prisma.question.create({
    data: {
      surveyId,
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

export async function updateQuestion(surveyId: string, questionId: string, user: User, input: Partial<QuestionInput>) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
  assertDraft(survey);
  const question = await prisma.question.findFirst({ where: { id: questionId, surveyId } });
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

export async function deleteQuestion(surveyId: string, questionId: string, user: User) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
  assertDraft(survey);
  const question = await prisma.question.findFirst({ where: { id: questionId, surveyId } });
  if (!question) {
    throw new NotFoundError('Question not found');
  }
  const answerCount = await countAnswersForQuestion(survey, questionId);
  if (answerCount > 0) {
    throw new ConflictError('QUESTION_HAS_RESPONSES', 'Cannot delete a question that already has responses.');
  }
  await prisma.question.delete({ where: { id: questionId } });
}

export async function reorderQuestions(surveyId: string, user: User, questionIds: string[]) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
  assertDraft(survey);
  const existing = await prisma.question.findMany({ where: { surveyId }, select: { id: true } });
  const existingIds = new Set(existing.map((q) => q.id));
  if (questionIds.length !== existing.length || !questionIds.every((id) => existingIds.has(id))) {
    throw new ValidationError('questionIds must match the full set of question ids on this survey');
  }
  await prisma.$transaction(
    questionIds.map((id, idx) => prisma.question.update({ where: { id }, data: { position: idx + 1000 } })),
  );
  await prisma.$transaction(
    questionIds.map((id, idx) => prisma.question.update({ where: { id }, data: { position: idx } })),
  );
}

// ===== Recipients =====

async function findRespondedUserIds(surveyId: string, survey: Survey, candidateUserIds: string[]): Promise<Set<string>> {
  if (candidateUserIds.length === 0) {
    return new Set();
  }
  if (survey.isAnonymous) {
    const rows = await prisma.surveyResponseAccess.findMany({
      where: { surveyId, userId: { in: candidateUserIds } },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId));
  }
  const rows = await prisma.attributedResponse.findMany({
    where: { surveyId, respondentUserId: { in: candidateUserIds } },
    select: { respondentUserId: true },
  });
  return new Set(rows.map((r) => r.respondentUserId));
}

export async function setRecipients(surveyId: string, user: User, userIds: string[]) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);

  // A recipient who already responded must stay on the target list even if the
  // caller's payload omitted them — dropping them here wouldn't delete their
  // response, it would just misrepresent who was actually invited.
  const currentRecipients = await prisma.surveyRecipient.findMany({ where: { surveyId }, select: { userId: true } });
  const droppedCandidates = currentRecipients.map((r) => r.userId).filter((id) => !userIds.includes(id));
  const respondedIds = await findRespondedUserIds(surveyId, survey, droppedCandidates);
  const protectedIds = droppedCandidates.filter((id) => respondedIds.has(id));
  const finalUserIds = Array.from(new Set([...userIds, ...protectedIds]));

  await prisma.$transaction([
    prisma.surveyRecipient.deleteMany({ where: { surveyId, userId: { notIn: finalUserIds } } }),
    ...finalUserIds.map((userId) =>
      prisma.surveyRecipient.upsert({
        where: { surveyId_userId: { surveyId, userId } },
        create: { surveyId, userId },
        update: {},
      }),
    ),
  ]);

  return { protectedUserIds: protectedIds };
}

export async function addRecipients(surveyId: string, user: User, userIds: string[]) {
  await assertSurveyOwnerOrAdmin(surveyId, user);
  await prisma.$transaction(
    userIds.map((userId) =>
      prisma.surveyRecipient.upsert({
        where: { surveyId_userId: { surveyId, userId } },
        create: { surveyId, userId },
        update: {},
      }),
    ),
  );
}

export async function removeRecipient(surveyId: string, targetUserId: string, user: User) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);
  const respondedIds = await findRespondedUserIds(surveyId, survey, [targetUserId]);
  if (respondedIds.has(targetUserId)) {
    throw new ConflictError('ALREADY_RESPONDED', 'Cannot remove a recipient who has already responded to this survey');
  }
  await prisma.surveyRecipient.delete({ where: { surveyId_userId: { surveyId, userId: targetUserId } } }).catch(() => {
    throw new NotFoundError('Recipient not found');
  });
}

export { getSurveyOr404 };
