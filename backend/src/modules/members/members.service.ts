import { Prisma, MemberRole } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { hashPassword, generateTempPassword } from '../../lib/password';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { recordAuditLog } from '../../lib/auditLog';

const memberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  group: { select: { id: true, name: true } },
} satisfies Prisma.MemberSelect;

export async function getDefaultGroupId(): Promise<string> {
  const group = await prisma.group.findFirst({ where: { isDefault: true } });
  if (!group) {
    throw new NotFoundError('No default group configured');
  }
  return group.id;
}

export async function listMembers(opts: { search?: string; role?: MemberRole; groupId?: string; page: number; pageSize: number }) {
  const where: Prisma.MemberWhereInput = {
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.groupId ? { groupId: opts.groupId } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: 'insensitive' } },
            { email: { contains: opts.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, members] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      select: memberSelect,
    }),
  ]);
  return { total, page: opts.page, pageSize: opts.pageSize, members };
}

export async function createMember(input: { name: string; email: string; role: MemberRole; groupId?: string }) {
  const email = input.email.toLowerCase();
  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('EMAIL_TAKEN', 'A member with this email already exists');
  }
  const groupId = input.groupId ?? (await getDefaultGroupId());
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const member = await prisma.member.create({
    data: { name: input.name, email, role: input.role, groupId, passwordHash, mustChangePassword: true },
    select: memberSelect,
  });
  return { member, tempPassword };
}

export async function updateMember(
  memberId: string,
  input: { role?: MemberRole; groupId?: string; isActive?: boolean },
  actorId: string,
) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new NotFoundError('Member not found');
  }
  const updated = await prisma.member.update({ where: { id: memberId }, data: input, select: memberSelect });
  if (input.role && input.role !== member.role) {
    await recordAuditLog({
      actorId,
      action: 'MEMBER_ROLE_CHANGED',
      targetType: 'Member',
      targetId: memberId,
      metadata: { from: member.role, to: input.role },
    });
  }
  if (input.groupId && input.groupId !== member.groupId) {
    await recordAuditLog({
      actorId,
      action: 'MEMBER_GROUP_CHANGED',
      targetType: 'Member',
      targetId: memberId,
      metadata: { from: member.groupId, to: input.groupId },
    });
  }
  if (input.isActive !== undefined && input.isActive !== member.isActive) {
    await recordAuditLog({
      actorId,
      action: input.isActive ? 'MEMBER_ACTIVATED' : 'MEMBER_DEACTIVATED',
      targetType: 'Member',
      targetId: memberId,
    });
  }
  return updated;
}

export async function resetPassword(memberId: string, actorId: string) {
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member) {
    throw new NotFoundError('Member not found');
  }
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await prisma.member.update({ where: { id: memberId }, data: { passwordHash, mustChangePassword: true } });
  await recordAuditLog({ actorId, action: 'MEMBER_PASSWORD_RESET', targetType: 'Member', targetId: memberId });
  return { tempPassword };
}

export async function searchDirectory(opts: { search?: string; page: number; pageSize: number }) {
  const where: Prisma.MemberWhereInput = {
    isActive: true,
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: 'insensitive' } },
            { email: { contains: opts.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, members] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      select: { id: true, name: true, email: true },
    }),
  ]);
  return { total, page: opts.page, pageSize: opts.pageSize, members };
}

export function assertValidRole(role: string): asserts role is MemberRole {
  if (!['ADMIN', 'CREATOR', 'AUDITOR', 'MEMBER'].includes(role)) {
    throw new ValidationError(`Invalid role: ${role}`);
  }
}
