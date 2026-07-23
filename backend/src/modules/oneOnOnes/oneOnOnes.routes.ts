import { Router } from 'express';
import * as controller from './oneOnOnes.controller';
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesQuerySchema,
  createBlockSchema,
  updateBlockSchema,
  reorderBlocksSchema,
  createQuestionSchema,
  updateQuestionSchema,
  reorderQuestionsSchema,
  setRecipientsSchema,
  addRecipientsSchema,
  startRunSchema,
  submitRunSchema,
  duplicateTemplateSchema,
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

// Templates (Creator/Admin)
oneOnOnesRouter.post('/', requireRole('CREATOR', 'ADMIN'), validate(createTemplateSchema), controller.createTemplate);
oneOnOnesRouter.get('/', requireRole('CREATOR', 'ADMIN'), validate(listTemplatesQuerySchema, 'query'), controller.listTemplates);
oneOnOnesRouter.get('/:id', requireRole('CREATOR', 'ADMIN'), controller.getTemplate);
oneOnOnesRouter.patch('/:id', requireRole('CREATOR', 'ADMIN'), validate(updateTemplateSchema), controller.updateTemplate);
oneOnOnesRouter.delete('/:id', requireRole('CREATOR', 'ADMIN'), controller.deleteTemplate);
oneOnOnesRouter.post('/:id/duplicate', requireRole('CREATOR', 'ADMIN'), validate(duplicateTemplateSchema), controller.duplicateTemplate);
oneOnOnesRouter.post('/:id/publish', requireRole('CREATOR', 'ADMIN'), controller.publishTemplate);
oneOnOnesRouter.post('/:id/unpublish', requireRole('CREATOR', 'ADMIN'), controller.unpublishTemplate);

oneOnOnesRouter.post('/:id/blocks', requireRole('CREATOR', 'ADMIN'), validate(createBlockSchema), controller.addBlock);
oneOnOnesRouter.patch('/:id/blocks/:blockId', requireRole('CREATOR', 'ADMIN'), validate(updateBlockSchema), controller.updateBlock);
oneOnOnesRouter.delete('/:id/blocks/:blockId', requireRole('CREATOR', 'ADMIN'), controller.deleteBlock);
oneOnOnesRouter.put('/:id/blocks/reorder', requireRole('CREATOR', 'ADMIN'), validate(reorderBlocksSchema), controller.reorderBlocks);

oneOnOnesRouter.post('/:id/blocks/:blockId/questions', requireRole('CREATOR', 'ADMIN'), validate(createQuestionSchema), controller.addQuestion);
oneOnOnesRouter.patch('/:id/blocks/:blockId/questions/:qid', requireRole('CREATOR', 'ADMIN'), validate(updateQuestionSchema), controller.updateQuestion);
oneOnOnesRouter.delete('/:id/blocks/:blockId/questions/:qid', requireRole('CREATOR', 'ADMIN'), controller.deleteQuestion);
oneOnOnesRouter.put('/:id/blocks/:blockId/questions/reorder', requireRole('CREATOR', 'ADMIN'), validate(reorderQuestionsSchema), controller.reorderQuestions);

oneOnOnesRouter.put('/:id/recipients', requireRole('CREATOR', 'ADMIN'), validate(setRecipientsSchema), controller.setRecipients);
oneOnOnesRouter.post('/:id/recipients', requireRole('CREATOR', 'ADMIN'), validate(addRecipientsSchema), controller.addRecipients);
oneOnOnesRouter.delete('/:id/recipients/:userId', requireRole('CREATOR', 'ADMIN'), controller.removeRecipient);

oneOnOnesRouter.post('/:id/runs', requireRole('CREATOR', 'ADMIN'), validate(startRunSchema), controller.startRun);
oneOnOnesRouter.get('/:id/runs', requireRole('CREATOR', 'ADMIN'), controller.listRuns);
// No role gate here — a recipient may view their own trend; the service
// enforces that non-owners can only ever request their own userId.
oneOnOnesRouter.get('/:id/trend/:userId', controller.getTrend);
