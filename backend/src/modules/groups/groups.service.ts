import { User } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../lib/errors';

// Groups are a shared, org-wide resource: any Leader/Admin can create, view,
// edit, or delete any group — there is no per-group ownership lock beyond
// recording createdById for audit purposes.

export async function listGroups() {
  const groups = await prisma.group.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { members: true } } },
  });
  return groups.map((g) => ({ id: g.id, name: g.name, memberCount: g._count.members, createdAt: g.createdAt }));
}

export async function getGroup(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  if (!group) {
    throw new NotFoundError('Group not found');
  }
  return {
    id: group.id,
    name: group.name,
    members: group.members.map((m) => m.user),
  };
}

export async function createGroup(user: User, input: { name: string; userIds: string[] }) {
  const group = await prisma.group.create({
    data: {
      name: input.name,
      createdById: user.id,
      members: { create: input.userIds.map((userId) => ({ userId })) },
    },
  });
  return getGroup(group.id);
}

export async function updateGroup(groupId: string, input: { name?: string; userIds?: string[] }) {
  const existing = await prisma.group.findUnique({ where: { id: groupId } });
  if (!existing) {
    throw new NotFoundError('Group not found');
  }

  await prisma.$transaction(async (tx) => {
    if (input.name !== undefined) {
      await tx.group.update({ where: { id: groupId }, data: { name: input.name } });
    }
    if (input.userIds !== undefined) {
      await tx.groupMember.deleteMany({ where: { groupId, userId: { notIn: input.userIds } } });
      for (const userId of input.userIds) {
        await tx.groupMember.upsert({
          where: { groupId_userId: { groupId, userId } },
          create: { groupId, userId },
          update: {},
        });
      }
    }
  });

  return getGroup(groupId);
}

export async function deleteGroup(groupId: string) {
  const existing = await prisma.group.findUnique({ where: { id: groupId } });
  if (!existing) {
    throw new NotFoundError('Group not found');
  }
  await prisma.group.delete({ where: { id: groupId } });
}
