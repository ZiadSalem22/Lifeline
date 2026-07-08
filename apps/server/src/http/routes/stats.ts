import { Router } from 'express';
import {
  problemSchema,
  statsQuerySchema,
  statsResponseSchema,
  type StatsQuery,
} from '@lifeline/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { GetStats } from '../../application/stats/get-stats.js';
import { getValidated, validate } from '../middleware/validate.js';
import type { OpenApiRegistry } from '../openapi/registry.js';

export interface StatsRouterDeps {
  getStats: GetStats;
  registry: OpenApiRegistry;
}

/** Stats slice: GET /api/v1/stats (mounted at /stats inside /api/v1). */
export function buildStatsRouter(deps: StatsRouterDeps): Router {
  const router = Router();

  deps.registry.register({
    method: 'get',
    path: '/api/v1/stats',
    summary: 'Aggregated todo statistics (period=day|week|month|year, or startDate+endDate range)',
    tag: 'stats',
    request: { query: statsQuerySchema },
    responses: {
      '200': { description: 'Aggregated statistics', schema: statsResponseSchema },
      '400': { description: 'Validation failed', schema: problemSchema },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.get('/', validate(statsQuerySchema, 'query'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const query = getValidated<StatsQuery>(req, 'query');
    const stats = await deps.getStats.execute(user.id, query);
    res.json(stats);
  });

  return router;
}

function requireCurrentUser<T extends { id: string }>(user: T | null | undefined): T {
  if (!user?.id) throw new UnauthorizedError();
  return user;
}
