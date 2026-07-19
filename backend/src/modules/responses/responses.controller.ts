import { RequestHandler } from 'express';
import * as responsesService from './responses.service';

export const takeSurvey: RequestHandler = async (req, res, next) => {
  try {
    const result = await responsesService.getTakeSurvey(req.params.id, req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const submitResponse: RequestHandler = async (req, res, next) => {
  try {
    const result = await responsesService.submitResponse(req.params.id, req.user!, req.body.answers);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const editResponse: RequestHandler = async (req, res, next) => {
  try {
    const result = await responsesService.editResponse(req.params.id, req.user!, req.body.answers);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getMyResponse: RequestHandler = async (req, res, next) => {
  try {
    const result = await responsesService.getMyResponse(req.params.id, req.user!);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
