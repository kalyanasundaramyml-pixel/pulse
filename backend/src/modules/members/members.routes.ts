import { Router } from 'express';
import multer from 'multer';
import * as controller from './members.controller';
import { listMembersQuerySchema, createMemberSchema, updateMemberSchema, directoryQuerySchema } from './members.schemas';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePasswordChanged } from '../../middleware/requirePasswordChanged';
import { requireRole } from '../../middleware/requireRole';
import { CSV_IMPORT_MAX_FILE_BYTES } from '../../config/constants';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: CSV_IMPORT_MAX_FILE_BYTES } });

export const membersRouter = Router();

membersRouter.use(requireAuth, requirePasswordChanged);

membersRouter.get('/admin/members', requireRole('ADMIN'), validate(listMembersQuerySchema, 'query'), controller.listMembers);
membersRouter.post('/admin/members', requireRole('ADMIN'), validate(createMemberSchema), controller.createMember);
membersRouter.patch('/admin/members/:id', requireRole('ADMIN'), validate(updateMemberSchema), controller.updateMember);
membersRouter.post('/admin/members/:id/reset-password', requireRole('ADMIN'), controller.resetPassword);
membersRouter.post('/admin/members/import', requireRole('ADMIN'), upload.single('file'), controller.importMembers);

membersRouter.get(
  '/members/directory',
  requireRole('CREATOR', 'ADMIN', 'AUDITOR'),
  validate(directoryQuerySchema, 'query'),
  controller.searchDirectory,
);
