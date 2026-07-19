import { RequestHandler } from 'express';
import { prisma } from '../db/prisma';
import { UnauthorizedError } from '../lib/errors';

// Loads the user fresh on every request (cheap at ~500 users) so a role
// change or deactivation by an Admin takes effect on the very next request
// rather than waiting for the session to expire.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      throw new UnauthorizedError('Not signed in');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      req.session.destroy(() => undefined);
      throw new UnauthorizedError('Session is no longer valid');
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
