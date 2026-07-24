import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { createMember, createGroup, loginAgent, cleanupDatabase } from './helpers';

const app = createApp();

describe('Group-scoped Auditor oversight and Viewer grants', () => {
  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('scopes Auditor dashboard access to the survey creator\'s own group, with Viewer as the only cross-group exception', async () => {
    const groupA = await createGroup('Group A');
    const groupB = await createGroup('Group B');

    const creator = await createMember('CREATOR', 'Creator', groupA.id);
    const auditorA = await createMember('AUDITOR', 'AuditorA', groupA.id);
    const auditorB = await createMember('AUDITOR', 'AuditorB', groupB.id);
    // A recipient from group B, on a survey created in group A — mirrors a
    // Circle whose members span both groups.
    const recipientB = await createMember('MEMBER', 'RecipientB', groupB.id);
    const recipientA = await createMember('MEMBER', 'RecipientA', groupA.id);

    const creatorAgent = await loginAgent(app, creator.email, creator.password);
    const createRes = await creatorAgent.post('/api/surveys').send({ title: 'Cross-group survey', isAnonymous: false });
    expect(createRes.status).toBe(201);
    const surveyId = createRes.body.survey.id;

    const surveyDetail = await creatorAgent.get(`/api/surveys/${surveyId}`);
    const questionsBlockId = surveyDetail.body.survey.blocks.find(
      (b: { blockType: string }) => b.blockType === 'QUESTIONS',
    ).id;
    // At least one question is required to publish — its content isn't
    // exercised by this test (no responses are submitted).
    await creatorAgent.post(`/api/surveys/${surveyId}/blocks/${questionsBlockId}/questions`).send({
      questionType: 'TEXT',
      prompt: 'Anything to flag?',
      isRequired: false,
    });

    await creatorAgent
      .put(`/api/surveys/${surveyId}/recipients`)
      .send({ memberIds: [recipientA.member.id, recipientB.member.id] });
    await creatorAgent.post(`/api/surveys/${surveyId}/publish`);

    const auditorAAgent = await loginAgent(app, auditorA.email, auditorA.password);
    const auditorBAgent = await loginAgent(app, auditorB.email, auditorB.password);

    // Group A's Auditor (matching the creator's own group) can see the dashboard.
    const dashAsAuditorA = await auditorAAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashAsAuditorA.status).toBe(200);

    // Group B's Auditor cannot, even though a group-B member is a recipient.
    const dashAsAuditorB = await auditorBAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashAsAuditorB.status).toBe(403);

    // An Auditor still cannot perform Creator/Admin-only mutations.
    const closeAsAuditorA = await auditorAAgent.post(`/api/surveys/${surveyId}/close`);
    expect(closeAsAuditorA.status).toBe(403);

    // Group A's Auditor grants Viewer to the group-B recipient.
    const grantRes = await auditorAAgent.post(`/api/surveys/${surveyId}/viewers`).send({ memberId: recipientB.member.id });
    expect(grantRes.status).toBe(204);

    const recipientBAgent = await loginAgent(app, recipientB.email, recipientB.password);
    const dashAsViewer = await recipientBAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashAsViewer.status).toBe(200);

    // Group B's Auditor still has no access — Viewer is per-member, not per-group.
    const dashAsAuditorBAfterGrant = await auditorBAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashAsAuditorBAfterGrant.status).toBe(403);

    // Group A's Auditor revokes the grant; access is removed again.
    const revokeRes = await auditorAAgent.delete(`/api/surveys/${surveyId}/viewers/${recipientB.member.id}`);
    expect(revokeRes.status).toBe(204);

    const dashAfterRevoke = await recipientBAgent.get(`/api/surveys/${surveyId}/dashboard`);
    expect(dashAfterRevoke.status).toBe(403);
  });
});
