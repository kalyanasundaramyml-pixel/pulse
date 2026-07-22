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

// Templates (Leader/Admin)
oneOnOnesRouter.post('/', requireRole('LEADER', 'ADMIN'), validate(createTemplateSchema), controller.createTemplate);
oneOnOnesRouter.get('/', requireRole('LEADER', 'ADMIN'), validate(listTemplatesQuerySchema, 'query'), controller.listTemplates);
oneOnOnesRouter.get('/:id', requireRole('LEADER', 'ADMIN'), controller.getTemplate);
oneOnOnesRouter.patch('/:id', requireRole('LEADER', 'ADMIN'), validate(updateTemplateSchema), controller.updateTemplate);
oneOnOnesRouter.delete('/:id', requireRole('LEADER', 'ADMIN'), controller.deleteTemplate);
oneOnOnesRouter.post('/:id/duplicate', requireRole('LEADER', 'ADMIN'), validate(duplicateTemplateSchema), controller.duplicateTemplate);
oneOnOnesRouter.post('/:id/publish', requireRole('LEADER', 'ADMIN'), controller.publishTemplate);
oneOnOnesRouter.post('/:id/unpublish', requireRole('LEADER', 'ADMIN'), controller.unpublishTemplate);

oneOnOnesRouter.post('/:id/blocks', requireRole('LEADER', 'ADMIN'), validate(createBlockSchema), controller.addBlock);
oneOnOnesRouter.patch('/:id/blocks/:blockId', requireRole('LEADER', 'ADMIN'), validate(updateBlockSchema), controller.updateBlock);
oneOnOnesRouter.delete('/:id/blocks/:blockId', requireRole('LEADER', 'ADMIN'), controller.deleteBlock);
oneOnOnesRouter.put('/:id/blocks/reorder', requireRole('LEADER', 'ADMIN'), validate(reorderBlocksSchema), controller.reorderBlocks);

oneOnOnesRouter.post('/:id/blocks/:blockId/questions', requireRole('LEADER', 'ADMIN'), validate(createQuestionSchema), controller.addQuestion);
oneOnOnesRouter.patch('/:id/blocks/:blockId/questions/:qid', requireRole('LEADER', 'ADMIN'), validate(updateQuestionSchema), controller.updateQuestion);
oneOnOnesRouter.delete('/:id/blocks/:blockId/questions/:qid', requireRole('LEADER', 'ADMIN'), controller.deleteQuestion);
oneOnOnesRouter.put('/:id/blocks/:blockId/questions/reorder', requireRole('LEADER', 'ADMIN'), validate(reorderQuestionsSchema), controller.reorderQuestions);

oneOnOnesRouter.put('/:id/recipients', requireRole('LEADER', 'ADMIN'), validate(setRecipientsSchema), controller.setRecipients);
oneOnOnesRouter.post('/:id/recipients', requireRole('LEADER', 'ADMIN'), validate(addRecipientsSchema), controller.addRecipients);
oneOnOnesRouter.delete('/:id/recipients/:userId', requireRole('LEADER', 'ADMIN'), controller.removeRecipient);

oneOnOnesRouter.post('/:id/runs', requireRole('LEADER', 'ADMIN'), validate(startRunSchema), controller.startRun);
oneOnOnesRouter.get('/:id/runs', requireRole('LEADER', 'ADMIN'), controller.listRuns);
oneOnOnesRouter.get('/:id/trend/:userId', requireRole('LEADER', 'ADMIN'), controller.getTrend);
