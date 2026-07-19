// Sole owner of reads/writes against survey_response_access. This is the ONLY
// module allowed to import the SurveyResponseAccess model. It exists purely to
// answer "has this user already responded" and "which response is theirs" for
// the responding user's own request — never for leader/dashboard queries.
// Enforced by an ESLint no-restricted-imports rule on modules/dashboard/**.
import { prisma } from '../../db/prisma';

interface AnswerInput {
  questionId: string;
  ratingValue?: number;
  textValue?: string;
  selectedOptionIds?: string[];
  commentText?: string;
}

export async function findMyResponseId(surveyId: string, userId: string): Promise<string | null> {
  const access = await prisma.surveyResponseAccess.findUnique({
    where: { surveyId_userId: { surveyId, userId } },
    select: { responseId: true },
  });
  return access?.responseId ?? null;
}

export async function getMyResponseWithAnswers(surveyId: string, userId: string) {
  const responseId = await findMyResponseId(surveyId, userId);
  if (!responseId) {
    return null;
  }
  return prisma.anonymousResponse.findUnique({
    where: { id: responseId },
    include: { answers: { include: { selectedOptions: true } } },
  });
}

export async function createResponse(surveyId: string, userId: string, answers: AnswerInput[]) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.surveyResponseAccess.findUnique({
      where: { surveyId_userId: { surveyId, userId } },
    });
    if (existing) {
      return { alreadyExisted: true as const, responseId: existing.responseId };
    }

    const response = await tx.anonymousResponse.create({ data: { surveyId } });

    for (const answer of answers) {
      const created = await tx.anonymousAnswer.create({
        data: {
          responseId: response.id,
          questionId: answer.questionId,
          ratingValue: answer.ratingValue,
          textValue: answer.textValue,
          commentText: answer.commentText,
        },
      });
      if (answer.selectedOptionIds?.length) {
        await tx.anonymousAnswerOption.createMany({
          data: answer.selectedOptionIds.map((optionId) => ({ answerId: created.id, optionId })),
        });
      }
    }

    // This is the only place in the codebase that writes to survey_response_access.
    await tx.surveyResponseAccess.create({
      data: { surveyId, userId, responseId: response.id },
    });

    return { alreadyExisted: false as const, responseId: response.id };
  });
}

export async function updateResponse(responseId: string, answers: AnswerInput[]) {
  return prisma.$transaction(async (tx) => {
    await tx.anonymousAnswer.deleteMany({ where: { responseId } });
    for (const answer of answers) {
      const created = await tx.anonymousAnswer.create({
        data: {
          responseId,
          questionId: answer.questionId,
          ratingValue: answer.ratingValue,
          textValue: answer.textValue,
          commentText: answer.commentText,
        },
      });
      if (answer.selectedOptionIds?.length) {
        await tx.anonymousAnswerOption.createMany({
          data: answer.selectedOptionIds.map((optionId) => ({ answerId: created.id, optionId })),
        });
      }
    }
    await tx.anonymousResponse.update({ where: { id: responseId }, data: { updatedAt: new Date() } });
  });
}
