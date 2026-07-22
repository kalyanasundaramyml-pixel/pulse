import { Router } from 'express';
import * as controller from './surveys.controller';
import {
  createSurveySchema,
  updateSurveySchema,
  listSurveysQuerySchema,
  createBlockSchema,
  updateBlockSchema,
  reorderBlocksSchema,
  createQuestionSchema,
  updateQuestionSchema,
  reorderQuestionsSchema,
  setRecipientsSchema,
  addRecipientsSchema,
  reopenSurveySchema,
  duplicateSurveySchema,
} from './surveys.schemas';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePasswordChanged } from '../../middleware/requirePasswordChanged';
import { requireRole } from '../../middleware/requireRole';

export const surveysRouter = Router();

surveysRouter.use(requireAuth, requirePasswordChanged);

surveysRouter.post('/', requireRole('LEADER', 'ADMIN'), validate(createSurveySchema), controller.createSurvey);
surveysRouter.get('/', validate(listSurveysQuerySchema, 'query'), controller.listSurveys);
surveysRouter.get('/:id', controller.getSurvey);
surveysRouter.patch('/:id', requireRole('LEADER', 'ADMIN'), validate(updateSurveySchema), controller.updateSurvey);
surveysRouter.delete('/:id', requireRole('LEADER', 'ADMIN'), controller.deleteSurvey);
surveysRouter.post('/:id/publish', requireRole('LEADER', 'ADMIN'), controller.publishSurvey);
surveysRouter.post('/:id/close', requireRole('LEADER', 'ADMIN'), controller.closeSurvey);
surveysRouter.post('/:id/unpublish', requireRole('LEADER', 'ADMIN'), controller.unpublishSurvey);
surveysRouter.post('/:id/reopen', requireRole('LEADER', 'ADMIN'), validate(reopenSurveySchema), controller.reopenSurvey);
surveysRouter.post('/:id/duplicate', requireRole('LEADER', 'ADMIN'), validate(duplicateSurveySchema), controller.duplicateSurvey);

surveysRouter.post('/:id/blocks', requireRole('LEADER', 'ADMIN'), validate(createBlockSchema), controller.addBlock);
surveysRouter.patch('/:id/blocks/:blockId', requireRole('LEADER', 'ADMIN'), validate(updateBlockSchema), controller.updateBlock);
surveysRouter.delete('/:id/blocks/:blockId', requireRole('LEADER', 'ADMIN'), controller.deleteBlock);
surveysRouter.put('/:id/blocks/reorder', requireRole('LEADER', 'ADMIN'), validate(reorderBlocksSchema), controller.reorderBlocks);

surveysRouter.post('/:id/blocks/:blockId/questions', requireRole('LEADER', 'ADMIN'), validate(createQuestionSchema), controller.addQuestion);
surveysRouter.patch('/:id/blocks/:blockId/questions/:qid', requireRole('LEADER', 'ADMIN'), validate(updateQuestionSchema), controller.updateQuestion);
surveysRouter.delete('/:id/blocks/:blockId/questions/:qid', requireRole('LEADER', 'ADMIN'), controller.deleteQuestion);
surveysRouter.put('/:id/blocks/:blockId/questions/reorder', requireRole('LEADER', 'ADMIN'), validate(reorderQuestionsSchema), controller.reorderQuestions);

surveysRouter.put('/:id/recipients', requireRole('LEADER', 'ADMIN'), validate(setRecipientsSchema), controller.setRecipients);
surveysRouter.post('/:id/recipients', requireRole('LEADER', 'ADMIN'), validate(addRecipientsSchema), controller.addRecipients);
surveysRouter.delete('/:id/recipients/:userId', requireRole('LEADER', 'ADMIN'), controller.removeRecipient);
