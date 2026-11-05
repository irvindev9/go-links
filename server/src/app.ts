import express, { type Express } from 'express';
import cors from 'cors';
import type { LinkRepository } from './db.js';
import {
  createLinkSchema,
  idParamSchema,
  listLinksQuerySchema,
  normalizeSlug,
} from './schemas.js';
import { AppError } from './types.js';
import {
  requestIdMiddleware,
  requestLoggerMiddleware,
} from './middleware/observability.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(repository: LinkRepository): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    cors({
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    const dbOk = repository.healthCheck();
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
  });

  // FR-03: List & Search Shortcuts
  app.get('/api/links', (req, res, next) => {
    try {
      const { q } = listLinksQuerySchema.parse(req.query);
      const links = repository.list(q);
      res.status(200).json({
        data: links,
        meta: {
          total: links.length,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // FR-01 & FR-02: Create Shortcut with validation & conflict handling
  app.post('/api/links', (req, res, next) => {
    try {
      const input = createLinkSchema.parse(req.body);
      const created = repository.create(input);
      res.status(201).json({
        data: created,
      });
    } catch (err) {
      next(err);
    }
  });

  // FR-05: Delete Shortcut by ID
  app.delete('/api/links/:id', (req, res, next) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const deleted = repository.deleteById(id);
      if (!deleted) {
        throw new AppError(404, 'LINK_NOT_FOUND', `Shortcut with ID ${id} was not found.`);
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // FR-04: Resolve & Redirect (/go/:slug)
  app.get(/^\/go\/(.*)$/, (req, res, next) => {
    try {
      const rawParam = req.params[0] ?? '';
      const slug = normalizeSlug(rawParam);

      if (!slug) {
        throw new AppError(404, 'LINK_NOT_FOUND', 'No shortcut slug provided.');
      }

      const resolved = repository.recordVisitAndGetTarget(slug);
      if (!resolved) {
        throw new AppError(
          404,
          'LINK_NOT_FOUND',
          `The shortcut 'go/${slug}' does not exist.`,
        );
      }

      res.redirect(302, resolved.targetUrl);
    } catch (err) {
      next(err);
    }
  });

  // Centralized error handling
  app.use(errorHandler);

  return app;
}
