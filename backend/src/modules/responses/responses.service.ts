import { User } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { assertIsRecipient } from '../surveys/surveyAuth';
import * as anonymousRepo from './anonymousResponse.repository';
import * as attributedRepo from './attributedResponse.repository';

interface AnswerInput {
  questionId: string;
  ratingValue?: number;
  textValue?: string;
  selectedOptionIds?: string[];
  commentText?: string;
}

async function validateAnswers(surveyId: string, answers: AnswerInput[]) {
  const questions = await prisma.question.findMany({
    where: { surveyId },
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

export async function getTakeSurvey(surveyId: string, user: User) {
  const survey = await assertIsRecipient(surveyId, user);

  const blocks = await prisma.surveyBlock.findMany({
    where: { surveyId },
    orderBy: { position: 'asc' },
    include: {
      questions: { orderBy: { position: 'asc' }, include: { options: { orderBy: { position: 'asc' } } } },
    },
  });

  const myResponse = survey.isAnonymous
    ? await anonymousRepo.getMyResponseWithAnswers(surveyId, user.id)
    : await attributedRepo.getMyResponseWithAnswers(surveyId, user.id);

  return {
    survey: {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      isAnonymous: survey.isAnonymous,
      status: survey.status,
    },
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
    alreadyResponded: myResponse != null,
    myResponse: myResponse
      ? {
          answers: myResponse.answers.map((a) => ({
            questionId: a.questionId,
            ratingValue: a.ratingValue ?? undefined,
            textValue: a.textValue ?? undefined,
            selectedOptionIds: a.selectedOptions.map((so) => so.optionId),
            commentText: a.commentText ?? undefined,
          })),
          submittedAt: myResponse.submittedAt,
          updatedAt: myResponse.updatedAt,
        }
      : null,
  };
}

export async function submitResponse(surveyId: string, user: User, answers: AnswerInput[]) {
  const survey = await assertIsRecipient(surveyId, user);
  if (survey.status !== 'PUBLISHED') {
    throw new ConflictError('SURVEY_NOT_PUBLISHED', 'This survey is not currently accepting responses');
  }
  await validateAnswers(surveyId, answers);

  if (survey.isAnonymous) {
    const result = await anonymousRepo.createResponse(surveyId, user.id, answers);
    if (result.alreadyExisted) {
      throw new ConflictError('ALREADY_RESPONDED', 'You have already responded to this survey. Use PATCH to edit your response.');
    }
    return { responseId: result.responseId };
  }

  const result = await attributedRepo.createResponse(surveyId, user.id, answers);
  if (result.alreadyExisted) {
    throw new ConflictError('ALREADY_RESPONDED', 'You have already responded to this survey. Use PATCH to edit your response.');
  }
  return { responseId: result.responseId };
}

export async function editResponse(surveyId: string, user: User, answers: AnswerInput[]) {
  const survey = await assertIsRecipient(surveyId, user);
  if (survey.status !== 'PUBLISHED') {
    throw new ConflictError('SURVEY_NOT_PUBLISHED', 'This survey is not currently accepting responses');
  }
  await validateAnswers(surveyId, answers);

  if (survey.isAnonymous) {
    const responseId = await anonymousRepo.findMyResponseId(surveyId, user.id);
    if (!responseId) {
      throw new NotFoundError('No existing response to edit. Submit one first with POST.');
    }
    await anonymousRepo.updateResponse(responseId, answers);
    return { responseId };
  }

  const existing = await attributedRepo.getMyResponseWithAnswers(surveyId, user.id);
  if (!existing) {
    throw new NotFoundError('No existing response to edit. Submit one first with POST.');
  }
  await attributedRepo.updateResponse(existing.id, answers);
  return { responseId: existing.id };
}

export async function getMyResponse(surveyId: string, user: User) {
  const survey = await assertIsRecipient(surveyId, user);
  const response = survey.isAnonymous
    ? await anonymousRepo.getMyResponseWithAnswers(surveyId, user.id)
    : await attributedRepo.getMyResponseWithAnswers(surveyId, user.id);
  if (!response) {
    throw new NotFoundError('You have not responded to this survey yet');
  }
  return {
    answers: response.answers.map((a) => ({
      questionId: a.questionId,
      ratingValue: a.ratingValue ?? undefined,
      textValue: a.textValue ?? undefined,
      selectedOptionIds: a.selectedOptions.map((so) => so.optionId),
      commentText: a.commentText ?? undefined,
    })),
    submittedAt: response.submittedAt,
    updatedAt: response.updatedAt,
  };
}
