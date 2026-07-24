import { RequestHandler } from 'express';
import * as groupsService from './groups.service';

export const listGroups: RequestHandler = async (_req, res, next) => {
  try {
    const groups = await groupsService.listGroups();
    res.json({ groups });
  } catch (err) {
    next(err);
  }
};

export const createGroup: RequestHandler = async (req, res, next) => {
  try {
    const group = await groupsService.createGroup(req.body.name, req.member!.id);
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
};

export const updateGroup: RequestHandler = async (req, res, next) => {
  try {
    const group = await groupsService.renameGroup(req.params.id, req.body.name, req.member!.id);
    res.json({ group });
  } catch (err) {
    next(err);
  }
};

export const deleteGroup: RequestHandler = async (req, res, next) => {
  try {
    await groupsService.deleteGroup(req.params.id, req.member!.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
