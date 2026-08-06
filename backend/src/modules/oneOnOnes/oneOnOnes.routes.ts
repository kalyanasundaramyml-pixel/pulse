import { Router } from 'express';
import * as controller from './oneOnOnes.controller';
import {
  createTemplateSchema,
  updateTemplateSchema,
  listTemplatesQuerySchema,
  saveDraftSchema,
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

// Templates (Creator/Auditor/Admin) — an Auditor has full Creator-style
// control over their own templates/1:1s, plus (via the three read-only GETs
// below) group-scoped read access to everyone else's, enforced in the
// service by assertCanViewTemplateDetail/assertCanAuditTemplate.
oneOnOnesRouter.post('/', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), validate(createTemplateSchema), controller.createTemplate);
oneOnOnesRouter.get(
  '/',
  requireRole('CREATOR', 'ADMIN', 'AUDITOR'),
  validate(listTemplatesQuerySchema, 'query'),
  controller.listTemplates,
);
oneOnOnesRouter.get('/:id', requireRole('CREATOR', 'ADMIN', 'AUDITOR'), controller.getTemplate);
oneOnOnesRouter.patch('/:id', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), validate(updateTemplateSchema), controller.updateTemplate);
oneOnOnesRouter.delete('/:id', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), controller.deleteTemplate);
oneOnOnesRouter.post('/:id/duplicate', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), validate(duplicateTemplateSchema), controller.duplicateTemplate);
oneOnOnesRouter.post('/:id/publish', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), controller.publishTemplate);
oneOnOnesRouter.post('/:id/unpublish', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), controller.unpublishTemplate);

oneOnOnesRouter.put('/:id/draft', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), validate(saveDraftSchema), controller.saveDraft);

oneOnOnesRouter.put('/:id/recipients', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), validate(setRecipientsSchema), controller.setRecipients);
oneOnOnesRouter.post('/:id/recipients', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), validate(addRecipientsSchema), controller.addRecipients);
oneOnOnesRouter.delete('/:id/recipients/:memberId', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), controller.removeRecipient);

oneOnOnesRouter.post('/:id/runs', requireRole('CREATOR', 'AUDITOR', 'ADMIN'), validate(startRunSchema), controller.startRun);
oneOnOnesRouter.get('/:id/runs', requireRole('CREATOR', 'ADMIN', 'AUDITOR'), controller.listRuns);
// No role gate here — a recipient may view their own trend; the service
// enforces that non-owners can only ever request their own memberId.
oneOnOnesRouter.get('/:id/trend/:memberId', controller.getTrend);
