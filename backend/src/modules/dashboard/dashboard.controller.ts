import { RequestHandler } from 'express';
import * as dashboardService from './dashboard.service';

export const getDashboard: RequestHandler = async (req, res, next) => {
  try {
    const dashboard = await dashboardService.getDashboard(req.params.id, req.user!);
    res.json(dashboard);
  } catch (err) {
    next(err);
  }
};
