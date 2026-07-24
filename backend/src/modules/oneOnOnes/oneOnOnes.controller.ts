import { RequestHandler } from 'express';
import * as service from './oneOnOnes.service';

export const createTemplate: RequestHandler = async (req, res, next) => {
  try {
    const template = await service.createTemplate(req.member!, req.body);
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
};

export const listTemplates: RequestHandler = async (req, res, next) => {
  try {
    const templates = await service.listTemplates(
      req.member!,
      (req.query as { scope: 'created' | 'all' | 'public' }).scope,
    );
    res.json({ templates });
  } catch (err) {
    next(err);
  }
};

export const getTemplate: RequestHandler = async (req, res, next) => {
  try {
    const template = await service.getTemplateDetail(req.params.id, req.member!);
    res.json({ template });
  } catch (err) {
    next(err);
  }
};

export const updateTemplate: RequestHandler = async (req, res, next) => {
  try {
    const template = await service.updateTemplate(req.params.id, req.member!, req.body);
    res.json({ template });
  } catch (err) {
    next(err);
  }
};

export const deleteTemplate: RequestHandler = async (req, res, next) => {
  try {
    await service.deleteTemplate(req.params.id, req.member!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const duplicateTemplate: RequestHandler = async (req, res, next) => {
  try {
    const template = await service.duplicateTemplate(req.params.id, req.member!, req.body.asTemplate);
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
};

export const publishTemplate: RequestHandler = async (req, res, next) => {
  try {
    const template = await service.publishTemplate(req.params.id, req.member!);
    res.json({ template });
  } catch (err) {
    next(err);
  }
};

export const unpublishTemplate: RequestHandler = async (req, res, next) => {
  try {
    const template = await service.unpublishTemplate(req.params.id, req.member!);
    res.json({ template });
  } catch (err) {
    next(err);
  }
};

export const addBlock: RequestHandler = async (req, res, next) => {
  try {
    const block = await service.addBlock(req.params.id, req.member!, req.body.name);
    res.status(201).json({ block });
  } catch (err) {
    next(err);
  }
};

export const updateBlock: RequestHandler = async (req, res, next) => {
  try {
    const block = await service.updateBlock(req.params.id, req.params.blockId, req.member!, req.body);
    res.json({ block });
  } catch (err) {
    next(err);
  }
};

export const deleteBlock: RequestHandler = async (req, res, next) => {
  try {
    await service.deleteBlock(req.params.id, req.params.blockId, req.member!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const reorderBlocks: RequestHandler = async (req, res, next) => {
  try {
    await service.reorderBlocks(req.params.id, req.member!, req.body.blockIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const addQuestion: RequestHandler = async (req, res, next) => {
  try {
    const question = await service.addQuestion(req.params.id, req.params.blockId, req.member!, req.body);
    res.status(201).json({ question });
  } catch (err) {
    next(err);
  }
};

export const updateQuestion: RequestHandler = async (req, res, next) => {
  try {
    const question = await service.updateQuestion(
      req.params.id,
      req.params.blockId,
      req.params.qid,
      req.member!,
      req.body,
    );
    res.json({ question });
  } catch (err) {
    next(err);
  }
};

export const deleteQuestion: RequestHandler = async (req, res, next) => {
  try {
    await service.deleteQuestion(req.params.id, req.params.blockId, req.params.qid, req.member!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const reorderQuestions: RequestHandler = async (req, res, next) => {
  try {
    await service.reorderQuestions(req.params.id, req.params.blockId, req.member!, req.body.questionIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const setRecipients: RequestHandler = async (req, res, next) => {
  try {
    await service.setRecipients(req.params.id, req.member!, req.body.memberIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const addRecipients: RequestHandler = async (req, res, next) => {
  try {
    await service.addRecipients(req.params.id, req.member!, req.body.memberIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const removeRecipient: RequestHandler = async (req, res, next) => {
  try {
    await service.removeRecipient(req.params.id, req.params.memberId, req.member!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const startRun: RequestHandler = async (req, res, next) => {
  try {
    const run = await service.startRun(req.params.id, req.member!, req.body.recipientMemberId);
    res.status(201).json({ run });
  } catch (err) {
    next(err);
  }
};

export const listRuns: RequestHandler = async (req, res, next) => {
  try {
    const runs = await service.listRuns(req.params.id, req.member!, req.query.recipientMemberId as string | undefined);
    res.json({ runs });
  } catch (err) {
    next(err);
  }
};

export const getTrend: RequestHandler = async (req, res, next) => {
  try {
    const trend = await service.getTrend(req.params.id, req.member!, req.params.memberId);
    res.json(trend);
  } catch (err) {
    next(err);
  }
};

export const getMyRuns: RequestHandler = async (req, res, next) => {
  try {
    const runs = await service.getMyRuns(req.member!);
    res.json({ runs });
  } catch (err) {
    next(err);
  }
};

export const getTakeRun: RequestHandler = async (req, res, next) => {
  try {
    const result = await service.getTakeRun(req.params.runId, req.member!);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const submitRun: RequestHandler = async (req, res, next) => {
  try {
    const result = await service.submitRun(req.params.runId, req.member!, req.body.answers);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};
