import express, { Router, type Express, type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Container } from '../container.js';
import { sendProblem } from './problem.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { httpLogger } from './middleware/http-logger.js';
import { createHealthRouter } from './routes/health.js';
import { createInfoRouter } from './routes/info.js';
import { createDocsRouter } from './routes/docs.js';
import { createIdentityRouter } from './routes/identity.js';
import { createSpaHandler, isApiPath } from './spa.js';
import './types.js';

/**
 * CORS gate: allowlist function over dev origins + env CSV. Requests without
 * an Origin (curl, server-to-server, health probes) pass. Blocked origins get
 * a 403 problem+json response — NOT a thrown error.
 */
function corsGate(port: number, extraOrigins: readonly string[]): RequestHandler {
  const allowed = new Set<string>([
    'http://localhost:5173',
    'https://localhost:5173',
    'http://127.0.0.1:5173',
    'https://127.0.0.1:5173',
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    ...extraOrigins,
  ]);
  const corsMiddleware = cors({ origin: true, credentials: true });
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin !== undefined && !allowed.has(origin)) {
      sendProblem(res, {
        status: 403,
        code: 'forbidden',
        detail: 'Origin not allowed by CORS policy.',
      });
      return;
    }
    corsMiddleware(req, res, next);
  };
}

function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  return Number.isInteger(numeric) && String(numeric) === value ? numeric : value;
}

/**
 * Compose the Express app from the DI container. Order matters:
 * request-id → logging → security headers → CORS → body parsing →
 * public routes (/health, /api/v1/info, /api/docs) → authenticated /api/v1 →
 * 404 → terminal error handler.
 */
export function createApp(container: Container): Express {
  const { env, logger } = container;
  const app = express();

  app.disable('x-powered-by');
  if (env.TRUST_PROXY !== null) {
    app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));
  }

  app.use(requestId());
  app.use(httpLogger(logger));
  // CSP covers BOTH the API surface and the single-container web SPA. The SPA
  // (React + @auth0/auth0-react) talks to Auth0 directly from the browser: the
  // OAuth authorization-code exchange and silent token refresh are `fetch`
  // calls to https://<tenant>.auth0.com. Without an explicit `connect-src`
  // those fall back to `default-src 'self'` and the browser BLOCKS them, so
  // login silently dies right after the redirect — the code comes back but is
  // never exchanged, the transaction is discarded, and the app drops to guest.
  // We also allow Google Fonts (stylesheet + font files) and https avatar
  // images so the UI renders as designed. `/api/docs` still needs inline
  // script/style. Everything else stays pinned to 'self'.
  const auth0Origin = env.AUTH0_DOMAIN ? `https://${env.AUTH0_DOMAIN}` : null;
  const auth0Sources = auth0Origin ? [auth0Origin] : [];
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", "'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'https:'],
          'connect-src': ["'self'", ...auth0Sources],
          'frame-src': ["'self'", ...auth0Sources],
        },
      },
    }),
  );
  app.use(corsGate(env.PORT, env.CORS_ORIGINS));
  app.use(express.json({ limit: '1mb' }));

  // Public surface (registered BEFORE the auth gate).
  app.use('/health', createHealthRouter({ pool: container.pool, authState: container.auth.state }));
  app.use('/api/v1/info', createInfoRouter(container.version));
  app.use(
    '/api/docs',
    createDocsRouter(container.registry, {
      title: 'Lifeline API',
      version: container.version,
    }),
  );

  // Embedded MCP module: POST /mcp (+ OAuth metadata well-knowns). Public
  // route with its OWN dual auth — mounted before the /api/v1 gate.
  app.use(container.mcpRouter);

  // Authenticated /api/v1 surface.
  const v1 = Router();
  v1.use(container.auth.middleware);
  v1.use('/todos', container.limiters.todos); // 60/min gate ahead of the todos feature router
  v1.use(
    createIdentityRouter({
      getMe: container.useCases.getMe,
      updateProfile: container.useCases.updateProfile,
      updateSettings: container.useCases.updateSettings,
      registry: container.registry,
    }),
  );
  for (const feature of container.featureRouters) {
    v1.use(feature.path, feature.router);
  }
  app.use('/api/v1', v1);

  // Production single-container serving: static web SPA with client-route
  // fallback. Gated so unmatched API paths still get a JSON 404, not index.html.
  if (env.WEB_DIST_DIR !== null) {
    const spa = createSpaHandler(env.WEB_DIST_DIR);
    app.use((req, res, next) => {
      if (isApiPath(req.path)) {
        next();
        return;
      }
      spa(req, res, next);
    });
  }

  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return app;
}
