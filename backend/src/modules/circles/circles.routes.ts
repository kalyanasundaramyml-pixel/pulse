import { Router } from 'express';
import * as controller from './circles.controller';
import { createCircleSchema, updateCircleSchema } from './circles.schemas';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePasswordChanged } from '../../middleware/requirePasswordChanged';
import { requireRole } from '../../middleware/requireRole';

export const circlesRouter = Router();

circlesRouter.use(requireAuth, requirePasswordChanged, requireRole('CREATOR', 'AUDITOR', 'ADMIN'));

circlesRouter.get('/', controller.listCircles);
circlesRouter.post('/', validate(createCircleSchema), controller.createCircle);
circlesRouter.get('/:id', controller.getCircle);
circlesRouter.patch('/:id', validate(updateCircleSchema), controller.updateCircle);
circlesRouter.delete('/:id', controller.deleteCircle);
