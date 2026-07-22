// Dashboard aggregation. This module must NEVER import
// ../responses/anonymousResponse.repository (enforced by ESLint
// no-restricted-imports) — anonymous survey results must stay structurally
// unlinkable to any respondent, even for an Admin viewing the dashboard.
import { User } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { assertSurveyOwnerOrAdmin } from '../surveys/surveyAuth';

const MIN_RESPONSES = env.MIN_ANONYMOUS_RESPONSES_FOR_BREAKDOWN;

interface RatingSummary {
  withheld: false;
  average: number;
  distribution: Record<number, number>;
  comments: string[];
}
interface ChoiceSummary {
  withheld: false;
  tally: Record<string, number>; // optionId -> count
  comments: string[];
}
interface TextSummary {
  withheld: false;
  responses: string[];
}
interface Withheld {
  withheld: true;
  responseCount: number;
  minRequired: number;
}

async function buildQuestionSummaries(surveyId: string, isAnonymous: boolean, respondedCount: number) {
  const questions = await prisma.question.findMany({
    where: { surveyId },
    orderBy: [{ block: { position: 'asc' } }, { position: 'asc' }],
    include: { options: { orderBy: { position: 'asc' } } },
  });

  const withhold = isAnonymous && respondedCount < MIN_RESPONSES;

  const summaries = await Promise.all(
    questions.map(async (q) => {
      const base = { questionId: q.id, prompt: q.prompt, type: q.questionType };

      if (withhold) {
        const withheld: Withheld = { withheld: true, responseCount: respondedCount, minRequired: MIN_RESPONSES };
        return { ...base, summary: withheld };
      }

      if (q.questionType === 'RATING') {
        const rows = isAnonymous
          ? await prisma.anonymousAnswer.findMany({
              where: { questionId: q.id },
              select: { ratingValue: true, commentText: true },
            })
          : await prisma.attributedAnswer.findMany({
              where: { questionId: q.id },
              select: { ratingValue: true, commentText: true },
            });
        const values = rows.map((r) => r.ratingValue).filter((v): v is number => v != null);
        const distribution: Record<number, number> = {};
        for (const v of values) {
          distribution[v] = (distribution[v] ?? 0) + 1;
        }
        const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        const comments = rows.map((r) => r.commentText).filter((v): v is string => !!v);
        const summary: RatingSummary = { withheld: false, average, distribution, comments };
        return { ...base, summary };
      }

      if (q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTI_CHOICE') {
        const [optionRows, answerRows] = isAnonymous
          ? await Promise.all([
              prisma.anonymousAnswerOption.findMany({
                where: { answer: { questionId: q.id } },
                select: { optionId: true },
              }),
              prisma.anonymousAnswer.findMany({ where: { questionId: q.id }, select: { commentText: true } }),
            ])
          : await Promise.all([
              prisma.attributedAnswerOption.findMany({
                where: { answer: { questionId: q.id } },
                select: { optionId: true },
              }),
              prisma.attributedAnswer.findMany({ where: { questionId: q.id }, select: { commentText: true } }),
            ]);
        const tally: Record<string, number> = {};
        for (const o of q.options) {
          tally[o.id] = 0;
        }
        for (const row of optionRows) {
          tally[row.optionId] = (tally[row.optionId] ?? 0) + 1;
        }
        const comments = answerRows.map((r) => r.commentText).filter((v): v is string => !!v);
        const summary: ChoiceSummary = { withheld: false, tally, comments };
        return { ...base, summary, options: q.options.map((o) => ({ id: o.id, label: o.label })) };
      }

      // TEXT
      const rows = isAnonymous
        ? await prisma.anonymousAnswer.findMany({ where: { questionId: q.id }, select: { textValue: true } })
        : await prisma.attributedAnswer.findMany({ where: { questionId: q.id }, select: { textValue: true } });
      const summary: TextSummary = { withheld: false, responses: rows.map((r) => r.textValue).filter((v): v is string => !!v) };
      return { ...base, summary };
    }),
  );

  return summaries;
}

export async function getDashboard(surveyId: string, user: User) {
  const survey = await assertSurveyOwnerOrAdmin(surveyId, user);

  const [targetCount, respondedCount] = await Promise.all([
    prisma.surveyRecipient.count({ where: { surveyId } }),
    survey.isAnonymous
      ? prisma.anonymousResponse.count({ where: { surveyId } })
      : prisma.attributedResponse.count({ where: { surveyId } }),
  ]);

  const questions = await buildQuestionSummaries(surveyId, survey.isAnonymous, respondedCount);

  const base = {
    survey: { id: survey.id, title: survey.title, isAnonymous: survey.isAnonymous, status: survey.status },
    completion: {
      targetCount,
      respondedCount,
      rate: targetCount > 0 ? respondedCount / targetCount : 0,
    },
    questions,
  };

  if (survey.isAnonymous) {
    // AnonymousDashboardDTO: no `respondents` field exists on this branch at all.
    return base;
  }

  // AttributedDashboardDTO: includes respondent identities.
  const responses = await prisma.attributedResponse.findMany({
    where: { surveyId },
    include: { respondentUser: { select: { id: true, name: true, email: true } } },
  });

  return {
    ...base,
    respondents: responses.map((r) => ({
      userId: r.respondentUser.id,
      name: r.respondentUser.name,
      email: r.respondentUser.email,
      submittedAt: r.submittedAt,
      updatedAt: r.updatedAt,
    })),
  };
}
