import request from 'supertest';
import { Express } from 'express';
import { prisma } from '../src/db/prisma';
import { hashPassword } from '../src/lib/password';
import { MemberRole } from '@prisma/client';

let counter = 0;
let defaultGroupId: string | null = null;

async function resolveDefaultGroupId(): Promise<string> {
  if (defaultGroupId) return defaultGroupId;
  const group = await prisma.group.upsert({
    where: { name: 'common' },
    update: {},
    create: { name: 'common', isDefault: true },
  });
  defaultGroupId = group.id;
  return group.id;
}

export async function createGroup(name: string) {
  return prisma.group.create({ data: { name } });
}

export async function createMember(role: MemberRole, namePrefix = 'Test', groupId?: string) {
  counter += 1;
  const email = `${namePrefix.toLowerCase()}${counter}.${Date.now()}@example.com`;
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);
  const member = await prisma.member.create({
    data: {
      name: `${namePrefix} ${counter}`,
      email,
      role,
      groupId: groupId ?? (await resolveDefaultGroupId()),
      passwordHash,
      mustChangePassword: false,
    },
  });
  return { member, email, password };
}

export async function loginAgent(app: Express, email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

interface RawBlock {
  id: string;
  blockType: string;
  name?: string | null;
  title?: string | null;
  body?: string | null;
}

// Adds one question to a survey's QUESTIONS block via the bulk draft-save
// endpoint (the only way to mutate blocks/questions now) — fetches the
// current tree, appends the question, and saves. Returns the save response.
export async function addSurveyQuestion(
  agent: Awaited<ReturnType<typeof loginAgent>>,
  surveyId: string,
  question: Record<string, unknown>,
) {
  const detail = await agent.get(`/api/surveys/${surveyId}`);
  const { title, description, isAnonymous, endDate, blocks } = detail.body.survey as {
    title: string;
    description?: string;
    isAnonymous: boolean;
    endDate?: string;
    blocks: RawBlock[];
  };
  const questionsBlock = blocks.find((b) => b.blockType === 'QUESTIONS')!;
  return agent.put(`/api/surveys/${surveyId}/draft`).send({
    title,
    description: description ?? undefined,
    isAnonymous,
    endDate: endDate ?? undefined,
    blocks: blocks.map((b) => ({
      id: b.id,
      blockType: b.blockType,
      name: b.name ?? undefined,
      title: b.title ?? undefined,
      body: b.body ?? undefined,
      questions: b.id === questionsBlock.id ? [question] : [],
    })),
  });
}

export async function cleanupDatabase() {
  await prisma.memberImportRowError.deleteMany();
  await prisma.memberImportBatch.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.anonymousAnswerOption.deleteMany();
  await prisma.anonymousAnswer.deleteMany();
  await prisma.surveyResponseAccess.deleteMany();
  await prisma.anonymousResponse.deleteMany();
  await prisma.attributedAnswerOption.deleteMany();
  await prisma.attributedAnswer.deleteMany();
  await prisma.attributedResponse.deleteMany();
  await prisma.surveyRecipient.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.oneOnOneAnswerOption.deleteMany();
  await prisma.oneOnOneAnswer.deleteMany();
  await prisma.oneOnOneRun.deleteMany();
  await prisma.oneOnOneRecipient.deleteMany();
  await prisma.oneOnOneQuestionOption.deleteMany();
  await prisma.oneOnOneQuestion.deleteMany();
  await prisma.oneOnOneBlock.deleteMany();
  await prisma.oneOnOneTemplate.deleteMany();
  await prisma.circleMember.deleteMany();
  await prisma.circle.deleteMany();
  await prisma.member.deleteMany();
  // Non-default groups are test fixtures — wipe them between tests. The
  // default "common" group is left in place since resolveDefaultGroupId()
  // caches its id for the lifetime of the test process.
  await prisma.group.deleteMany({ where: { isDefault: false } });
}
