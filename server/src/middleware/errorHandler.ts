import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../types.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'req_unknown';

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'root';
      if (!fieldErrors[key]) {
        fieldErrors[key] = [];
      }
      fieldErrors[key].push(issue.message);
    }

    const firstMessage = err.issues[0]?.message ?? 'Invalid request payload';
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: firstMessage,
        details: fieldErrors,
        requestId,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? {},
        requestId,
      },
    });
    return;
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        requestId,
        message: err instanceof Error ? err.message : 'Unexpected error',
        stack: err instanceof Error ? err.stack : undefined,
      }),
    );
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal error occurred.',
      details: {},
      requestId,
    },
  });
}
