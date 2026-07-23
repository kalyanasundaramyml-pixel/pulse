import { OneOnOneTemplate, User } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { ForbiddenError, NotFoundError } from '../../lib/errors';

export async function getTemplateOr404(templateId: string): Promise<OneOnOneTemplate> {
  const template = await prisma.oneOnOneTemplate.findUnique({ where: { id: templateId } });
  if (!template) {
    throw new NotFoundError('One-on-one template not found');
  }
  return template;
}

export async function assertTemplateOwnerOrAdmin(templateId: string, user: User): Promise<OneOnOneTemplate> {
  const template = await getTemplateOr404(templateId);
  if (user.role !== 'ADMIN' && template.createdById !== user.id) {
    throw new ForbiddenError('Only the template creator or an Admin may perform this action');
  }
  return template;
}

// Read-and-use rule for templates: owner/Admin, OR any Creator/Admin when the
// template is public. Only ever used for viewing a template and duplicating
// it — never for editing it, adding recipients, or starting a run on it.
export async function assertCanViewOrUseTemplate(templateId: string, user: User): Promise<OneOnOneTemplate> {
  const template = await getTemplateOr404(templateId);
  const isOwnerOrAdmin = user.role === 'ADMIN' || template.createdById === user.id;
  const isPublicForCreator = template.isPublic && (user.role === 'CREATOR' || user.role === 'ADMIN');
  if (!isOwnerOrAdmin && !isPublicForCreator) {
    throw new ForbiddenError('Only the template creator, an Admin, or (for a public template) another Creator may view this');
  }
  return template;
}

export async function assertIsRecipient(templateId: string, user: User): Promise<OneOnOneTemplate> {
  const template = await getTemplateOr404(templateId);
  const recipient = await prisma.oneOnOneRecipient.findUnique({
    where: { templateId_userId: { templateId, userId: user.id } },
  });
  if (!recipient) {
    throw new ForbiddenError('You are not a recipient of this one-on-one template');
  }
  return template;
}
