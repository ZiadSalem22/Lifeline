import {
  MAX_PLAN_METRICS_DAYS,
  dailyPlanDataSchema,
  extractDayMetrics,
  type PlanMetricsResponse,
} from '@lifeline/shared';
import { DomainValidationError } from '../../domain/errors.js';
import type { DailyPlanRepository } from '../ports.js';

export interface GetPlanMetricsDeps {
  dailyPlans: Pick<DailyPlanRepository, 'getRange'>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const rangeDays = (start: string, end: string): number =>
  Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS) + 1;

/**
 * Compact per-day life metrics over a date range — the long-horizon feed for
 * Statistics. Aggregation happens in JS over the stored jsonb rows (the
 * GetStats precedent); the extractor itself is shared with the guest client
 * so both modes agree by construction.
 */
export class GetPlanMetrics {
  constructor(private readonly deps: GetPlanMetricsDeps) {}

  async execute(
    userId: string,
    query: { start: string; end: string },
  ): Promise<PlanMetricsResponse> {
    if (rangeDays(query.start, query.end) > MAX_PLAN_METRICS_DAYS) {
      throw new DomainValidationError(`Range too wide — at most ${MAX_PLAN_METRICS_DAYS} days`);
    }
    const rows = await this.deps.dailyPlans.getRange(userId, query.start, query.end);
    return {
      items: rows.flatMap((row) => {
        // Self-heal old blobs like the settings GET; a row that no longer
        // parses is skipped — one corrupt historical day must never 500 a
        // whole year of statistics.
        const parsed = dailyPlanDataSchema.safeParse(row.data);
        return parsed.success ? [extractDayMetrics(row.planDate, parsed.data)] : [];
      }),
    };
  }
}
