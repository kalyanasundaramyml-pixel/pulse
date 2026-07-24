import { RequestHandler } from 'express';
import * as authService from './auth.service';
import { UnauthorizedError } from '../../lib/errors';

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const member = await authService.authenticate(email, password);
    req.session.regenerate((err) => {
      if (err) {
        next(err);
        return;
      }
      req.session.memberId = member.id;
      res.json({ member: authService.toPublicMember(member) });
    });
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie('sid');
    res.status(204).end();
  });
};

export const me: RequestHandler = (req, res, next) => {
  if (!req.member) {
    next(new UnauthorizedError());
    return;
  }
  res.json({ member: authService.toPublicMember(req.member) });
};

export const changePassword: RequestHandler = async (req, res, next) => {
  try {
    if (!req.member) {
      throw new UnauthorizedError();
    }
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    await authService.changePassword(req.member.id, currentPassword, newPassword);
    req.session.regenerate((err) => {
      if (err) {
        next(err);
        return;
      }
      req.session.memberId = req.member!.id;
      res.status(204).end();
    });
  } catch (err) {
    next(err);
  }
};
