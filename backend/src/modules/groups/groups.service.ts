import { prisma } from '../../db/prisma';
import { ConflictError, NotFoundError } from '../../lib/errors';
import { recordAuditLog } from '../../lib/auditLog';

// Groups are org teams: every member belongs to exactly one. Admin-only
// end to end — unlike Circles, there's no reason for a Creator to see or
// manage these directly.

export async function listGroups() {
  const groups = await prisma.group.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { members: true } } },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    isDefault: g.isDefault,
    memberCount: g._count.members,
    createdAt: g.createdAt,
  }));
}

export async function createGroup(name: string, actorId: string) {
  const existing = await prisma.group.findUnique({ where: { name } });
  if (existing) {
    throw new ConflictError('DUPLICATE_NAME', `A group named "${name}" already exists.`);
  }
  const group = await prisma.group.create({ data: { name } });
  await recordAuditLog({ actorId, action: 'GROUP_CREATED', targetType: 'Group', targetId: group.id, metadata: { name } });
  return group;
}

export async function renameGroup(groupId: string, name: string, actorId: string) {
  const existing = await prisma.group.findUnique({ where: { id: groupId } });
  if (!existing) {
    throw new NotFoundError('Group not found');
  }
  const nameTaken = await prisma.group.findFirst({ where: { name, id: { not: groupId } } });
  if (nameTaken) {
    throw new ConflictError('DUPLICATE_NAME', `A group named "${name}" already exists.`);
  }
  const updated = await prisma.group.update({ where: { id: groupId }, data: { name } });
  await recordAuditLog({
    actorId,
    action: 'GROUP_RENAMED',
    targetType: 'Group',
    targetId: groupId,
    metadata: { from: existing.name, to: name },
  });
  return updated;
}

export async function deleteGroup(groupId: string, actorId: string) {
  const existing = await prisma.group.findUnique({ where: { id: groupId }, include: { _count: { select: { members: true } } } });
  if (!existing) {
    throw new NotFoundError('Group not found');
  }
  if (existing.isDefault) {
    throw new ConflictError('DEFAULT_GROUP', 'The default group cannot be deleted');
  }
  if (existing._count.members > 0) {
    throw new ConflictError('GROUP_HAS_MEMBERS', 'Reassign every member out of this group before deleting it');
  }
  await prisma.group.delete({ where: { id: groupId } });
  await recordAuditLog({ actorId, action: 'GROUP_DELETED', targetType: 'Group', targetId: groupId, metadata: { name: existing.name } });
}
