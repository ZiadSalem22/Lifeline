import express, { type Express, type Router } from 'express';
import { pino } from 'pino';
import { errorHandler, notFoundHandler } from '../../src/http/middleware/error-handler.js';
import type { CurrentUser } from '../../src/application/ports.js';
import '../../src/http/types.js';

/**
 * Minimal express harness for feature-router supertest suites: JSON body
 * parsing + a fake auth stub attaching `req.currentUser` + the router under
 * test + the REAL notFound/error handlers (so problem+json shapes are
 * asserted end-to-end).
 */

export function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 'user-1',
    email: 'user-1@example.com',
    name: 'Test User',
    picture: null,
    role: 'free',
    roles: ['free'],
    subscriptionStatus: 'none',
    profile: null,
    settings: null,
    ...overrides,
  };
}

export function makeApp(path: string, router: Router, user: CurrentUser | null): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.currentUser = user;
    next();
  });
  app.use(path, router);
  app.use(notFoundHandler());
  app.use(errorHandler(pino({ enabled: false })));
  return app;
}
