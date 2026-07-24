import { prisma } from '../../db/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { UnauthorizedError, ValidationError } from '../../lib/errors';
import { Member } from '@prisma/client';

export async function authenticate(email: string, password: string): Promise<Member> {
  const member = await prisma.member.findUnique({ where: { email: email.toLowerCase() } });
  if (!member || !member.isActive) {
    throw new UnauthorizedError('Invalid email or password');
  }
  const ok = await verifyPassword(password, member.passwordHash);
  if (!ok) {
    throw new UnauthorizedError('Invalid email or password');
  }
  await prisma.member.update({ where: { id: member.id }, data: { lastLoginAt: new Date() } });
  return member;
}

export async function changePassword(memberId: string, currentPassword: string, newPassword: string): Promise<void> {
  const member = await prisma.member.findUniqueOrThrow({ where: { id: memberId } });
  const ok = await verifyPassword(currentPassword, member.passwordHash);
  if (!ok) {
    throw new ValidationError('Current password is incorrect');
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.member.update({
    where: { id: memberId },
    data: { passwordHash, mustChangePassword: false },
  });
}

export function toPublicMember(member: Member) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    mustChangePassword: member.mustChangePassword,
  };
}
