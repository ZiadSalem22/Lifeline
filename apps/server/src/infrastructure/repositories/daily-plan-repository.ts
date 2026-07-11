import { and, asc, between, eq } from 'drizzle-orm';
import type { DailyPlanDayRecord, DailyPlanRepository } from '../../application/ports.js';
import type { Db } from '../db/client.js';
import { dailyPlanSettings, dailyPlans } from '../db/schema.js';

/**
 * Daily Plan storage — thin jsonb-blob persistence. Validation/normalization
 * happens at the route via the shared zod schemas; rows here are opaque
 * objects keyed by (user_id, plan_date) / user_id.
 */
export class DrizzleDailyPlanRepository implements DailyPlanRepository {
  constructor(private readonly db: Db) {}

  async getRange(userId: string, start: string, end: string): Promise<DailyPlanDayRecord[]> {
    const rows = await this.db
      .select({ planDate: dailyPlans.planDate, data: dailyPlans.data })
      .from(dailyPlans)
      .where(and(eq(dailyPlans.userId, userId), between(dailyPlans.planDate, start, end)))
      .orderBy(asc(dailyPlans.planDate));
    return rows;
  }

  async upsertDay(
    userId: string,
    planDate: string,
    data: Record<string, unknown>,
  ): Promise<DailyPlanDayRecord> {
    const rows = await this.db
      .insert(dailyPlans)
      .values({ userId, planDate, data })
      .onConflictDoUpdate({
        target: [dailyPlans.userId, dailyPlans.planDate],
        set: { data, updatedAt: new Date() },
      })
      .returning({ planDate: dailyPlans.planDate, data: dailyPlans.data });
    const row = rows[0];
    if (!row) throw new Error('Daily plan upsert returned no row');
    return row;
  }

  async getSettings(userId: string): Promise<Record<string, unknown> | null> {
    const rows = await this.db
      .select({ data: dailyPlanSettings.data })
      .from(dailyPlanSettings)
      .where(eq(dailyPlanSettings.userId, userId))
      .limit(1);
    return rows[0]?.data ?? null;
  }

  async upsertSettings(
    userId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const rows = await this.db
      .insert(dailyPlanSettings)
      .values({ userId, data })
      .onConflictDoUpdate({
        target: dailyPlanSettings.userId,
        set: { data, updatedAt: new Date() },
      })
      .returning({ data: dailyPlanSettings.data });
    const row = rows[0];
    if (!row) throw new Error('Daily plan settings upsert returned no row');
    return row.data;
  }
}
