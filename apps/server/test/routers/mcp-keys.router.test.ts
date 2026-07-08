import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RequestHandler } from 'express';
import { PROBLEM_CONTENT_TYPE, mcpKeySchema, problemSchema } from '@lifeline/shared';
import { OpenApiRegistry } from '../../src/http/openapi/registry.js';
import { buildMcpKeysRouter } from '../../src/http/routes/mcp-keys.js';
import { IssueMcpKey } from '../../src/application/mcp-keys/issue-key.js';
import { ListMcpKeys } from '../../src/application/mcp-keys/list-keys.js';
import { RevokeMcpKey } from '../../src/application/mcp-keys/revoke-key.js';
import { InMemoryMcpKeyRepository } from '../helpers/feature-fakes.js';
import { makeApp, makeUser } from '../helpers/router-app.js';
import type { CurrentUser } from '../../src/application/ports.js';

const PEPPER = 'router-test-pepper';

let keys: InMemoryMcpKeyRepository;
let limiterHits: number;

const countingLimiter: RequestHandler = (_req, _res, next) => {
  limiterHits += 1;
  next();
};

function buildApp(user: CurrentUser | null = makeUser({ id: 'u1' })) {
  return makeApp(
    '/api/v1/mcp-keys',
    buildMcpKeysRouter({
      listKeys: new ListMcpKeys({ keys }),
      issueKey: new IssueMcpKey({ keys }, { pepper: PEPPER }),
      revokeKey: new RevokeMcpKey({ keys }),
      registry: new OpenApiRegistry(),
      limiter: countingLimiter,
    }),
    user,
  );
}

beforeEach(() => {
  keys = new InMemoryMcpKeyRepository();
  limiterHits = 0;
});

function expectProblem(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  expect(problemSchema.safeParse(response.body).success).toBe(true);
  expect(response.body).toMatchObject({ status, code });
}

describe('POST /api/v1/mcp-keys', () => {
  it('201 {apiKey, plaintextKey} — plaintext appears exactly once', async () => {
    const app = buildApp();
    const created = await request(app)
      .post('/api/v1/mcp-keys')
      .send({ name: 'CLI key', scopePreset: 'read_write', expiryPreset: '30_days' });
    expect(created.status).toBe(201);
    expect(created.body.plaintextKey).toMatch(/^lk_[0-9a-f]{8}\.[A-Za-z0-9_-]{32}$/);
    expect(mcpKeySchema.safeParse(created.body.apiKey).success).toBe(true);
    expect(created.body.apiKey).toMatchObject({
      name: 'CLI key',
      scopes: ['tasks:read', 'tasks:write'],
      status: 'active',
      lastUsedAt: null,
      revokedAt: null,
    });
    expect(created.body.apiKey.expiresAt).not.toBeNull();
    expect(created.body.apiKey).not.toHaveProperty('keyHash');

    // The plaintext never shows up again: not in the list response.
    const listed = await request(app).get('/api/v1/mcp-keys');
    expect(JSON.stringify(listed.body)).not.toContain(
      (created.body.plaintextKey as string).split('.')[1],
    );
  });

  it('400 problems for missing name / invalid presets', async () => {
    const app = buildApp();
    expectProblem(
      await request(app)
        .post('/api/v1/mcp-keys')
        .send({ scopePreset: 'read_write', expiryPreset: 'never' }),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app)
        .post('/api/v1/mcp-keys')
        .send({ name: 'x', scopePreset: 'admin', expiryPreset: 'never' }),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app)
        .post('/api/v1/mcp-keys')
        .send({ name: 'x', scopePreset: 'read_only', expiryPreset: '2_weeks' }),
      400,
      'validation_failed',
    );
  });
});

describe('GET /api/v1/mcp-keys', () => {
  it('returns {items} newest first with derived statuses (contract: {items:[McpKey]})', async () => {
    keys.seed({ userId: 'u1', name: 'older' });
    keys.seed({ userId: 'u1', name: 'newer', expiresAt: new Date(Date.now() - 1000) });
    keys.seed({ userId: 'someone-else', name: 'foreign' });
    const response = await request(buildApp()).get('/api/v1/mcp-keys');
    expect(response.status).toBe(200);
    expect(Object.keys(response.body)).toEqual(['items']);
    const items = response.body.items as { name: string; status: string }[];
    expect(items.map((key) => key.name)).toEqual(['newer', 'older']);
    expect(items.map((key) => key.status)).toEqual(['expired', 'active']);
  });

  it('validates ?limit (1-50, default 25)', async () => {
    for (let i = 0; i < 3; i += 1) keys.seed({ userId: 'u1' });
    const limited = await request(buildApp()).get('/api/v1/mcp-keys?limit=2');
    expect(limited.status).toBe(200);
    expect(limited.body.items).toHaveLength(2);
    expectProblem(
      await request(buildApp()).get('/api/v1/mcp-keys?limit=0'),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(buildApp()).get('/api/v1/mcp-keys?limit=51'),
      400,
      'validation_failed',
    );
  });
});

describe('POST /api/v1/mcp-keys/:id/revoke', () => {
  it('revokes idempotently and returns {apiKey}; 404 unknown/foreign', async () => {
    const mine = keys.seed({ userId: 'u1' });
    const foreign = keys.seed({ userId: 'someone-else' });
    const app = buildApp();

    const revoked = await request(app).post(`/api/v1/mcp-keys/${mine.id}/revoke`);
    expect(revoked.status).toBe(200);
    expect(revoked.body.apiKey).toMatchObject({ id: mine.id, status: 'revoked' });
    expect(revoked.body.apiKey.revokedAt).not.toBeNull();
    expect(keys.rows.get(mine.id)?.revocationReason).toBe('user_self_service');

    const again = await request(app).post(`/api/v1/mcp-keys/${mine.id}/revoke`);
    expect(again.status).toBe(200);
    expect(again.body.apiKey.status).toBe('revoked');

    expectProblem(await request(app).post('/api/v1/mcp-keys/ghost/revoke'), 404, 'not_found');
    expectProblem(
      await request(app).post(`/api/v1/mcp-keys/${foreign.id}/revoke`),
      404,
      'not_found',
    );
  });
});

describe('rate limiter placement', () => {
  it('the write limiter guards BOTH POST routes but not GET', async () => {
    const mine = keys.seed({ userId: 'u1' });
    const app = buildApp();

    await request(app).get('/api/v1/mcp-keys');
    expect(limiterHits).toBe(0);

    await request(app)
      .post('/api/v1/mcp-keys')
      .send({ name: 'k', scopePreset: 'read_only', expiryPreset: 'never' });
    expect(limiterHits).toBe(1);

    await request(app).post(`/api/v1/mcp-keys/${mine.id}/revoke`);
    expect(limiterHits).toBe(2);
  });
});

describe('auth guard', () => {
  it('401 problem when no current user is attached', async () => {
    expectProblem(await request(buildApp(null)).get('/api/v1/mcp-keys'), 401, 'unauthorized');
  });
});
