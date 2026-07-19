import request from 'supertest';
import { Express } from 'express';
import { prisma } from '../src/db/prisma';
import { hashPassword } from '../src/lib/password';
import { UserRole } from '@prisma/client';

let counter = 0;

export async function createUser(role: UserRole, namePrefix = 'Test') {
  counter += 1;
  const email = `${namePrefix.toLowerCase()}${counter}.${Date.now()}@example.com`;
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name: `${namePrefix} ${counter}`, email, role, passwordHash, mustChangePassword: false },
  });
  return { user, email, password };
}

export async function loginAgent(app: Express, email: string, password: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

export async function cleanupDatabase() {
  await prisma.userImportRowError.deleteMany();
  await prisma.userImportBatch.deleteMany();
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
  await prisma.user.deleteMany();
}
