import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROBLEM_CONTENT_TYPE, emptyDailyPlanData, problemSchema } from '@lifeline/shared';
import { OpenApiRegistry } from '../../src/http/openapi/registry.js';
import { buildDailyPlanRouter } from '../../src/http/routes/daily-plan.js';
import { GetPlanMetrics } from '../../src/application/daily-plan/get-plan-metrics.js';
import type { DailyPlanDayRecord, DailyPlanRepository } from '../../src/application/ports.js';
import { makeApp, makeUser } from '../helpers/router-app.js';

/** In-memory DailyPlanRepository keyed per user (asserts user scoping). */
class InMemoryDailyPlanRepository implements DailyPlanRepository {
  days = new Map<string, Record<string, unknown>>(); // `${userId}|${date}`
  settings = new Map<string, Record<string, unknown>>();

  getAllDays(userId: string): Promise<DailyPlanDayRecord[]> {
    return this.getRange(userId, '0000-01-01', '9999-12-31');
  }

  getRange(userId: string, start: string, end: string): Promise<DailyPlanDayRecord[]> {
    const rows: DailyPlanDayRecord[] = [];
    for (const [key, data] of this.days) {
      const [owner, date] = key.split('|') as [string, string];
      if (owner === userId && date >= start && date <= end) rows.push({ planDate: date, data });
    }
    rows.sort((a, b) => a.planDate.localeCompare(b.planDate));
    return Promise.resolve(rows);
  }

  upsertDay(
    userId: string,
    planDate: string,
    data: Record<string, unknown>,
  ): Promise<DailyPlanDayRecord> {
    this.days.set(`${userId}|${planDate}`, data);
    return Promise.resolve({ planDate, data });
  }

  getSettings(userId: string): Promise<Record<string, unknown> | null> {
    return Promise.resolve(this.settings.get(userId) ?? null);
  }

  upsertSettings(userId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.settings.set(userId, data);
    return Promise.resolve(data);
  }
}

let repo: InMemoryDailyPlanRepository;
let app: ReturnType<typeof makeApp>;

beforeEach(() => {
  repo = new InMemoryDailyPlanRepository();
  app = makeApp(
    '/api/v1/daily-plan',
    buildDailyPlanRouter({
      dailyPlans: repo,
      getPlanMetrics: new GetPlanMetrics({ dailyPlans: repo }),
      registry: new OpenApiRegistry(),
    }),
    makeUser({ id: 'u1' }),
  );
});

function expectProblem(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  expect(problemSchema.safeParse(response.body).success).toBe(true);
  expect(response.body).toMatchObject({ status, code });
}

describe('GET /api/v1/daily-plan/metrics', () => {
  it('maps stored blobs through the shared extractor (user-scoped)', async () => {
    await request(app)
      .put('/api/v1/daily-plan/2026-07-09')
      .send({
        data: {
          water: 5,
          habits: { fajr: true, gym: 'skip' },
          priorities: [{ t: 'Ship', done: true }],
          meals: { breakfast: [{ n: 'Eggs', cal: 156, p: 12, c: 1, f: 10 }] },
          moodAm: 4,
        },
      });
    // Another user's row must not leak in.
    repo.days.set('u2|2026-07-10', { water: 9 });

    const res = await request(app).get(
      '/api/v1/daily-plan/metrics?start=2026-07-01&end=2026-07-31',
    );
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      date: '2026-07-09',
      water: 5,
      kcal: 156,
      protein: 12,
      mealCount: 1,
      prioritiesDone: 1,
      prioritiesTotal: 1,
      moodAm: 4,
      moodPm: null,
      habits: { fajr: true, gym: 'skip' },
    });
  });

  it('rejects a range wider than 400 days and a reversed range', async () => {
    expectProblem(
      await request(app).get('/api/v1/daily-plan/metrics?start=2025-01-01&end=2026-06-01'),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app).get('/api/v1/daily-plan/metrics?start=2026-07-10&end=2026-07-01'),
      400,
      'validation_failed',
    );
  });

  it('a corrupt stored row is skipped, not a 500', async () => {
    repo.days.set('u1|2026-07-08', { water: 'not-a-number' });
    await request(app)
      .put('/api/v1/daily-plan/2026-07-09')
      .send({ data: { water: 2 } });
    const res = await request(app).get(
      '/api/v1/daily-plan/metrics?start=2026-07-01&end=2026-07-31',
    );
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].date).toBe('2026-07-09');
  });
});

