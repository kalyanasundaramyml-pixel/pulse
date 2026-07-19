import { Router } from 'express';
import * as controller from './groups.controller';
import { createGroupSchema, updateGroupSchema } from './groups.schemas';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePasswordChanged } from '../../middleware/requirePasswordChanged';
import { requireRole } from '../../middleware/requireRole';

export const groupsRouter = Router();

groupsRouter.use(requireAuth, requirePasswordChanged, requireRole('LEADER', 'ADMIN'));

groupsRouter.get('/', controller.listGroups);
groupsRouter.post('/', validate(createGroupSchema), controller.createGroup);
groupsRouter.get('/:id', controller.getGroup);
groupsRouter.patch('/:id', validate(updateGroupSchema), controller.updateGroup);
groupsRouter.delete('/:id', controller.deleteGroup);
