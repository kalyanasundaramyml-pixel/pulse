import { Router } from 'express';
import * as controller from './dashboard.controller';
import { requireAuth } from '../../middleware/requireAuth';
import { requirePasswordChanged } from '../../middleware/requirePasswordChanged';
import { requireRole } from '../../middleware/requireRole';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/:id/dashboard',
  requireAuth,
  requirePasswordChanged,
  requireRole('CREATOR', 'ADMIN'),
  controller.getDashboard,
);
