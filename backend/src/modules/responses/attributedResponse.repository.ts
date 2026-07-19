import { prisma } from '../../db/prisma';

interface AnswerInput {
  questionId: string;
  ratingValue?: number;
  textValue?: string;
  selectedOptionIds?: string[];
  commentText?: string;
}

export async function getMyResponseWithAnswers(surveyId: string, userId: string) {
  return prisma.attributedResponse.findUnique({
    where: { surveyId_respondentUserId: { surveyId, respondentUserId: userId } },
    include: { answers: { include: { selectedOptions: true } } },
  });
}

export async function createResponse(surveyId: string, userId: string, answers: AnswerInput[]) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.attributedResponse.findUnique({
      where: { surveyId_respondentUserId: { surveyId, respondentUserId: userId } },
    });
    if (existing) {
      return { alreadyExisted: true as const, responseId: existing.id };
    }

    const response = await tx.attributedResponse.create({ data: { surveyId, respondentUserId: userId } });

    for (const answer of answers) {
      const created = await tx.attributedAnswer.create({
        data: {
          responseId: response.id,
          questionId: answer.questionId,
          ratingValue: answer.ratingValue,
          textValue: answer.textValue,
          commentText: answer.commentText,
        },
      });
      if (answer.selectedOptionIds?.length) {
        await tx.attributedAnswerOption.createMany({
          data: answer.selectedOptionIds.map((optionId) => ({ answerId: created.id, optionId })),
        });
      }
    }

    return { alreadyExisted: false as const, responseId: response.id };
  });
}

export async function updateResponse(responseId: string, answers: AnswerInput[]) {
  return prisma.$transaction(async (tx) => {
    await tx.attributedAnswer.deleteMany({ where: { responseId } });
    for (const answer of answers) {
      const created = await tx.attributedAnswer.create({
        data: {
          responseId,
          questionId: answer.questionId,
          ratingValue: answer.ratingValue,
          textValue: answer.textValue,
          commentText: answer.commentText,
        },
      });
      if (answer.selectedOptionIds?.length) {
        await tx.attributedAnswerOption.createMany({
          data: answer.selectedOptionIds.map((optionId) => ({ answerId: created.id, optionId })),
        });
      }
    }
    await tx.attributedResponse.update({ where: { id: responseId }, data: { updatedAt: new Date() } });
  });
}
