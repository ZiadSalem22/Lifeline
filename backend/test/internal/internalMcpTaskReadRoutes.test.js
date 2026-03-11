const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../../src/middleware/errorHandler');
const { createInternalMcpRouter } = require('../../src/internal/mcp/router');
const {
  INTERNAL_MCP_SHARED_SECRET_HEADER,
  MCP_PRINCIPAL_HEADERS,
} = require('../../src/internal/mcp/constants');

function createTask(overrides = {}) {
  return {
    id: 'task-1',
    taskNumber: 1,
    title: 'Task',
    description: '',
    dueDate: '2026-03-07',
    dueTime: null,
    isCompleted: false,
    isFlagged: false,
    duration: 0,
    priority: 'medium',
    tags: [],
    subtasks: [],
    order: 0,
    recurrence: null,
    nextRecurrenceDue: null,
    originalId: null,
    archived: false,
    ...overrides,
  };
}

function withInternalAuth(req, userId = 'user-1') {
  return req
    .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'shared-secret')
    .set(MCP_PRINCIPAL_HEADERS.lifelineUserId, userId)
    .set(MCP_PRINCIPAL_HEADERS.subjectId, `subject-${userId}`);
}

function makeApp({ todoRepository, searchTodos, listTodos, now = '2026-03-07T10:00:00.000Z' } = {}) {
  const app = express();
  app.use('/internal/mcp', createInternalMcpRouter({
    todoRepository: todoRepository || {
      findByTaskNumber: jest.fn(),
      findById: jest.fn(),
    },
    searchTodos: searchTodos || {
      execute: jest.fn(async () => ({ todos: [], total: 0 })),
    },
    listTodos: listTodos || {
      execute: jest.fn(async () => []),
    },
    getNow: () => new Date(now),
  }));
  app.use(errorHandler);
  return app;
}

