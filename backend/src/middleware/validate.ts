import { RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';
import { ValidationError } from '../lib/errors';

type Target = 'body' | 'query' | 'params';

export function validate(schema: ZodTypeAny, target: Target = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(new ValidationError('Invalid request payload', result.error.flatten()));
      return;
    }
    req[target] = result.data;
    next();
  };
}
