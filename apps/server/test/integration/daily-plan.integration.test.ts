import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type pg from 'pg';
import { createDb, createPool, type Db } from '../../src/infrastructure/db/client.js';
import { users } from '../../src/infrastructure/db/schema.js';
import { DrizzleDailyPlanRepository } from '../../src/infrastructure/repositories/daily-plan-repository.js';

/** Real-PG jsonb upsert round-trip. Skipped without TEST_DATABASE_URL. */
const DATABASE_URL = process.env.TEST_DATABASE_URL;

describe.skipIf(DATABASE_URL === undefined)('DrizzleDailyPlanRepository (real PG)', () => {
  let pool: pg.Pool;
  let db: Db;
  let repo: DrizzleDailyPlanRepository;
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    pool = createPool(DATABASE_URL as string);
    db = createDb(pool);
    repo = new DrizzleDailyPlanRepository(db);
    userId = `it-plan-${randomUUID()}`;
    otherUserId = `it-plan-other-${randomUUID()}`;
    await db.insert(users).values([
      { id: userId, auth0Sub: userId },
      { id: otherUserId, auth0Sub: otherUserId },
    ]);
  });

  afterAll(async () => {
    // FK cascade wipes daily_plans + daily_plan_settings rows.
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(users).where(eq(users.id, otherUserId));
    await pool.end();
  });

  it('upsertDay inserts then overwrites in place; getRange is user-scoped and ordered', async () => {
    await repo.upsertDay(userId, '2026-07-09', { water: 3 });
    await repo.upsertDay(userId, '2026-07-08', { water: 8 });
    await repo.upsertDay(userId, '2026-07-09', { water: 5, habits: { fajr: true } });
    await repo.upsertDay(otherUserId, '2026-07-09', { water: 99 });

    const rows = await repo.getRange(userId, '2026-07-06', '2026-07-12');
    expect(rows.map((r) => r.planDate)).toEqual(['2026-07-08', '2026-07-09']);
    expect(rows[1]?.data).toEqual({ water: 5, habits: { fajr: true } });

    const outside = await repo.getRange(userId, '2026-08-01', '2026-08-07');
    expect(outside).toHaveLength(0);
  });

  it('settings upsert round-trips and stays per-user', async () => {
    expect(await repo.getSettings(userId)).toBeNull();
    await repo.upsertSettings(userId, { density: 'roomy' });
    await repo.upsertSettings(userId, { density: 'compact', gymTaskNumber: 613 });
    expect(await repo.getSettings(userId)).toEqual({ density: 'compact', gymTaskNumber: 613 });
    expect(await repo.getSettings(otherUserId)).toBeNull();
  });
});
