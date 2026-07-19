import { ErrorRequestHandler } from 'express';
import { AppError } from '../lib/errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      code: err.code,
      message: err.message,
      ...(err instanceof Object && 'details' in err ? { details: (err as { details?: unknown }).details } : {}),
    });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Something went wrong' });
};