describe('PUT /api/v1/daily-plan/:date → GET range roundtrip', () => {
  it('upserts a normalized day blob and returns it in a range query', async () => {
    const data = { ...emptyDailyPlanData(), water: 5, habits: { fajr: true } };
    const put = await request(app).put('/api/v1/daily-plan/2026-07-09').send({ data });
    expect(put.status).toBe(200);
    expect(put.body.date).toBe('2026-07-09');
    expect(put.body.data.water).toBe(5);

    const get = await request(app).get('/api/v1/daily-plan?start=2026-07-06&end=2026-07-12');
    expect(get.status).toBe(200);
    expect(get.body.items).toHaveLength(1);
    expect(get.body.items[0]).toMatchObject({ date: '2026-07-09' });
    expect(get.body.items[0].data.habits).toEqual({ fajr: true });
  });

  it('a sparse partial body is normalized to a complete blob by the schema', async () => {
    const put = await request(app)
      .put('/api/v1/daily-plan/2026-07-09')
      .send({ data: { water: 3 } });
    expect(put.status).toBe(200);
    expect(put.body.data.priorities).toHaveLength(3);
    expect(put.body.data.nonnegs).toEqual([false, false, false, false, false]);
    expect(put.body.data.meals).toEqual({ breakfast: [], lunch: [], dinner: [], snacks: [] });
  });

  it('rejects bad dates, invalid blobs, and reversed/too-wide ranges', async () => {
    expectProblem(
      await request(app).put('/api/v1/daily-plan/not-a-date').send({ data: {} }),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app)
        .put('/api/v1/daily-plan/2026-07-09')
        .send({ data: { water: 99 } }),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app).get('/api/v1/daily-plan?start=2026-07-12&end=2026-07-06'),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app).get('/api/v1/daily-plan?start=2026-01-01&end=2026-12-31'),
      400,
      'validation_failed',
    );
  });

  it('range queries are scoped to the current user', async () => {
    await repo.upsertDay('someone-else', '2026-07-09', { water: 8 });
    const get = await request(app).get('/api/v1/daily-plan?start=2026-07-09&end=2026-07-09');
    expect(get.status).toBe(200);
    expect(get.body.items).toHaveLength(0);
  });
});

describe('GET/PUT /api/v1/daily-plan/settings', () => {
  it('returns seeded defaults when never saved (15 habits, 5 prayers first)', async () => {
    const get = await request(app).get('/api/v1/daily-plan/settings');
    expect(get.status).toBe(200);
    expect(get.body.habits).toHaveLength(15);
    expect(get.body.habits[0]).toMatchObject({ id: 'fajr', salah: true });
    expect(get.body.targets).toMatchObject({ kcal: 2400, water: 8 });
  });

  it('PUT persists and GET self-heals through the schema', async () => {
    const put = await request(app)
      .put('/api/v1/daily-plan/settings')
      .send({ data: { density: 'roomy', gymTaskNumber: 613 } });
    expect(put.status).toBe(200);
    expect(put.body.density).toBe('roomy');

    const get = await request(app).get('/api/v1/daily-plan/settings');
    expect(get.body.density).toBe('roomy');
    expect(get.body.gymTaskNumber).toBe(613);
    // Normalized fields exist even though the PUT body was sparse.
    expect(Object.keys(get.body.gym.routines)).toEqual(
      expect.arrayContaining(['push', 'pull', 'legs', 'rest']),
    );
  });

  it('rejects an invalid settings blob', async () => {
    expectProblem(
      await request(app)
        .put('/api/v1/daily-plan/settings')
        .send({ data: { density: 'cozy' } }),
      400,
      'validation_failed',
    );
  });
});

describe('auth gate', () => {
  it('401 problem when unauthenticated', async () => {
    const anonApp = makeApp(
      '/api/v1/daily-plan',
      buildDailyPlanRouter({
        dailyPlans: repo,
        getPlanMetrics: new GetPlanMetrics({ dailyPlans: repo }),
        registry: new OpenApiRegistry(),
      }),
      null,
    );
    expectProblem(
      await request(anonApp).get('/api/v1/daily-plan?start=2026-07-09&end=2026-07-09'),
      401,
      'unauthorized',
    );
    expectProblem(
      await request(anonApp).put('/api/v1/daily-plan/2026-07-09').send({ data: {} }),
      401,
      'unauthorized',
    );
  });
});
