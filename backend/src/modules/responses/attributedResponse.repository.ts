import { prisma } from '../../db/prisma';

interface AnswerInput {
  questionId: string;
  ratingValue?: number;
  textValue?: string;
  selectedOptionIds?: string[];
  commentText?: string;
}

export async function getMyResponseWithAnswers(surveyId: string, memberId: string) {
  return prisma.attributedResponse.findUnique({
    where: { surveyId_respondentMemberId: { surveyId, respondentMemberId: memberId } },
    include: { answers: { include: { selectedOptions: true } } },
  });
}

export async function createResponse(surveyId: string, memberId: string, answers: AnswerInput[]) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.attributedResponse.findUnique({
      where: { surveyId_respondentMemberId: { surveyId, respondentMemberId: memberId } },
    });
    if (existing) {
      return { alreadyExisted: true as const, responseId: existing.id };
    }

    const response = await tx.attributedResponse.create({ data: { surveyId, respondentMemberId: memberId } });

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
