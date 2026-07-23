import { RequestHandler } from 'express';
import * as surveysService from './surveys.service';

export const createSurvey: RequestHandler = async (req, res, next) => {
  try {
    const survey = await surveysService.createSurvey(req.user!, req.body);
    res.status(201).json({ survey });
  } catch (err) {
    next(err);
  }
};

export const listSurveys: RequestHandler = async (req, res, next) => {
  try {
    const surveys = await surveysService.listSurveys(req.user!, req.query as never);
    res.json({ surveys });
  } catch (err) {
    next(err);
  }
};

export const getSurvey: RequestHandler = async (req, res, next) => {
  try {
    const survey = await surveysService.getSurveyDetail(req.params.id, req.user!);
    res.json({ survey });
  } catch (err) {
    next(err);
  }
};

export const updateSurvey: RequestHandler = async (req, res, next) => {
  try {
    const survey = await surveysService.updateSurvey(req.params.id, req.user!, req.body);
    res.json({ survey });
  } catch (err) {
    next(err);
  }
};

export const deleteSurvey: RequestHandler = async (req, res, next) => {
  try {
    await surveysService.deleteSurvey(req.params.id, req.user!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const publishSurvey: RequestHandler = async (req, res, next) => {
  try {
    const survey = await surveysService.publishSurvey(req.params.id, req.user!);
    res.json({ survey });
  } catch (err) {
    next(err);
  }
};

export const closeSurvey: RequestHandler = async (req, res, next) => {
  try {
    const survey = await surveysService.closeSurvey(req.params.id, req.user!);
    res.json({ survey });
  } catch (err) {
    next(err);
  }
};

export const unpublishSurvey: RequestHandler = async (req, res, next) => {
  try {
    const survey = await surveysService.unpublishSurvey(req.params.id, req.user!);
    res.json({ survey });
  } catch (err) {
    next(err);
  }
};

export const reopenSurvey: RequestHandler = async (req, res, next) => {
  try {
    const survey = await surveysService.reopenSurvey(req.params.id, req.user!, req.body.endDate);
    res.json({ survey });
  } catch (err) {
    next(err);
  }
};

export const duplicateSurvey: RequestHandler = async (req, res, next) => {
  try {
    const survey = await surveysService.duplicateSurvey(req.params.id, req.user!, req.body.asTemplate);
    res.status(201).json({ survey });
  } catch (err) {
    next(err);
  }
};

export const addBlock: RequestHandler = async (req, res, next) => {
  try {
    const block = await surveysService.addBlock(req.params.id, req.user!, req.body.name);
    res.status(201).json({ block });
  } catch (err) {
    next(err);
  }
};

export const updateBlock: RequestHandler = async (req, res, next) => {
  try {
    const block = await surveysService.updateBlock(req.params.id, req.params.blockId, req.user!, req.body);
    res.json({ block });
  } catch (err) {
    next(err);
  }
};

export const deleteBlock: RequestHandler = async (req, res, next) => {
  try {
    await surveysService.deleteBlock(req.params.id, req.params.blockId, req.user!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const reorderBlocks: RequestHandler = async (req, res, next) => {
  try {
    await surveysService.reorderBlocks(req.params.id, req.user!, req.body.blockIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const addQuestion: RequestHandler = async (req, res, next) => {
  try {
    const question = await surveysService.addQuestion(req.params.id, req.params.blockId, req.user!, req.body);
    res.status(201).json({ question });
  } catch (err) {
    next(err);
  }
};

export const updateQuestion: RequestHandler = async (req, res, next) => {
  try {
    const question = await surveysService.updateQuestion(
      req.params.id,
      req.params.blockId,
      req.params.qid,
      req.user!,
      req.body,
    );
    res.json({ question });
  } catch (err) {
    next(err);
  }
};

export const deleteQuestion: RequestHandler = async (req, res, next) => {
  try {
    await surveysService.deleteQuestion(req.params.id, req.params.blockId, req.params.qid, req.user!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const reorderQuestions: RequestHandler = async (req, res, next) => {
  try {
    await surveysService.reorderQuestions(req.params.id, req.params.blockId, req.user!, req.body.questionIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const setRecipients: RequestHandler = async (req, res, next) => {
  try {
    const { protectedUserIds } = await surveysService.setRecipients(req.params.id, req.user!, req.body.userIds);
    if (protectedUserIds.length > 0) {
      res.status(200).json({
        protectedUserIds,
        message: 'Some recipients were kept on the list because they already responded to this survey',
      });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const addRecipients: RequestHandler = async (req, res, next) => {
  try {
    await surveysService.addRecipients(req.params.id, req.user!, req.body.userIds);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const removeRecipient: RequestHandler = async (req, res, next) => {
  try {
    await surveysService.removeRecipient(req.params.id, req.params.userId, req.user!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

export const reopenForRecipient: RequestHandler = async (req, res, next) => {
  try {
    await surveysService.reopenForRecipient(req.params.id, req.params.userId, req.user!);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
