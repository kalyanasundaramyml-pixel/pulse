import { Router } from 'express';
import multer from 'multer';
import * as controller from './users.controller';
import { listUsersQuerySchema, createUserSchema, updateUserSchema, directoryQuerySchema } from './users.schemas';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePasswordChanged } from '../../middleware/requirePasswordChanged';
import { requireRole } from '../../middleware/requireRole';
import { CSV_IMPORT_MAX_FILE_BYTES } from '../../config/constants';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: CSV_IMPORT_MAX_FILE_BYTES } });

export const usersRouter = Router();

usersRouter.use(requireAuth, requirePasswordChanged);

usersRouter.get('/admin/users', requireRole('ADMIN'), validate(listUsersQuerySchema, 'query'), controller.listUsers);
usersRouter.post('/admin/users', requireRole('ADMIN'), validate(createUserSchema), controller.createUser);
usersRouter.patch('/admin/users/:id', requireRole('ADMIN'), validate(updateUserSchema), controller.updateUser);
usersRouter.post('/admin/users/:id/reset-password', requireRole('ADMIN'), controller.resetPassword);
usersRouter.post('/admin/users/import', requireRole('ADMIN'), upload.single('file'), controller.importUsers);

usersRouter.get(
  '/users/directory',
  requireRole('CREATOR', 'ADMIN'),
  validate(directoryQuerySchema, 'query'),
  controller.searchDirectory,
);