describe('internal MCP task read routes', () => {
  const originalSecret = process.env.MCP_INTERNAL_SHARED_SECRET;

  beforeEach(() => {
    process.env.MCP_INTERNAL_SHARED_SECRET = 'shared-secret';
  });

  afterEach(() => {
    if (typeof originalSecret === 'undefined') {
      delete process.env.MCP_INTERNAL_SHARED_SECRET;
    } else {
      process.env.MCP_INTERNAL_SHARED_SECRET = originalSecret;
    }
  });

  it('rejects task reads without internal service auth', async () => {
    const app = makeApp();
    const res = await request(app).get('/internal/mcp/tasks/search');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Missing internal service authentication/i);
  });

  it('rejects task reads without internal principal context', async () => {
    const app = makeApp();
    const res = await request(app)
      .get('/internal/mcp/tasks/search')
      .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'shared-secret');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Missing internal principal context/i);
  });

  it('passes user-scoped search filters through the internal adapter', async () => {
    const searchTodos = {
      execute: jest.fn(async () => ({
        todos: [createTask({ id: 'task-7', taskNumber: 7, title: 'Milk run', tags: [{ id: 'tag-1', name: 'Errands', color: '#fff' }] })],
        total: 1,
      })),
    };

    const app = makeApp({ searchTodos });
    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/search')
        .query({
          query: 'milk',
          tags: 'tag-1,tag-2',
          priority: 'high',
          status: 'completed',
          startDate: '2026-03-01',
          endDate: '2026-03-10',
          flagged: 'true',
          minDuration: '15',
          maxDuration: '45',
          sortBy: 'priority',
          page: '2',
          limit: '10',
          taskNumber: '7',
        }),
    ).expect(200);

    expect(searchTodos.execute).toHaveBeenCalledWith('user-1', {
      q: 'milk',
      tags: ['tag-1', 'tag-2'],
      priority: 'high',
      status: 'completed',
      startDate: '2026-03-01',
      endDate: '2026-03-10',
      flagged: true,
      includeArchived: false,
      minDuration: 15,
      maxDuration: 45,
      sortBy: 'priority',
      page: 2,
      limit: 10,
      offset: 10,
      taskNumber: 7,
    });
    expect(res.body.total).toBe(1);
    expect(res.body.tasks[0].taskNumber).toBe(7);
    expect(res.body.tasks[0].tags[0].id).toBe('tag-1');
  });

  it('returns only the current user task for by-number lookup', async () => {
    const todoRepository = {
      findByTaskNumber: jest.fn(async (userId, taskNumber) => {
        if (userId === 'user-1' && taskNumber === 5) {
          return createTask({ id: 'task-5', taskNumber: 5, title: 'Scoped task' });
        }
        return null;
      }),
      findById: jest.fn(),
    };

    const app = makeApp({ todoRepository });
    const res = await withInternalAuth(request(app).get('/internal/mcp/tasks/by-number/5')).expect(200);

    expect(todoRepository.findByTaskNumber).toHaveBeenCalledWith('user-1', 5);
    expect(res.body.task.id).toBe('task-5');
    expect(res.body.task.taskNumber).toBe(5);
  });

  it('returns 404 when the current user has no matching task number', async () => {
    const todoRepository = {
      findByTaskNumber: jest.fn(async () => null),
      findById: jest.fn(),
    };

    const app = makeApp({ todoRepository });
    const res = await withInternalAuth(request(app).get('/internal/mcp/tasks/by-number/99')).expect(404);

    expect(res.body.message).toMatch(/Task not found/i);
  });

  it('preserves dateRange inclusion behavior for day-listing', async () => {
    const listTodos = {
      execute: jest.fn(async () => ([
        createTask({ id: 'range', taskNumber: 1, title: 'Date range', dueDate: '2026-03-01', recurrence: { mode: 'dateRange', startDate: '2026-03-01', endDate: '2026-03-10' } }),
        createTask({ id: 'today', taskNumber: 2, title: 'Today task', dueDate: '2026-03-07' }),
        createTask({ id: 'tomorrow', taskNumber: 3, title: 'Tomorrow task', dueDate: '2026-03-08' }),
        createTask({ id: 'none', taskNumber: 4, title: 'No due date', dueDate: null }),
      ])),
    };

    const app = makeApp({ listTodos, now: '2026-03-07T10:00:00.000Z' });
    const res = await withInternalAuth(request(app).get('/internal/mcp/tasks/day/today')).expect(200);

    expect(listTodos.execute).toHaveBeenCalledWith('user-1');
    expect(res.body.dateToken).toBe('today');
    expect(res.body.resolvedDate).toBe('2026-03-07');
    expect(res.body.tasks.map((task) => task.id)).toEqual(['range', 'today']);
  });

  it('rejects invalid date tokens for day-listing', async () => {
    const app = makeApp();
    const res = await withInternalAuth(request(app).get('/internal/mcp/tasks/day/not-a-date')).expect(400);

    expect(res.body.message).toMatch(/Invalid date token/i);
  });

  it('returns a deterministic upcoming list and excludes unscheduled tasks', async () => {
    const listTodos = {
      execute: jest.fn(async () => ([
        createTask({ id: 'completed', taskNumber: 9, title: 'Completed future', dueDate: '2026-03-09', isCompleted: true }),
        createTask({ id: 'unscheduled', taskNumber: 8, title: 'Unscheduled', dueDate: null }),
        createTask({ id: 'range', taskNumber: 1, title: 'In progress range', dueDate: '2026-03-01', recurrence: { mode: 'dateRange', startDate: '2026-03-01', endDate: '2026-03-10' } }),
        createTask({ id: 'same-day-later', taskNumber: 4, title: 'Same day later order', dueDate: '2026-03-07', order: 2 }),
        createTask({ id: 'same-day-earlier', taskNumber: 3, title: 'Same day earlier order', dueDate: '2026-03-07', order: 1 }),
        createTask({ id: 'future', taskNumber: 5, title: 'Future', dueDate: '2026-03-08', order: 0 }),
      ])),
    };

    const app = makeApp({ listTodos, now: '2026-03-07T10:00:00.000Z' });
    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/upcoming').query({ fromDate: '2026-03-07', limit: '4' }),
    ).expect(200);

    expect(res.body.fromDate).toBe('2026-03-07');
    expect(res.body.includesUnscheduled).toBe(false);
    expect(res.body.ordering).toBe('effectiveDateAsc,orderAsc,taskNumberAsc');
    expect(res.body.tasks.map((task) => task.id)).toEqual(['range', 'same-day-earlier', 'same-day-later', 'future']);
    expect(res.body.count).toBe(4);
  });
});
