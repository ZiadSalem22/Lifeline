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

function makeApp({ todoRepository, searchTodos, listTodos, findSimilarTasks, now = '2026-03-10T10:00:00.000Z' } = {}) {
  const app = express();
  app.use('/internal/mcp', createInternalMcpRouter({
    todoRepository: todoRepository || {
      findByTaskNumber: jest.fn(),
      findById: jest.fn(),
      findSimilarByTitle: jest.fn(async () => []),
    },
    searchTodos: searchTodos || {
      execute: jest.fn(async () => ({ todos: [], total: 0 })),
    },
    listTodos: listTodos || {
      execute: jest.fn(async () => []),
    },
    findSimilarTasks: findSimilarTasks,
    getNow: () => new Date(now),
  }));
  app.use(errorHandler);
  return app;
}

describe('window query routes', () => {
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

  it('returns tasks for this_week window token', async () => {
    // 2026-03-10 is a Tuesday. this_week = Mon 2026-03-09 to Sun 2026-03-15
    const taskInRange = createTask({ dueDate: '2026-03-12' });
    const taskOutOfRange = createTask({ id: 'task-2', dueDate: '2026-03-20' });
    const listTodos = { execute: jest.fn(async () => [taskInRange, taskOutOfRange]) };
    const app = makeApp({ listTodos });

    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/window/this_week')
    );

    expect(res.status).toBe(200);
    expect(res.body.windowToken).toBe('this_week');
    expect(res.body.resolvedStart).toBeDefined();
    expect(res.body.resolvedEnd).toBeDefined();
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].id).toBe('task-1');
  });

  it('returns tasks for YYYY-MM window token', async () => {
    const taskInRange = createTask({ dueDate: '2026-03-15' });
    const taskOutOfRange = createTask({ id: 'task-2', dueDate: '2026-04-10' });
    const listTodos = { execute: jest.fn(async () => [taskInRange, taskOutOfRange]) };
    const app = makeApp({ listTodos });

    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/window/2026-03')
    );

    expect(res.status).toBe(200);
    expect(res.body.windowToken).toBe('2026-03');
    expect(res.body.tasks.length).toBe(1);
  });

  it('filters out completed tasks by default', async () => {
    const completedTask = createTask({ isCompleted: true, dueDate: '2026-03-12' });
    const activeTask = createTask({ id: 'task-2', isCompleted: false, dueDate: '2026-03-12' });
    const listTodos = { execute: jest.fn(async () => [completedTask, activeTask]) };
    const app = makeApp({ listTodos });

    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/window/this_week')
    );

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.tasks[0].id).toBe('task-2');
  });

  it('includes completed tasks when includeCompleted=true', async () => {
    const completedTask = createTask({ isCompleted: true, dueDate: '2026-03-12' });
    const activeTask = createTask({ id: 'task-2', isCompleted: false, dueDate: '2026-03-12' });
    const listTodos = { execute: jest.fn(async () => [completedTask, activeTask]) };
    const app = makeApp({ listTodos });

    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/window/this_week?includeCompleted=true')
    );

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(2);
  });

  it('returns empty array for window with no matching tasks', async () => {
    const listTodos = { execute: jest.fn(async () => []) };
    const app = makeApp({ listTodos });

    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/window/next_month')
    );

    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('rejects invalid window tokens with 400', async () => {
    const app = makeApp();

    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/window/invalid_token')
    );

    expect(res.status).toBe(400);
  });
});

describe('similar tasks route', () => {
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

  it('returns similar tasks by title', async () => {
    const similarTask = createTask({ title: 'Buy groceries' });
    const findSimilarTasks = {
      execute: jest.fn(async () => [similarTask]),
    };
    const app = makeApp({ findSimilarTasks });

    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/similar?title=Buy%20food')
    );

    expect(res.status).toBe(200);
    expect(res.body.query).toBe('Buy food');
    expect(res.body.tasks.length).toBe(1);
    expect(res.body.count).toBe(1);
  });

  it('returns 400 when title is missing', async () => {
    const findSimilarTasks = { execute: jest.fn() };
    const app = makeApp({ findSimilarTasks });

    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/similar')
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title/i);
  });

  it('passes optional limit and threshold', async () => {
    const findSimilarTasks = {
      execute: jest.fn(async () => []),
    };
    const app = makeApp({ findSimilarTasks });

    const res = await withInternalAuth(
      request(app).get('/internal/mcp/tasks/similar?title=Test&limit=3&threshold=0.5')
    );

    expect(res.status).toBe(200);
    expect(findSimilarTasks.execute).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: 'Test', limit: 3, threshold: 0.5 })
    );
  });
});
