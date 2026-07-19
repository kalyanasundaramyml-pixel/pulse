import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { createUser, loginAgent, cleanupDatabase } from './helpers';

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

  it('enforces one response per user, allows editing, and keeps anonymous results structurally unlinkable', async () => {
    const leader = await createUser('LEADER', 'Leader');
    const emp1 = await createUser('USER', 'Emp');
    const emp2 = await createUser('USER', 'Emp');
    const emp3 = await createUser('USER', 'Emp');

    const leaderAgent = await loginAgent(app, leader.email, leader.password);

    const createRes = await leaderAgent
      .post('/api/surveys')
      .send({ title: 'Team Pulse', isAnonymous: true });
    expect(createRes.status).toBe(201);
    const surveyId = createRes.body.survey.id;

    const questionRes = await leaderAgent.post(`/api/surveys/${surveyId}/questions`).send({
      questionType: 'RATING',
      prompt: 'How happy are you?',
      isRequired: true,
      ratingScaleMin: 1,
      ratingScaleMax: 5,
    });
    expect(questionRes.status).toBe(201);
    const questionId = questionRes.body.question.id;

    const recipientsRes = await leaderAgent
      .put(`/api/surveys/${surveyId}/recipients`)
      .send({ userIds: [emp1.user.id, emp2.user.id, emp3.user.id] });
    expect(recipientsRes.status).toBe(204);

    const publishRes = await leaderAgent.post(`/api/surveys/${surveyId}/publish`);
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

    // Editing in place must work and must not create a second row.
    const editRes = await emp1Agent
      .patch(`/api/surveys/${surveyId}/responses/me`)
      .send({ answers: [{ questionId, ratingValue: 5 }] });
    expect(editRes.status).toBe(200);

    const anonCountAfterEdit = await prisma.anonymousResponse.count({ where: { surveyId } });
    expect(anonCountAfterEdit).toBe(1);

    const accessRows = await prisma.surveyResponseAccess.findMany({ where: { surveyId } });
    expect(accessRows).toHaveLength(1);
    expect(accessRows[0].userId).toBe(emp1.user.id);

    // Below the withholding threshold (only 1 of 3 recipients responded).
    const dashboardBelowThreshold = await leaderAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashboardBelowThreshold.status).toBe(200);
    expect(dashboardBelowThreshold.body).not.toHaveProperty('respondents');
    expect(dashboardBelowThreshold.body.questions[0].summary.withheld).toBe(true);
    expect(dashboardBelowThreshold.body.questions[0].summary.responseCount).toBe(1);

    // Get to the threshold (3 responses).
    const emp2Agent = await loginAgent(app, emp2.email, emp2.password);
    const emp3Agent = await loginAgent(app, emp3.email, emp3.password);
    await emp2Agent.post(`/api/surveys/${surveyId}/responses`).send({ answers: [{ questionId, ratingValue: 3 }] });
    await emp3Agent.post(`/api/surveys/${surveyId}/responses`).send({ answers: [{ questionId, ratingValue: 5 }] });

    const dashboardAtThreshold = await leaderAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashboardAtThreshold.status).toBe(200);
    // Structural guarantee: no `respondents` field exists anywhere on an anonymous dashboard response,
    // even for an Admin/creator viewing it — not just hidden by a flag.
    expect(dashboardAtThreshold.body).not.toHaveProperty('respondents');
    expect(JSON.stringify(dashboardAtThreshold.body)).not.toContain(emp1.user.id);
    expect(JSON.stringify(dashboardAtThreshold.body)).not.toContain(emp1.email);
    expect(dashboardAtThreshold.body.questions[0].summary.withheld).toBe(false);
    expect(dashboardAtThreshold.body.questions[0].summary.average).toBeCloseTo((5 + 3 + 5) / 3);
    expect(dashboardAtThreshold.body.completion.respondedCount).toBe(3);
  });

  it('attributed surveys carry identity on the dashboard and still enforce one response per user', async () => {
    const leader = await createUser('LEADER', 'Leader');
    const emp1 = await createUser('USER', 'Emp');

    const leaderAgent = await loginAgent(app, leader.email, leader.password);
    const createRes = await leaderAgent.post('/api/surveys').send({ title: 'Named Feedback', isAnonymous: false });
    const surveyId = createRes.body.survey.id;

    const questionRes = await leaderAgent.post(`/api/surveys/${surveyId}/questions`).send({
      questionType: 'TEXT',
      prompt: 'Any comments?',
      isRequired: false,
    });
    const questionId = questionRes.body.question.id;

    await leaderAgent.put(`/api/surveys/${surveyId}/recipients`).send({ userIds: [emp1.user.id] });
    await leaderAgent.post(`/api/surveys/${surveyId}/publish`);

    const emp1Agent = await loginAgent(app, emp1.email, emp1.password);
    const submitRes = await emp1Agent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId, textValue: 'Great team!' }] });
    expect(submitRes.status).toBe(201);

    const dupRes = await emp1Agent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId, textValue: 'Second try' }] });
    expect(dupRes.status).toBe(409);

    const dashboard = await leaderAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.respondents).toHaveLength(1);
    expect(dashboard.body.respondents[0].userId).toBe(emp1.user.id);
    expect(dashboard.body.respondents[0].email).toBe(emp1.email);
  });
});
