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

surveysRouter.post('/', requireRole('CREATOR', 'ADMIN'), validate(createSurveySchema), controller.createSurvey);
surveysRouter.get('/', validate(listSurveysQuerySchema, 'query'), controller.listSurveys);
surveysRouter.get('/:id', controller.getSurvey);
surveysRouter.patch('/:id', requireRole('CREATOR', 'ADMIN'), validate(updateSurveySchema), controller.updateSurvey);
surveysRouter.delete('/:id', requireRole('CREATOR', 'ADMIN'), controller.deleteSurvey);
surveysRouter.post('/:id/publish', requireRole('CREATOR', 'ADMIN'), controller.publishSurvey);
surveysRouter.post('/:id/close', requireRole('CREATOR', 'ADMIN'), controller.closeSurvey);
surveysRouter.post('/:id/unpublish', requireRole('CREATOR', 'ADMIN'), controller.unpublishSurvey);
surveysRouter.post('/:id/reopen', requireRole('CREATOR', 'ADMIN'), validate(reopenSurveySchema), controller.reopenSurvey);
surveysRouter.post('/:id/duplicate', requireRole('CREATOR', 'ADMIN'), validate(duplicateSurveySchema), controller.duplicateSurvey);

surveysRouter.post('/:id/blocks', requireRole('CREATOR', 'ADMIN'), validate(createBlockSchema), controller.addBlock);
surveysRouter.patch('/:id/blocks/:blockId', requireRole('CREATOR', 'ADMIN'), validate(updateBlockSchema), controller.updateBlock);
surveysRouter.delete('/:id/blocks/:blockId', requireRole('CREATOR', 'ADMIN'), controller.deleteBlock);
surveysRouter.put('/:id/blocks/reorder', requireRole('CREATOR', 'ADMIN'), validate(reorderBlocksSchema), controller.reorderBlocks);

surveysRouter.post('/:id/blocks/:blockId/questions', requireRole('CREATOR', 'ADMIN'), validate(createQuestionSchema), controller.addQuestion);
surveysRouter.patch('/:id/blocks/:blockId/questions/:qid', requireRole('CREATOR', 'ADMIN'), validate(updateQuestionSchema), controller.updateQuestion);
surveysRouter.delete('/:id/blocks/:blockId/questions/:qid', requireRole('CREATOR', 'ADMIN'), controller.deleteQuestion);
surveysRouter.put('/:id/blocks/:blockId/questions/reorder', requireRole('CREATOR', 'ADMIN'), validate(reorderQuestionsSchema), controller.reorderQuestions);

surveysRouter.put('/:id/recipients', requireRole('CREATOR', 'ADMIN'), validate(setRecipientsSchema), controller.setRecipients);
surveysRouter.post('/:id/recipients', requireRole('CREATOR', 'ADMIN'), validate(addRecipientsSchema), controller.addRecipients);
surveysRouter.delete('/:id/recipients/:userId', requireRole('CREATOR', 'ADMIN'), controller.removeRecipient);
surveysRouter.post('/:id/recipients/:userId/reopen', requireRole('CREATOR', 'ADMIN'), controller.reopenForRecipient);
