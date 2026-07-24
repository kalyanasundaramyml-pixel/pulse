import { RequestHandler } from 'express';
import { MemberRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';

export function requireRole(...roles: MemberRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.member) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.member.role)) {
      next(new ForbiddenError(`Requires one of roles: ${roles.join(', ')}`));
      return;
    }
    next();
  };
}
