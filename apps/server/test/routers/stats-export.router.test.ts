import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROBLEM_CONTENT_TYPE, problemSchema, statsResponseSchema } from '@lifeline/shared';
import { OpenApiRegistry } from '../../src/http/openapi/registry.js';
import { buildStatsRouter } from '../../src/http/routes/stats.js';
import { buildExportRouter } from '../../src/http/routes/export.js';
import { GetStats } from '../../src/application/stats/get-stats.js';
import { ExportData } from '../../src/application/data-transfer/export-data.js';
import { InMemoryTagRepository, InMemoryTodoRepository } from '../helpers/feature-fakes.js';
import { makeApp, makeUser } from '../helpers/router-app.js';
import type { CurrentUser } from '../../src/application/ports.js';

const USER = makeUser({ id: 'u1' });

let todos: InMemoryTodoRepository;
let tags: InMemoryTagRepository;

beforeEach(() => {
  tags = new InMemoryTagRepository();
  tags.seedDefaults();
  todos = new InMemoryTodoRepository(tags);
});

function expectProblem(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  expect(problemSchema.safeParse(response.body).success).toBe(true);
  expect(response.body).toMatchObject({ status, code });
}

const emptyPlanRepo = {
  getAllDays: () => Promise.resolve([]),
  getSettings: () => Promise.resolve(null),
};

describe('GET /api/v1/stats', () => {
  function statsApp(user: CurrentUser | null = USER) {
    return makeApp(
      '/api/v1/stats',
      buildStatsRouter({ getStats: new GetStats({ todos }), registry: new OpenApiRegistry() }),
      user,
    );
  }

  it('period mode returns the full stats shape', async () => {
    todos.seed('u1', { dueDate: '2026-07-06', isCompleted: true, duration: 30 });
    const response = await request(statsApp()).get('/api/v1/stats?period=day');
    expect(response.status).toBe(200);
    expect(statsResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body).toMatchObject({
      periodTotals: { totalTodos: 1, completedCount: 1, completionRate: 100 },
      groups: [{ period: '2026-07-06', date: '2026-07-06', count: 1 }],
    });
  });

  it('range mode zero-fills per-day groups', async () => {
    todos.seed('u1', { dueDate: '2026-03-02' });
    const response = await request(statsApp()).get(
      '/api/v1/stats?startDate=2026-03-01&endDate=2026-03-03',
    );
    expect(response.status).toBe(200);
    expect(response.body.groups).toEqual([
      { period: '2026-03-01', date: '2026-03-01', count: 0 },
      { period: '2026-03-02', date: '2026-03-02', count: 1 },
      { period: '2026-03-03', date: '2026-03-03', count: 0 },
    ]);
  });

  it('400 when neither period nor a full startDate+endDate pair is given (refine)', async () => {
    expectProblem(await request(statsApp()).get('/api/v1/stats'), 400, 'validation_failed');
    expectProblem(
      await request(statsApp()).get('/api/v1/stats?startDate=2026-03-01'),
      400,
      'validation_failed',
    );
  });

  it('400 on an invalid period or malformed date', async () => {
    expectProblem(
      await request(statsApp()).get('/api/v1/stats?period=decade'),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(statsApp()).get('/api/v1/stats?startDate=03/01/2026&endDate=2026-03-02'),
      400,
      'validation_failed',
    );
  });

  it('401 problem without a current user', async () => {
    expectProblem(
      await request(statsApp(null)).get('/api/v1/stats?period=day'),
      401,
      'unauthorized',
    );
  });
});

describe('GET /api/v1/export', () => {
  function exportApp(user: CurrentUser | null = USER) {
    return makeApp(
      '/api/v1/export',
      buildExportRouter({
        exportData: new ExportData({ todos, tags, dailyPlans: emptyPlanRepo }),
        registry: new OpenApiRegistry(),
      }),
      user,
    );
  }

  it('json format (default): attachment todos_export.json with the full payload', async () => {
    todos.seed('u1', { title: 'Exported' });
    for (const url of ['/api/v1/export', '/api/v1/export?format=json']) {
      const response = await request(exportApp()).get(url);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="todos_export.json"',
      );
      const payload = JSON.parse(response.text);
      expect(payload).toMatchObject({ user: { id: 'u1' } });
      expect(payload.todos).toHaveLength(1);
      expect(payload.tags).toHaveLength(10);
      expect(payload.stats.tasksPerDay).toHaveLength(30);
      expect(typeof payload.exportedAt).toBe('string');
    }
  });

  it('csv format: text/csv attachment todos_export.csv with the exact header', async () => {
    todos.seed('u1', { title: 'Exported' });
    const response = await request(exportApp()).get('/api/v1/export?format=csv');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe('attachment; filename="todos_export.csv"');
    expect(response.text.split('\n')[0]).toBe(
      'id,title,description,dueDate,dueTime,isCompleted,isFlagged,priority,duration,tags,subtasks,recurrence',
    );
    expect(response.text).toContain('Exported');
  });

  it('400 on an unknown format; 401 without a user', async () => {
    expectProblem(
      await request(exportApp()).get('/api/v1/export?format=xml'),
      400,
      'validation_failed',
    );
    expectProblem(await request(exportApp(null)).get('/api/v1/export'), 401, 'unauthorized');
  });
});
