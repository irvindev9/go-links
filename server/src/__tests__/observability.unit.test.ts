import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../middleware/observability.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { AppError } from '../types.js';

describe('Unit: Observability & Error Handling Middlewares', () => {
  it('generates a req_<uuid> requestId when X-Request-Id header is absent', () => {
    const setHeader = jest.fn();
    const req = {
      header: () => undefined,
      requestId: '',
    } as unknown as Request;
    const res = {
      setHeader,
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toMatch(/^req_[a-f0-9]{8}$/);
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('formats unexpected errors into a 500 INTERNAL_ERROR envelope with requestId', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const req = { requestId: 'req_unit_500' } as unknown as Request;
    const res = { status } as unknown as Response;
    const next = jest.fn() as NextFunction;

    errorHandler(new Error('Database disk full'), req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected internal error occurred.',
        details: {},
        requestId: 'req_unit_500',
      },
    });
  });

  it('formats AppError instances with their custom status code and details', () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const req = { requestId: 'req_unit_409' } as unknown as Request;
    const res = { status } as unknown as Response;
    const next = jest.fn() as NextFunction;

    const err = new AppError(409, 'SLUG_ALREADY_EXISTS', 'Duplicate shortcut', {
      slug: ['Already registered'],
    });
    errorHandler(err, req, res, next);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'SLUG_ALREADY_EXISTS',
        message: 'Duplicate shortcut',
        details: { slug: ['Already registered'] },
        requestId: 'req_unit_409',
      },
    });
  });
});
