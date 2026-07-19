import { Survey } from '@prisma/client';
import { prisma } from '../../db/prisma';

// Lazily flips a PUBLISHED survey to CLOSED once its optional end date has
// passed. Called wherever survey status is read for a status-sensitive
// decision (taking/submitting a response, viewing the dashboard, editing).
export async function ensureNotPastEndDate(survey: Survey): Promise<Survey> {
  if (survey.status === 'PUBLISHED' && survey.endDate && survey.endDate < new Date()) {
    return prisma.survey.update({
      where: { id: survey.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }
  return survey;
}
