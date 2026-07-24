import { Router } from 'express';
import * as controller from './dashboard.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePasswordChanged } from '../../middleware/requirePasswordChanged';

export const dashboardRouter = Router();

// No role gate here — access (owner, Admin, Auditor-of-group, or an explicit
// Viewer grant) is enforced entirely in the service via
// assertCanViewSurveyDashboard.
dashboardRouter.get('/:id/dashboard', requireAuth, requirePasswordChanged, controller.getDashboard);
