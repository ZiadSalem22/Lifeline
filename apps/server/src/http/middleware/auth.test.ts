import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { pino } from 'pino';
import type { JWTPayload } from 'jose';
import { GUEST_LOGIN_REQUIRED_MESSAGE } from '@lifeline/shared';
import { parseEnv, type Env } from '../../config/env.js';
import {
  InMemoryProfileRepository,
  InMemorySettingsRepository,
  InMemoryUserRepository,
} from '../../../test/helpers/in-memory.js';
import { requestId } from './request-id.js';
import { errorHandler } from './error-handler.js';
import { buildAuthMiddleware, requirePaid, requireRole, type TokenVerifier } from './auth.js';

interface Harness {
  app: express.Express;
  users: InMemoryUserRepository;
}

function buildHarness(env: Env, verifier?: TokenVerifier): Harness {
  const users = new InMemoryUserRepository();
  const profiles = new InMemoryProfileRepository();
  const settings = new InMemorySettingsRepository();
  const logger = pino({ enabled: false });

  const app = express();
  app.use(requestId());
  app.use(buildAuthMiddleware(env, { users, profiles, settings, logger, verifier }));
  app.get('/whoami', (req, res) => {
    res.json(req.currentUser);
  });
  app.get('/admin-only', requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/paid-only', requirePaid(), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler(logger));
  return { app, users };
}

const authEnv = (overrides: Record<string, string> = {}): Env =>
  parseEnv({
    NODE_ENV: 'test',
    AUTH0_DOMAIN: 'tenant.auth0.com',
    AUTH0_AUDIENCE: 'https://lifeline-api',
    ...overrides,
  });

const verifierFor = (payload: JWTPayload): TokenVerifier => ({
  verify: () => Promise.resolve(payload),
});

describe('buildAuthMiddleware — AUTH_DISABLED local mode', () => {
  it('attaches the local user and ensures its row exists', async () => {
    const { app, users } = buildHarness(authEnv({ AUTH_DISABLED: '1' }));
    const response = await request(app).get('/whoami');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 'guest-local', name: 'Local User', role: 'free' });
    expect(users.rows.has('guest-local')).toBe(true);
    expect(users.ensureCalls[0]).toMatchObject({ sub: 'guest-local', hasRoleClaims: false });
  });

  it('honors AUTH_LOCAL_USER_ID', async () => {
    const { app } = buildHarness(
      authEnv({ AUTH_DISABLED: '1', AUTH_LOCAL_USER_ID: 'compose-user' }),
    );
    const response = await request(app).get('/whoami');
    expect(response.body).toMatchObject({ id: 'compose-user' });
  });
});

