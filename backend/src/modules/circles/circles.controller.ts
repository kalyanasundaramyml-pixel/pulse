import { RequestHandler } from 'express';
import * as circlesService from './circles.service';

export const listCircles: RequestHandler = async (_req, res, next) => {
  try {
    const circles = await circlesService.listCircles();
    res.json({ circles });
  } catch (err) {
    next(err);
  }
};

export const getCircle: RequestHandler = async (req, res, next) => {
  try {
    const circle = await circlesService.getCircle(req.params.id);
    res.json({ circle });
  } catch (err) {
    next(err);
  }
};

export const createCircle: RequestHandler = async (req, res, next) => {
  try {
    const circle = await circlesService.createCircle(req.member!, req.body);
    res.status(201).json({ circle });
  } catch (err) {
    next(err);
  }
};

export const updateCircle: RequestHandler = async (req, res, next) => {
  try {
    const circle = await circlesService.updateCircle(req.params.id, req.body);
    res.json({ circle });
  } catch (err) {
    next(err);
  }
};

export const deleteCircle: RequestHandler = async (req, res, next) => {
  try {
    await circlesService.deleteCircle(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
