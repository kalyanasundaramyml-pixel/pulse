import { Member } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../lib/errors';

// Circles are a shared, org-wide resource: any Creator/Admin can create, view,
// edit, or delete any circle — there is no per-circle ownership lock beyond
// recording createdById for audit purposes.

export async function listCircles() {
  const circles = await prisma.circle.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { members: true } } },
  });
  return circles.map((c) => ({ id: c.id, name: c.name, memberCount: c._count.members, createdAt: c.createdAt }));
}

export async function getCircle(circleId: string) {
  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    include: { members: { include: { member: { select: { id: true, name: true, email: true } } } } },
  });
  if (!circle) {
    throw new NotFoundError('Circle not found');
  }
  return {
    id: circle.id,
    name: circle.name,
    members: circle.members.map((m) => m.member),
  };
}

export async function createCircle(actor: Member, input: { name: string; memberIds: string[] }) {
  const circle = await prisma.circle.create({
    data: {
      name: input.name,
      createdById: actor.id,
      members: { create: input.memberIds.map((memberId) => ({ memberId })) },
    },
  });
  return getCircle(circle.id);
}

export async function updateCircle(circleId: string, input: { name?: string; memberIds?: string[] }) {
  const existing = await prisma.circle.findUnique({ where: { id: circleId } });
  if (!existing) {
    throw new NotFoundError('Circle not found');
  }

  await prisma.$transaction(async (tx) => {
    if (input.name !== undefined) {
      await tx.circle.update({ where: { id: circleId }, data: { name: input.name } });
    }
    if (input.memberIds !== undefined) {
      await tx.circleMember.deleteMany({ where: { circleId, memberId: { notIn: input.memberIds } } });
      for (const memberId of input.memberIds) {
        await tx.circleMember.upsert({
          where: { circleId_memberId: { circleId, memberId } },
          create: { circleId, memberId },
          update: {},
        });
      }
    }
  });

  return getCircle(circleId);
}

export async function deleteCircle(circleId: string) {
  const existing = await prisma.circle.findUnique({ where: { id: circleId } });
  if (!existing) {
    throw new NotFoundError('Circle not found');
  }
  await prisma.circle.delete({ where: { id: circleId } });
}