describe('buildAuthMiddleware — bearer JWT path', () => {
  it('missing Authorization → 401 problem with the guest message', async () => {
    const { app } = buildHarness(authEnv(), verifierFor({ sub: 'auth0|u1' }));
    const response = await request(app).get('/whoami');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'unauthorized',
      detail: GUEST_LOGIN_REQUIRED_MESSAGE,
    });
  });

  it('invalid token → 401 problem', async () => {
    const { app } = buildHarness(authEnv(), {
      verify: () => Promise.reject(new Error('signature verification failed')),
    });
    const response = await request(app).get('/whoami').set('Authorization', 'Bearer bad-token');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      code: 'unauthorized',
      detail: 'Invalid or expired token.',
    });
  });

  it('verification timeout → 503 problem (auth service unavailable)', async () => {
    const { app } = buildHarness(authEnv({ AUTH_TIMEOUT_MS: '25' }), {
      verify: () => new Promise<never>(() => undefined), // hangs forever
    });
    const response = await request(app).get('/whoami').set('Authorization', 'Bearer slow-token');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      detail: 'Authentication service temporarily unavailable',
    });
  });

  it('valid token upserts the user from claims and attaches currentUser', async () => {
    const { app, users } = buildHarness(
      authEnv(),
      verifierFor({
        sub: 'auth0|u1',
        email: 'User@Example.COM',
        name: 'User One',
        picture: 'https://img.example/u1.png',
      }),
    );
    const response = await request(app).get('/whoami').set('Authorization', 'Bearer good');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 'auth0|u1',
      email: 'user@example.com',
      name: 'User One',
      role: 'free',
      roles: ['free'],
      subscriptionStatus: 'none',
      profile: null,
      settings: null,
    });
    expect(users.rows.get('auth0|u1')?.email).toBe('user@example.com');
  });

  it('merges role claims from both namespaces and flags hasRoleClaims', async () => {
    const { app, users } = buildHarness(
      authEnv(),
      verifierFor({
        sub: 'auth0|u2',
        'https://lifeline-api/roles': ['paid'],
        'https://lifeline.app/roles': ['admin', 'paid'],
      }),
    );
    const response = await request(app).get('/whoami').set('Authorization', 'Bearer good');
    expect(response.body).toMatchObject({ role: 'admin', roles: ['paid', 'admin'] });
    expect(users.ensureCalls[0]).toMatchObject({
      hasRoleClaims: true,
      roles: ['paid', 'admin'],
    });
  });

  it('does NOT clobber a DB-promoted role when the token carries no role claims', async () => {
    const { app, users } = buildHarness(authEnv(), verifierFor({ sub: 'auth0|admin' }));
    users.seed({ id: 'auth0|admin', role: 'admin' });
    const response = await request(app).get('/whoami').set('Authorization', 'Bearer good');
    expect(response.body).toMatchObject({ role: 'admin', roles: ['admin'] });
    expect(users.rows.get('auth0|admin')?.role).toBe('admin');
    expect(users.ensureCalls[0]?.hasRoleClaims).toBe(false);
  });

  it('an empty roles claim does not count as carrying role claims', async () => {
    const { app, users } = buildHarness(
      authEnv(),
      verifierFor({ sub: 'auth0|admin', 'https://lifeline-api/roles': [] }),
    );
    users.seed({ id: 'auth0|admin', role: 'admin' });
    await request(app).get('/whoami').set('Authorization', 'Bearer good');
    expect(users.rows.get('auth0|admin')?.role).toBe('admin');
  });

  it('role claims DO win when present (Auth0 stays authoritative)', async () => {
    const { app, users } = buildHarness(
      authEnv(),
      verifierFor({ sub: 'auth0|u3', 'https://lifeline-api/roles': ['free'] }),
    );
    users.seed({ id: 'auth0|u3', role: 'admin' });
    await request(app).get('/whoami').set('Authorization', 'Bearer good');
    expect(users.rows.get('auth0|u3')?.role).toBe('free');
  });

  it('token without sub → 401', async () => {
    const { app } = buildHarness(authEnv(), verifierFor({ email: 'nosub@example.com' }));
    const response = await request(app).get('/whoami').set('Authorization', 'Bearer good');
    expect(response.status).toBe(401);
  });
});

describe('role guards', () => {
  it('requireRole passes DB-promoted admins and rejects others', async () => {
    const { app, users } = buildHarness(authEnv(), verifierFor({ sub: 'auth0|admin' }));
    users.seed({ id: 'auth0|admin', role: 'admin' });
    expect((await request(app).get('/admin-only').set('Authorization', 'Bearer t')).status).toBe(
      200,
    );

    const other = buildHarness(authEnv(), verifierFor({ sub: 'auth0|pleb' }));
    const denied = await request(other.app).get('/admin-only').set('Authorization', 'Bearer t');
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ code: 'forbidden' });
  });

  it('requirePaid passes paid and admin, rejects free', async () => {
    const paid = buildHarness(
      authEnv(),
      verifierFor({ sub: 'auth0|p', 'https://lifeline-api/roles': ['paid'] }),
    );
    expect(
      (await request(paid.app).get('/paid-only').set('Authorization', 'Bearer t')).status,
    ).toBe(200);

    const free = buildHarness(authEnv(), verifierFor({ sub: 'auth0|f' }));
    expect(
      (await request(free.app).get('/paid-only').set('Authorization', 'Bearer t')).status,
    ).toBe(403);
  });
});
