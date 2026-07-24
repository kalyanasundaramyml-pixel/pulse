import { RequestHandler } from 'express';
import { prisma } from '../db/prisma';
import { UnauthorizedError } from '../lib/errors';

// Loads the member fresh on every request (cheap at ~500 members) so a role
// change or deactivation by an Admin takes effect on the very next request
// rather than waiting for the session to expire.
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedError('Not signed in');
    }
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member || !member.isActive) {
      req.session.destroy(() => undefined);
      throw new UnauthorizedError('Session is no longer valid');
    }
    req.member = member;
    next();
  } catch (err) {
    next(err);
  }
};
