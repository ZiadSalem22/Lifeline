import { Router } from 'express';
import type pg from 'pg';
import type { AuthState } from '../middleware/auth.js';

export interface HealthDeps {
  pool: pg.Pool;
  authState: AuthState;
}

/**
 * Liveness + readiness (mounted at /health, BEFORE auth — public by design).
 * Readiness = DB ping AND auth readiness (JWKS warmed or bypassed).
 */
export function createHealthRouter(deps: HealthDeps): Router {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/ready', async (_req, res) => {
    let dbOk = true;
    try {
      await deps.pool.query('SELECT 1');
    } catch {
      dbOk = false;
    }
    const auth = deps.authState.getReadiness();
    const ready = dbOk && auth.ready;
    res.status(ready ? 200 : 503).json({ ready, db: dbOk ? 'ok' : 'error', auth });
  });

  return router;
}
