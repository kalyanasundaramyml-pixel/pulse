import { Survey, User } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import { ensureNotPastEndDate } from './autoClose';

export async function getSurveyOr404(surveyId: string): Promise<Survey> {
  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) {
    throw new NotFoundError('Survey not found');
  }
  return ensureNotPastEndDate(survey);
}

export async function assertSurveyOwnerOrAdmin(surveyId: string, user: User): Promise<Survey> {
  const survey = await getSurveyOr404(surveyId);
  if (user.role !== 'ADMIN' && survey.createdById !== user.id) {
    throw new ForbiddenError('Only the survey creator or an Admin may perform this action');
  }
  return survey;
}

// Read-and-use rule for templates: the owner/Admin, same as everywhere else,
// OR any Leader/Admin when the survey is a public template. This is
// deliberately narrower than assertSurveyOwnerOrAdmin — it is only ever used
// for viewing a template and duplicating it, never for editing it in place.
export async function assertCanViewOrUseTemplate(surveyId: string, user: User): Promise<Survey> {
  const survey = await getSurveyOr404(surveyId);
  const isOwnerOrAdmin = user.role === 'ADMIN' || survey.createdById === user.id;
  const isPublicTemplateForLeader = survey.isTemplate && survey.isPublic && (user.role === 'LEADER' || user.role === 'ADMIN');
  if (!isOwnerOrAdmin && !isPublicTemplateForLeader) {
    throw new ForbiddenError('Only the survey creator, an Admin, or (for a public template) another Leader may view this');
  }
  return survey;
}

export async function assertIsRecipient(surveyId: string, user: User): Promise<Survey> {
  const survey = await getSurveyOr404(surveyId);
  const recipient = await prisma.surveyRecipient.findUnique({
    where: { surveyId_userId: { surveyId, userId: user.id } },
  });
  if (!recipient) {
    throw new ForbiddenError('You are not a recipient of this survey');
  }
  return survey;
}
