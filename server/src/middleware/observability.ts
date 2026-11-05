import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.header('X-Request-Id')?.trim();
  const requestId = incomingId && incomingId.length > 0 ? incomingId : `req_${randomUUID().slice(0, 8)}`;

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const durationNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(durationNs) / 1_000_000;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
}
