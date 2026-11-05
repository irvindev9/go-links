import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { LinkRepository } from '../db.js';
import { AppError } from '../types.js';

describe('Unit: LinkRepository SQLite Layer', () => {
  let repo: LinkRepository;

  beforeEach(() => {
    repo = new LinkRepository(':memory:', false);
  });

  afterEach(() => {
    repo.close();
  });

  it('starts empty when seedDefaults is false and passes healthCheck()', () => {
    expect(repo.healthCheck()).toBe(true);
    expect(repo.list()).toEqual([]);
  });

  it('creates a new shortcut and retrieves it by slug', () => {
    const created = repo.create({
      slug: 'incident-runbook',
      targetUrl: 'https://docs.example.com/runbook',
      description: 'SEV-1 response guide',
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.slug).toBe('incident-runbook');
    expect(created.clicks).toBe(0);
    expect(created.lastAccessedAt).toBeNull();

    const found = repo.findBySlug('incident-runbook');
    expect(found).toEqual(created);
  });

  it('throws AppError(409, SLUG_ALREADY_EXISTS) when creating a duplicate slug', () => {
    repo.create({
      slug: 'metrics',
      targetUrl: 'https://grafana.example.com',
      description: 'Production dashboards',
    });

    expect(() =>
      repo.create({
        slug: 'metrics',
        targetUrl: 'https://datadog.example.com',
        description: 'Duplicate slug attempt',
      }),
    ).toThrow(AppError);

    try {
      repo.create({
        slug: 'metrics',
        targetUrl: 'https://datadog.example.com',
        description: 'Duplicate slug attempt',
      });
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(409);
      expect(appErr.code).toBe('SLUG_ALREADY_EXISTS');
    }
  });

  it('atomically increments click count and sets lastAccessedAt on visit', () => {
    repo.create({
      slug: 'all-hands',
      targetUrl: 'https://slides.example.com/q4',
      description: 'Weekly all-hands deck',
    });

    const firstVisit = repo.recordVisitAndGetTarget('all-hands');
    expect(firstVisit).not.toBeNull();
    expect(firstVisit?.clicks).toBe(1);
    expect(firstVisit?.lastAccessedAt).not.toBeNull();

    const secondVisit = repo.recordVisitAndGetTarget('all-hands');
    expect(secondVisit?.clicks).toBe(2);

    expect(repo.recordVisitAndGetTarget('missing-slug')).toBeNull();
  });

  it('filters shortcuts by query across slug, description, and targetUrl', () => {
    repo.create({
      slug: 'design',
      targetUrl: 'https://figma.com/team',
      description: 'UI library',
    });
    repo.create({
      slug: 'sprint-board',
      targetUrl: 'https://linear.app/team',
      description: 'Engineering backlog',
    });

    expect(repo.list('figma')).toHaveLength(1);
    expect(repo.list('backlog')).toHaveLength(1);
    expect(repo.list('go/design')).toHaveLength(1);
    expect(repo.list('nonexistent')).toHaveLength(0);
  });

  it('deletes a shortcut by ID and returns false when ID does not exist', () => {
    const created = repo.create({
      slug: 'temp-link',
      targetUrl: 'https://example.com/temp',
      description: 'Temporary shortcut',
    });

    expect(repo.deleteById(created.id)).toBe(true);
    expect(repo.deleteById(created.id)).toBe(false);
    expect(repo.findBySlug('temp-link')).toBeNull();
  });
});
