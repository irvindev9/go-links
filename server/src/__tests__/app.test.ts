import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { LinkRepository } from '../db.js';
import { createApp } from '../app.js';

describe('Go Links API Specification (FR-01 to FR-06)', () => {
  let repository: LinkRepository;

  beforeEach(() => {
    repository = new LinkRepository(':memory:', true);
  });

  afterEach(() => {
    repository.close();
  });

  it('FR-06 & Observability: seeds default shortcuts and attaches X-Request-Id header', async () => {
    const app = createApp(repository);

    const res = await request(app).get('/api/links');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toMatch(/^req_/);
    expect(res.body.meta.total).toBe(3);

    const slugs = res.body.data.map((item: { slug: string }) => item.slug);
    expect(slugs).toEqual(['design-system', 'oncall', 'payroll']);
  });

  it('Observability: preserves incoming X-Request-Id header across responses', async () => {
    const app = createApp(repository);

    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', 'req_custom_trace_123');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('req_custom_trace_123');
    expect(res.body.requestId).toBe('req_custom_trace_123');
  });

  it('FR-01: creates a valid shortcut and normalizes leading go/ prefix', async () => {
    const app = createApp(repository);

    const res = await request(app).post('/api/links').send({
      slug: '  go/Eng-Handbook ',
      targetUrl: 'https://handbook.example.com/engineering',
      description: 'Internal engineering onboarding guide',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      slug: 'eng-handbook',
      targetUrl: 'https://handbook.example.com/engineering',
      description: 'Internal engineering onboarding guide',
      clicks: 0,
    });
  });

  it('FR-02: rejects duplicate slugs with 409 SLUG_ALREADY_EXISTS', async () => {
    const app = createApp(repository);

    const res = await request(app).post('/api/links').send({
      slug: 'oncall',
      targetUrl: 'https://ops.example.com',
      description: 'Duplicate oncall link',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_ALREADY_EXISTS');
    expect(res.body.error.requestId).toBeDefined();
  });

  it('FR-02: rejects invalid slugs and unsafe URL protocols with 400 VALIDATION_ERROR', async () => {
    const app = createApp(repository);

    const badSlugRes = await request(app).post('/api/links').send({
      slug: 'invalid slug with spaces!',
      targetUrl: 'https://example.com',
    });

    expect(badSlugRes.status).toBe(400);
    expect(badSlugRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(badSlugRes.body.error.details.slug).toBeDefined();

    const unsafeUrlRes = await request(app).post('/api/links').send({
      slug: 'xss-link',
      targetUrl: 'javascript:alert(1)',
    });

    expect(unsafeUrlRes.status).toBe(400);
    expect(unsafeUrlRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(unsafeUrlRes.body.error.details.targetUrl).toBeDefined();
  });

  it('FR-03: filters shortcuts by slug, description, or destination URL', async () => {
    const app = createApp(repository);

    const res = await request(app).get('/api/links').query({ q: 'pagerduty' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].slug).toBe('oncall');
  });

  it('FR-04: redirects GET /go/:slug with 302 Found and increments click count', async () => {
    const app = createApp(repository);

    const beforeRes = await request(app).get('/api/links').query({ q: 'payroll' });
    const initialClicks = beforeRes.body.data[0].clicks;

    const redirectRes = await request(app).get('/go/payroll');
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.location).toBe('https://gusto.com/');

    const afterRes = await request(app).get('/api/links').query({ q: 'payroll' });
    expect(afterRes.body.data[0].clicks).toBe(initialClicks + 1);
  });

  it('FR-04: returns 404 LINK_NOT_FOUND for unknown shortcut slugs', async () => {
    const app = createApp(repository);

    const res = await request(app).get('/go/non-existent-shortcut');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('LINK_NOT_FOUND');
  });

  it('FR-05: deletes an existing shortcut and returns 204 No Content', async () => {
    const app = createApp(repository);

    const listRes = await request(app).get('/api/links');
    const targetId = listRes.body.data[0].id;

    const delRes = await request(app).delete(`/api/links/${targetId}`);
    expect(delRes.status).toBe(204);

    const delAgainRes = await request(app).delete(`/api/links/${targetId}`);
    expect(delAgainRes.status).toBe(404);
    expect(delAgainRes.body.error.code).toBe('LINK_NOT_FOUND');
  });
});
