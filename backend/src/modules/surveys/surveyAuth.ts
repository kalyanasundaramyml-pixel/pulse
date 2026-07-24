import { Survey, Member } from '@prisma/client';
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

export async function assertSurveyOwnerOrAdmin(surveyId: string, member: Member): Promise<Survey> {
  const survey = await getSurveyOr404(surveyId);
  if (member.role !== 'ADMIN' && survey.createdById !== member.id) {
    throw new ForbiddenError('Only the survey creator or an Admin may perform this action');
  }
  return survey;
}

// Read-and-use rule for templates: the owner/Admin, same as everywhere else,
// OR any Creator/Admin when the survey is a public template. This is
// deliberately narrower than assertSurveyOwnerOrAdmin — it is only ever used
// for viewing a template and duplicating it, never for editing it in place.
export async function assertCanViewOrUseTemplate(surveyId: string, member: Member): Promise<Survey> {
  const survey = await getSurveyOr404(surveyId);
  const isOwnerOrAdmin = member.role === 'ADMIN' || survey.createdById === member.id;
  const isPublicTemplateForCreator = survey.isTemplate && survey.isPublic && (member.role === 'CREATOR' || member.role === 'ADMIN');
  if (!isOwnerOrAdmin && !isPublicTemplateForCreator) {
    throw new ForbiddenError('Only the survey creator, an Admin, or (for a public template) another Creator may view this');
  }
  return survey;
}

export async function assertIsRecipient(surveyId: string, member: Member): Promise<Survey> {
  const survey = await getSurveyOr404(surveyId);
  const recipient = await prisma.surveyRecipient.findUnique({
    where: { surveyId_memberId: { surveyId, memberId: member.id } },
  });
  if (!recipient) {
    throw new ForbiddenError('You are not a recipient of this survey');
  }
  return survey;
}

// Read-only oversight rule for the dashboard: owner/Admin (as usual), OR an
// Auditor whose own group matches the survey creator's group (never the
// recipients' groups — see Group), OR a member holding an explicit
// SurveyViewer grant for this one survey.
export async function assertCanViewSurveyDashboard(surveyId: string, member: Member): Promise<Survey> {
  const survey = await getSurveyOr404(surveyId);
  if (member.role === 'ADMIN' || survey.createdById === member.id) {
    return survey;
  }
  if (member.role === 'AUDITOR') {
    const creator = await prisma.member.findUnique({ where: { id: survey.createdById }, select: { groupId: true } });
    if (creator?.groupId === member.groupId) {
      return survey;
    }
  }
  const viewerGrant = await prisma.surveyViewer.findUnique({
    where: { surveyId_memberId: { surveyId, memberId: member.id } },
  });
  if (viewerGrant) {
    return survey;
  }
  throw new ForbiddenError('You do not have access to this survey\'s dashboard');
}

// Only an Admin, or the Auditor of the survey's own owning group, may grant
// or revoke Viewer access — never the survey's own creator.
export async function assertCanManageViewers(surveyId: string, member: Member): Promise<Survey> {
  const survey = await getSurveyOr404(surveyId);
  if (member.role === 'ADMIN') {
    return survey;
  }
  if (member.role === 'AUDITOR') {
    const creator = await prisma.member.findUnique({ where: { id: survey.createdById }, select: { groupId: true } });
    if (creator?.groupId === member.groupId) {
      return survey;
    }
  }
  throw new ForbiddenError('Only an Admin or the Auditor of this survey\'s group may manage viewers');
}
