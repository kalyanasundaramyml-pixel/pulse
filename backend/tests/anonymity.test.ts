import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { createMember, loginAgent, cleanupDatabase } from './helpers';

const app = createApp();

describe('anonymous survey response lifecycle', () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('enforces one response per member, locks it after submit, and keeps anonymous results structurally unlinkable', async () => {
    const creator = await createMember('CREATOR', 'Creator');
    const emp1 = await createMember('MEMBER', 'Emp');
    const emp2 = await createMember('MEMBER', 'Emp');
    const emp3 = await createMember('MEMBER', 'Emp');

    const creatorAgent = await loginAgent(app, creator.email, creator.password);

    const createRes = await creatorAgent
      .post('/api/surveys')
      .send({ title: 'Team Pulse', isAnonymous: true });
    expect(createRes.status).toBe(201);
    const surveyId = createRes.body.survey.id;

    const surveyDetail = await creatorAgent.get(`/api/surveys/${surveyId}`);
    const questionsBlockId = surveyDetail.body.survey.blocks.find((b: { blockType: string }) => b.blockType === 'QUESTIONS').id;

    const questionRes = await creatorAgent.post(`/api/surveys/${surveyId}/blocks/${questionsBlockId}/questions`).send({
      questionType: 'RATING',
      prompt: 'How happy are you?',
      isRequired: true,
      ratingScaleMin: 1,
      ratingScaleMax: 5,
    });
    expect(questionRes.status).toBe(201);
    const questionId = questionRes.body.question.id;

    const recipientsRes = await creatorAgent
      .put(`/api/surveys/${surveyId}/recipients`)
      .send({ memberIds: [emp1.member.id, emp2.member.id, emp3.member.id] });
    expect(recipientsRes.status).toBe(204);

    const publishRes = await creatorAgent.post(`/api/surveys/${surveyId}/publish`);
    expect(publishRes.status).toBe(200);

    const emp1Agent = await loginAgent(app, emp1.email, emp1.password);

    const takeRes = await emp1Agent.get(`/api/surveys/${surveyId}/take`);
    expect(takeRes.status).toBe(200);
    expect(takeRes.body.survey.isAnonymous).toBe(true);
    expect(takeRes.body.alreadyResponded).toBe(false);

    const submitRes = await emp1Agent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId, ratingValue: 4 }] });
    expect(submitRes.status).toBe(201);

    // Duplicate submission must be rejected, not silently create a second instance.
    const dupRes = await emp1Agent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId, ratingValue: 2 }] });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.code).toBe('ALREADY_RESPONDED');

    const anonCountAfterDup = await prisma.anonymousResponse.count({ where: { surveyId } });
    expect(anonCountAfterDup).toBe(1);

    const accessRows = await prisma.surveyResponseAccess.findMany({ where: { surveyId } });
    expect(accessRows).toHaveLength(1);
    expect(accessRows[0].memberId).toBe(emp1.member.id);

    // Below the withholding threshold (only 1 of 3 recipients responded).
    const dashboardBelowThreshold = await creatorAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashboardBelowThreshold.status).toBe(200);
    expect(dashboardBelowThreshold.body).not.toHaveProperty('respondents');
    expect(dashboardBelowThreshold.body.questions[0].summary.withheld).toBe(true);
    expect(dashboardBelowThreshold.body.questions[0].summary.responseCount).toBe(1);

    // Get to the threshold (3 responses).
    const emp2Agent = await loginAgent(app, emp2.email, emp2.password);
    const emp3Agent = await loginAgent(app, emp3.email, emp3.password);
    await emp2Agent.post(`/api/surveys/${surveyId}/responses`).send({ answers: [{ questionId, ratingValue: 3 }] });
    await emp3Agent.post(`/api/surveys/${surveyId}/responses`).send({ answers: [{ questionId, ratingValue: 5 }] });

    const dashboardAtThreshold = await creatorAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashboardAtThreshold.status).toBe(200);
    // Structural guarantee: no `respondents` field exists anywhere on an anonymous dashboard response,
    // even for an Admin/creator viewing it — not just hidden by a flag.
    expect(dashboardAtThreshold.body).not.toHaveProperty('respondents');
    expect(JSON.stringify(dashboardAtThreshold.body)).not.toContain(emp1.member.id);
    expect(JSON.stringify(dashboardAtThreshold.body)).not.toContain(emp1.email);
    expect(dashboardAtThreshold.body.questions[0].summary.withheld).toBe(false);
    expect(dashboardAtThreshold.body.questions[0].summary.average).toBeCloseTo((4 + 3 + 5) / 3);
    expect(dashboardAtThreshold.body.completion.respondedCount).toBe(3);
  });

  it('attributed surveys carry identity on the dashboard, enforce one response per member, and lock the response until reopened', async () => {
    const creator = await createMember('CREATOR', 'Creator');
    const emp1 = await createMember('MEMBER', 'Emp');

    const creatorAgent = await loginAgent(app, creator.email, creator.password);
    const createRes = await creatorAgent.post('/api/surveys').send({ title: 'Named Feedback', isAnonymous: false });
    const surveyId = createRes.body.survey.id;

    const surveyDetail = await creatorAgent.get(`/api/surveys/${surveyId}`);
    const questionsBlockId = surveyDetail.body.survey.blocks.find((b: { blockType: string }) => b.blockType === 'QUESTIONS').id;

    const questionRes = await creatorAgent.post(`/api/surveys/${surveyId}/blocks/${questionsBlockId}/questions`).send({
      questionType: 'TEXT',
      prompt: 'Any comments?',
      isRequired: false,
    });
    const questionId = questionRes.body.question.id;

    await creatorAgent.put(`/api/surveys/${surveyId}/recipients`).send({ memberIds: [emp1.member.id] });
    await creatorAgent.post(`/api/surveys/${surveyId}/publish`);

    const emp1Agent = await loginAgent(app, emp1.email, emp1.password);
    const submitRes = await emp1Agent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId, textValue: 'Great team!' }] });
    expect(submitRes.status).toBe(201);

    const dupRes = await emp1Agent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId, textValue: 'Second try' }] });
    expect(dupRes.status).toBe(409);

    const dashboard = await creatorAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.respondents).toHaveLength(1);
    expect(dashboard.body.respondents[0].memberId).toBe(emp1.member.id);
    expect(dashboard.body.respondents[0].email).toBe(emp1.email);

    // The creator can reopen this one recipient for exactly one more submission.
    const reopenRes = await creatorAgent.post(`/api/surveys/${surveyId}/recipients/${emp1.member.id}/reopen`);
    expect(reopenRes.status).toBe(204);

    const resubmitRes = await emp1Agent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId, textValue: 'Updated after reopen' }] });
    expect(resubmitRes.status).toBe(201);

    // The grant is consumed — a further attempt is rejected again.
    const thirdRes = await emp1Agent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId, textValue: 'Should fail' }] });
    expect(thirdRes.status).toBe(409);
  });
});
