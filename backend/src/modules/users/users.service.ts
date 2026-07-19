import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { hashPassword, generateTempPassword } from '../../lib/password';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import { recordAuditLog } from '../../lib/auditLog';

export async function listUsers(opts: { search?: string; role?: UserRole; page: number; pageSize: number }) {
  const where: Prisma.UserWhereInput = {
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: 'insensitive' } },
            { email: { contains: opts.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      select: { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, lastLoginAt: true, createdAt: true },
    }),
  ]);
  return { total, page: opts.page, pageSize: opts.pageSize, users };
}

export async function createUser(input: { name: string; email: string; role: UserRole }) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('EMAIL_TAKEN', 'A user with this email already exists');
  }
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const user = await prisma.user.create({
    data: { name: input.name, email, role: input.role, passwordHash, mustChangePassword: true },
  });
  return { user, tempPassword };
}

export async function updateUser(userId: string, input: { role?: UserRole; isActive?: boolean }, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  const updated = await prisma.user.update({ where: { id: userId }, data: input });
  if (input.role && input.role !== user.role) {
    await recordAuditLog({
      actorId,
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: userId,
      metadata: { from: user.role, to: input.role },
    });
  }
  if (input.isActive !== undefined && input.isActive !== user.isActive) {
    await recordAuditLog({
      actorId,
      action: input.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      targetType: 'User',
      targetId: userId,
    });
  }
  return updated;
}

export async function resetPassword(userId: string, actorId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } });
  await recordAuditLog({ actorId, action: 'USER_PASSWORD_RESET', targetType: 'User', targetId: userId });
  return { tempPassword };
}

export async function searchDirectory(opts: { search?: string; page: number; pageSize: number }) {
  const where: Prisma.UserWhereInput = {
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
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      select: { id: true, name: true, email: true },
    }),
  ]);
  return { total, page: opts.page, pageSize: opts.pageSize, users };
}

export function assertValidRole(role: string): asserts role is UserRole {
  if (!['ADMIN', 'LEADER', 'USER'].includes(role)) {
    throw new ValidationError(`Invalid role: ${role}`);
  }
}
