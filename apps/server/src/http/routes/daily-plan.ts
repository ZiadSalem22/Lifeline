import { Router } from 'express';
import { z } from 'zod';
import {
  dailyPlanDaySchema,
  dailyPlanRangeQuerySchema,
  dailyPlanRangeResponseSchema,
  dailyPlanSettingsSchema,
  dateOnlySchema,
  defaultDailyPlanSettings,
  planMetricsQuerySchema,
  planMetricsResponseSchema,
  problemSchema,
  putDailyPlanDaySchema,
  putDailyPlanSettingsSchema,
  type DailyPlanRangeQuery,
  type PlanMetricsQuery,
  type PutDailyPlanDay,
  type PutDailyPlanSettings,
} from '@lifeline/shared';
import { DomainValidationError, UnauthorizedError } from '../../domain/errors.js';
import type { DailyPlanRepository } from '../../application/ports.js';
import type { GetPlanMetrics } from '../../application/daily-plan/get-plan-metrics.js';
import { getValidated, validate } from '../middleware/validate.js';
import type { OpenApiRegistry } from '../openapi/registry.js';

export interface DailyPlanRouterDeps {
  dailyPlans: DailyPlanRepository;
  getPlanMetrics: GetPlanMetrics;
  registry: OpenApiRegistry;
}

const dateParamsSchema = z.object({ date: dateOnlySchema });
type DateParams = z.infer<typeof dateParamsSchema>;

/** Widest window one GET may span (a week view fetches 7 days; give slack). */
const MAX_RANGE_DAYS = 62;

const DAY_MS = 24 * 60 * 60 * 1000;
function rangeDays(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1;
}

/**
 * Daily Plan slice (mounted at /daily-plan, behind the /api/v1 auth gate):
 * - GET  /?start&end        → plan rows in the range (missing days are absent)
 * - PUT  /:date             → upsert one day's blob (zod-normalized)
 * - GET  /settings          → the user's plan settings (defaults when unset)
 * - PUT  /settings          → upsert the settings blob
 * NOTE: /settings routes are registered BEFORE /:date so the literal segment
 * is never parsed as a date.
 */
export function buildDailyPlanRouter(deps: DailyPlanRouterDeps): Router {
  const router = Router();

  deps.registry.register({
    method: 'get',
    path: '/api/v1/daily-plan',
    summary: 'Daily plan rows for a date range (≤ 62 days); days without a row are omitted',
    tag: 'daily-plan',
    responses: {
      '200': { description: 'Plan rows', schema: dailyPlanRangeResponseSchema },
      '400': { description: 'Invalid or too-wide range', schema: problemSchema },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.get('/', validate(dailyPlanRangeQuerySchema, 'query'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { start, end } = getValidated<DailyPlanRangeQuery>(req, 'query');
    if (rangeDays(start, end) > MAX_RANGE_DAYS) {
      throw new DomainValidationError(`Range too wide — at most ${MAX_RANGE_DAYS} days`);
    }
    const rows = await deps.dailyPlans.getRange(user.id, start, end);
    res.json({ items: rows.map((row) => ({ date: row.planDate, data: row.data })) });
  });

  deps.registry.register({
    method: 'get',
    path: '/api/v1/daily-plan/metrics',
    summary: 'Compact per-day life metrics for a range (≤ 400 days) — the Statistics feed',
    tag: 'daily-plan',
    responses: {
      '200': { description: 'Per-day metrics', schema: planMetricsResponseSchema },
      '400': { description: 'Invalid or too-wide range', schema: problemSchema },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.get('/metrics', validate(planMetricsQuerySchema, 'query'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { start, end } = getValidated<PlanMetricsQuery>(req, 'query');
    res.json(await deps.getPlanMetrics.execute(user.id, { start, end }));
  });

  deps.registry.register({
    method: 'get',
    path: '/api/v1/daily-plan/settings',
    summary: "The user's daily-plan settings (defaults when never saved)",
    tag: 'daily-plan',
    responses: {
      '200': { description: 'Plan settings', schema: dailyPlanSettingsSchema },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.get('/settings', async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const stored = await deps.dailyPlans.getSettings(user.id);
    // Stored blobs pass through the schema so old rows self-heal to the
    // current shape; a missing row yields the seeded defaults.
    const parsed =
      stored === null ? defaultDailyPlanSettings() : dailyPlanSettingsSchema.parse(stored);
    res.json(parsed);
  });

  deps.registry.register({
    method: 'put',
    path: '/api/v1/daily-plan/settings',
    summary: 'Replace the daily-plan settings blob',
    tag: 'daily-plan',
    request: { body: putDailyPlanSettingsSchema },
    responses: {
      '200': { description: 'Stored settings', schema: dailyPlanSettingsSchema },
      '400': { description: 'Validation failed', schema: problemSchema },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.put('/settings', validate(putDailyPlanSettingsSchema), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { data } = getValidated<PutDailyPlanSettings>(req);
    const stored = await deps.dailyPlans.upsertSettings(user.id, data);
    res.json(stored);
  });

  deps.registry.register({
    method: 'put',
    path: '/api/v1/daily-plan/:date',
    summary: "Replace one day's plan blob (upsert)",
    tag: 'daily-plan',
    request: { body: putDailyPlanDaySchema },
    responses: {
      '200': { description: 'Stored day', schema: dailyPlanDaySchema },
      '400': { description: 'Validation failed', schema: problemSchema },
      '401': { description: 'Not authenticated', schema: problemSchema },
    },
  });
  router.put(
    '/:date',
    validate(dateParamsSchema, 'params'),
    validate(putDailyPlanDaySchema),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { date } = getValidated<DateParams>(req, 'params');
      const { data } = getValidated<PutDailyPlanDay>(req);
      const row = await deps.dailyPlans.upsertDay(user.id, date, data);
      res.json({ date: row.planDate, data: row.data });
    },
  );

  return router;
}

function requireCurrentUser<T extends { id: string }>(user: T | null | undefined): T {
  if (!user?.id) throw new UnauthorizedError();
  return user;
}
