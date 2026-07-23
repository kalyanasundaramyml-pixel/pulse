import { Router } from 'express';
import * as controller from './responses.controller';
import { submitResponseSchema } from './responses.schemas';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePasswordChanged } from '../../middleware/requirePasswordChanged';

export const responsesRouter = Router();

responsesRouter.use(requireAuth, requirePasswordChanged);

responsesRouter.get('/:id/take', controller.takeSurvey);
responsesRouter.post('/:id/responses', validate(submitResponseSchema), controller.submitResponse);
responsesRouter.get('/:id/responses/me', controller.getMyResponse);
