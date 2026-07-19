import { Router } from 'express';
import * as controller from './oneOnOnes.controller';
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesQuerySchema,
  createQuestionSchema,
  updateQuestionSchema,
  reorderQuestionsSchema,
  setRecipientsSchema,
  addRecipientsSchema,
  startRunSchema,
  submitRunSchema,
} from './oneOnOnes.schemas';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePasswordChanged } from '../../middleware/requirePasswordChanged';
import { requireRole } from '../../middleware/requireRole';

export const oneOnOnesRouter = Router();

oneOnOnesRouter.use(requireAuth, requirePasswordChanged);

// Recipient-side: taking a run. Registered first since these have a fixed
// "runs" prefix distinct from the /:id template routes below.
oneOnOnesRouter.get('/runs/mine', controller.getMyRuns);
oneOnOnesRouter.get('/runs/:runId/take', controller.getTakeRun);
oneOnOnesRouter.post('/runs/:runId/responses', validate(submitRunSchema), controller.submitRun);

// Templates (Leader/Admin)
oneOnOnesRouter.post('/', requireRole('LEADER', 'ADMIN'), validate(createTemplateSchema), controller.createTemplate);
oneOnOnesRouter.get('/', requireRole('LEADER', 'ADMIN'), validate(listTemplatesQuerySchema, 'query'), controller.listTemplates);
oneOnOnesRouter.get('/:id', requireRole('LEADER', 'ADMIN'), controller.getTemplate);
oneOnOnesRouter.patch('/:id', requireRole('LEADER', 'ADMIN'), validate(updateTemplateSchema), controller.updateTemplate);
oneOnOnesRouter.delete('/:id', requireRole('LEADER', 'ADMIN'), controller.deleteTemplate);
oneOnOnesRouter.post('/:id/duplicate', requireRole('LEADER', 'ADMIN'), controller.duplicateTemplate);

oneOnOnesRouter.post('/:id/questions', requireRole('LEADER', 'ADMIN'), validate(createQuestionSchema), controller.addQuestion);
oneOnOnesRouter.patch('/:id/questions/:qid', requireRole('LEADER', 'ADMIN'), validate(updateQuestionSchema), controller.updateQuestion);
oneOnOnesRouter.delete('/:id/questions/:qid', requireRole('LEADER', 'ADMIN'), controller.deleteQuestion);
oneOnOnesRouter.put('/:id/questions/reorder', requireRole('LEADER', 'ADMIN'), validate(reorderQuestionsSchema), controller.reorderQuestions);

oneOnOnesRouter.put('/:id/recipients', requireRole('LEADER', 'ADMIN'), validate(setRecipientsSchema), controller.setRecipients);
oneOnOnesRouter.post('/:id/recipients', requireRole('LEADER', 'ADMIN'), validate(addRecipientsSchema), controller.addRecipients);
oneOnOnesRouter.delete('/:id/recipients/:userId', requireRole('LEADER', 'ADMIN'), controller.removeRecipient);

oneOnOnesRouter.post('/:id/runs', requireRole('LEADER', 'ADMIN'), validate(startRunSchema), controller.startRun);
oneOnOnesRouter.get('/:id/runs', requireRole('LEADER', 'ADMIN'), controller.listRuns);
oneOnOnesRouter.get('/:id/trend/:userId', requireRole('LEADER', 'ADMIN'), controller.getTrend);
