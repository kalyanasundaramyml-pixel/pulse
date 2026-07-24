import { OneOnOneTemplate, Member } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ForbiddenError, NotFoundError } from '../../lib/errors';

export async function getTemplateOr404(templateId: string): Promise<OneOnOneTemplate> {
  const template = await prisma.oneOnOneTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    throw new NotFoundError('One-on-one template not found');
  }
  return template;
}

export async function assertTemplateOwnerOrAdmin(templateId: string, member: Member): Promise<OneOnOneTemplate> {
  const template = await getTemplateOr404(templateId);
  if (member.role !== 'ADMIN' && template.createdById !== member.id) {
    throw new ForbiddenError('Only the template creator or an Admin may perform this action');
  }
  return template;
}

// Read-and-use rule for templates: owner/Admin, OR any Creator/Admin when the
// template is public. Only ever used for viewing a template and duplicating
// it — never for editing it, adding recipients, or starting a run on it.
export async function assertCanViewOrUseTemplate(templateId: string, member: Member): Promise<OneOnOneTemplate> {
  const template = await getTemplateOr404(templateId);
  const isOwnerOrAdmin = member.role === 'ADMIN' || template.createdById === member.id;
  const isPublicForCreator = template.isPublic && (member.role === 'CREATOR' || member.role === 'ADMIN');
  if (!isOwnerOrAdmin && !isPublicForCreator) {
    throw new ForbiddenError('Only the template creator, an Admin, or (for a public template) another Creator may view this');
  }
  return template;
}

export async function assertIsRecipient(templateId: string, member: Member): Promise<OneOnOneTemplate> {
  const template = await getTemplateOr404(templateId);
  const recipient = await prisma.oneOnOneRecipient.findUnique({
    where: { templateId_memberId: { templateId, memberId: member.id } },
  });
  if (!recipient) {
    throw new ForbiddenError('You are not a recipient of this one-on-one template');
  }
  return template;
}

async function isAuditorOfCreatorGroup(template: OneOnOneTemplate, member: Member): Promise<boolean> {
  if (member.role !== 'AUDITOR') {
    return false;
  }
  const creator = await prisma.member.findUnique({ where: { id: template.createdById }, select: { groupId: true } });
  return creator?.groupId === member.groupId;
}

// Read-only oversight rule for the template detail view: same as
// assertCanViewOrUseTemplate (owner/Admin, or any Creator/Admin for a public
// template) PLUS an Auditor whose own group matches the creator's group.
// Never used for editing or duplicating — those stay on the stricter
// functions above.
export async function assertCanViewTemplateDetail(templateId: string, member: Member): Promise<OneOnOneTemplate> {
  const template = await getTemplateOr404(templateId);
  const isOwnerOrAdmin = member.role === 'ADMIN' || template.createdById === member.id;
  const isPublicForCreator = template.isPublic && (member.role === 'CREATOR' || member.role === 'ADMIN');
  if (isOwnerOrAdmin || isPublicForCreator) {
    return template;
  }
  if (await isAuditorOfCreatorGroup(template, member)) {
    return template;
  }
  throw new ForbiddenError('Only the template creator, an Admin, or the Auditor of the creator\'s group may view this');
}

// Narrower read-only rule for runs/trend: owner/Admin, or an Auditor of the
// creator's group — no public-template branch (results aren't part of what
// "public" exposes).
export async function assertCanAuditTemplate(templateId: string, member: Member): Promise<OneOnOneTemplate> {
  const template = await getTemplateOr404(templateId);
  if (member.role === 'ADMIN' || template.createdById === member.id) {
    return template;
  }
  if (await isAuditorOfCreatorGroup(template, member)) {
    return template;
  }
  throw new ForbiddenError('Only the template creator, an Admin, or the Auditor of the creator\'s group may view this');
}
