import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import type pg from 'pg';
import { problemSchema } from '@lifeline/shared';
import { parseEnv } from '../config/env.js';
import { buildContainer } from '../container.js';
import { createApp } from './app.js';

/**
 * Composition smoke tests — public surface only (no database: the pool is a
 * stub that always fails, which is exactly what /health/ready must survive).
 */

const failingPool = {
  query: () => Promise.reject(new Error('no database in unit tests')),
  end: () => Promise.resolve(),
} as unknown as pg.Pool;

function buildTestApp() {
  const env = parseEnv({ NODE_ENV: 'test', AUTH_DISABLED: '1' });
  const container = buildContainer(env, pino({ enabled: false }), { pool: failingPool });
  return createApp(container);
}

const app = buildTestApp();

describe('createApp public surface', () => {
  it('GET /health/live → 200 ok', async () => {
    const response = await request(app).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready → 503 when the database is down', async () => {
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      ready: false,
      db: 'error',
      auth: { ready: true, bypassed: true },
    });
  });

  it('GET /api/v1/info is public and advertises guest mode', async () => {
    const response = await request(app).get('/api/v1/info');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: 'Lifeline API', guestMode: 'local-only' });
    expect(typeof response.body.version).toBe('string');
    expect(typeof response.body.time).toBe('string');
  });

  it('GET /api/docs/openapi.json exposes the registered identity routes', async () => {
    const response = await request(app).get('/api/docs/openapi.json');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ openapi: '3.1.0' });
    const paths = Object.keys(response.body.paths as Record<string, unknown>);
    expect(paths).toEqual(
      expect.arrayContaining(['/api/v1/me', '/api/v1/me/profile', '/api/v1/me/settings']),
    );
  });

  it('GET /api/docs/openapi.json exposes every feature slice', async () => {
    const response = await request(app).get('/api/docs/openapi.json');
    const paths = Object.keys(response.body.paths as Record<string, unknown>);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/todos',
        '/api/v1/todos/similar',
        '/api/v1/todos/by-number/{taskNumber}',
        '/api/v1/todos/batch',
        '/api/v1/todos/{id}',
        '/api/v1/todos/{id}/subtasks/{subtaskId}',
        '/api/v1/tags',
        '/api/v1/tags/{id}',
        '/api/v1/stats',
        '/api/v1/export',
        '/api/v1/import',
        '/api/v1/account/reset',
        '/api/v1/mcp-keys',
        '/api/v1/mcp-keys/{id}/revoke',
      ]),
    );
  });

  it('GET /api/docs serves a self-contained HTML page (no external CDN)', async () => {
    const response = await request(app).get('/api/docs');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).not.toMatch(/https?:\/\/cdn\./i);
    expect(response.text).toContain('/api/docs/openapi.json');
  });

  it('unknown routes → 404 problem+json', async () => {
    // Outside /api/v1 so the (DB-backed) auth gate is not involved.
    const response = await request(app).get('/definitely-not-a-route-xyz');
    const parsed = problemSchema.safeParse(response.body);
    expect(response.status).toBe(404);
    expect(parsed.success).toBe(true);
  });

  it('blocks disallowed origins with a 403 problem (not a thrown error)', async () => {
    const response = await request(app)
      .get('/api/v1/info')
      .set('Origin', 'https://evil.example.com');
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'forbidden' });
  });

  it('allows the dev origin with credentials', async () => {
    const response = await request(app).get('/api/v1/info').set('Origin', 'http://localhost:5173');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('sets security headers via helmet', async () => {
    const response = await request(app).get('/api/v1/info');
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});

describe('createApp production SPA serving (WEB_DIST_DIR)', () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeline-web-'));
  fs.writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>Lifeline SPA</title>');
  fs.writeFileSync(path.join(distDir, 'sw.js'), '// worker');
  fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(distDir, 'assets', 'app.js'), 'console.log("bundle");');

  const env = parseEnv({ NODE_ENV: 'test', AUTH_DISABLED: '1', WEB_DIST_DIR: distDir });
  const spaApp = createApp(buildContainer(env, pino({ enabled: false }), { pool: failingPool }));

  afterAll(() => fs.rmSync(distDir, { recursive: true, force: true }));

  it('serves index.html at the root, uncached', async () => {
    const response = await request(spaApp).get('/');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Lifeline SPA');
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('serves fingerprinted static assets as immutable', async () => {
    const response = await request(spaApp).get('/assets/app.js');
    expect(response.status).toBe(200);
    expect(response.text).toContain('bundle');
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('never long-caches non-fingerprinted root files (sw.js pins old shells)', async () => {
    const response = await request(spaApp).get('/sw.js');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-cache');
  });

  it('falls back to index.html for client-side routes', async () => {
    const response = await request(spaApp).get('/statistics');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Lifeline SPA');
  });

  it('still returns JSON 404 for unknown API routes (SPA does not shadow them)', async () => {
    // An /api path NOT behind the DB-backed /api/v1 auth gate, so the SPA-gate
    // behavior is isolated: it must fall through to the JSON 404 handler.
    const response = await request(spaApp).get('/api/unknown-endpoint');
    expect(response.status).toBe(404);
    expect(problemSchema.safeParse(response.body).success).toBe(true);
    expect(response.text).not.toContain('Lifeline SPA');
  });
});

describe('createApp CSP lets the SPA reach Auth0', () => {
  const env = parseEnv({
    NODE_ENV: 'test',
    AUTH_DISABLED: '1',
    AUTH0_DOMAIN: 'https://tenant.us.auth0.com/',
    AUTH0_AUDIENCE: 'https://lifeline-api',
  });
  const app = createApp(buildContainer(env, pino({ enabled: false }), { pool: failingPool }));

  it('emits a connect-src + frame-src that include the Auth0 tenant', async () => {
    // Regression (prod login was dead): with no explicit connect-src the policy
    // fell back to default-src 'self', so the browser BLOCKED the OAuth token
    // exchange fetch to https://<tenant>.auth0.com/oauth/token. Login returned
    // from Auth0 with a code that was never exchanged → the app stayed guest.
    const response = await request(app).get('/api/v1/info');
    const csp = response.headers['content-security-policy'] ?? '';
    expect(csp).toMatch(/connect-src[^;]*'self'/);
    expect(csp).toMatch(/connect-src[^;]*https:\/\/tenant\.us\.auth0\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/tenant\.us\.auth0\.com/);
  });

  it('allows Google Fonts and https avatar images so the UI renders as designed', async () => {
    const response = await request(app).get('/api/v1/info');
    const csp = response.headers['content-security-policy'] ?? '';
    expect(csp).toMatch(/style-src[^;]*https:\/\/fonts\.googleapis\.com/);
    expect(csp).toMatch(/font-src[^;]*https:\/\/fonts\.gstatic\.com/);
    expect(csp).toMatch(/img-src[^;]*https:/);
  });

  it('allows the Aladhan prayer-times API in connect-src (browser-direct fetch)', async () => {
    const response = await request(app).get('/api/v1/info');
    const csp = response.headers['content-security-policy'] ?? '';
    expect(csp).toMatch(/connect-src[^;]*https:\/\/api\.aladhan\.com/);
  });
});
