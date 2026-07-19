import { RequestHandler } from 'express';
import { AppError } from '../lib/errors';

export const requirePasswordChanged: RequestHandler = (req, _res, next) => {
  if (req.user?.mustChangePassword) {
    next(new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'You must set a new password before continuing'));
    return;
  }
  next();
};
