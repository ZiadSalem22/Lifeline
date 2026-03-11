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

function makeApp({ todoRepository, updateTodo, setTodoCompletion, deleteTodo } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/internal/mcp', createInternalMcpRouter({
    todoRepository: todoRepository || {
      findById: jest.fn(),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      unarchive: jest.fn(async () => undefined),
    },
    userRepository: {
      findById: jest.fn(async () => ({ id: 'user-1', role: 'paid' })),
    },
    createTodo: { execute: jest.fn(async () => createTask()) },
    updateTodo: updateTodo || { execute: jest.fn(async () => createTask()) },
    deleteTodo: deleteTodo || { execute: jest.fn(async () => undefined) },
    setTodoCompletion: setTodoCompletion || { execute: jest.fn(async () => createTask({ isCompleted: true })) },
    searchTodos: { execute: jest.fn(async () => ({ todos: [], total: 0 })) },
    listTodos: { execute: jest.fn(async () => []) },
  }));
  app.use(errorHandler);
  return app;
}

describe('archived-state mutation guards', () => {
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

  it('rejects update on archived task with 409', async () => {
    const archivedTask = createTask({ archived: true });
    const todoRepository = {
      findById: jest.fn(async () => archivedTask),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      unarchive: jest.fn(async () => undefined),
    };
    const app = makeApp({ todoRepository });
    const res = await withInternalAuth(
      request(app).patch('/internal/mcp/tasks/task-1').send({ title: 'Updated' })
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/archived/i);
  });

  it('rejects complete on archived task with 409', async () => {
    const archivedTask = createTask({ archived: true });
    const todoRepository = {
      findById: jest.fn(async () => archivedTask),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      unarchive: jest.fn(async () => undefined),
    };
    const app = makeApp({ todoRepository });
    const res = await withInternalAuth(
      request(app).post('/internal/mcp/tasks/task-1/complete')
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/archived/i);
  });

  it('rejects uncomplete on archived task with 409', async () => {
    const archivedTask = createTask({ archived: true });
    const todoRepository = {
      findById: jest.fn(async () => archivedTask),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      unarchive: jest.fn(async () => undefined),
    };
    const app = makeApp({ todoRepository });
    const res = await withInternalAuth(
      request(app).post('/internal/mcp/tasks/task-1/uncomplete')
    );

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/archived/i);
  });

  it('allows update on active (non-archived) task', async () => {
    const activeTask = createTask({ archived: false });
    const todoRepository = {
      findById: jest.fn(async () => activeTask),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      unarchive: jest.fn(async () => undefined),
    };
    const updateTodo = { execute: jest.fn(async () => activeTask) };
    const app = makeApp({ todoRepository, updateTodo });
    const res = await withInternalAuth(
      request(app).patch('/internal/mcp/tasks/task-1').send({ title: 'Updated' })
    );

    expect(res.status).toBe(200);
    expect(updateTodo.execute).toHaveBeenCalled();
  });
});

describe('restore task route', () => {
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

  it('restores an archived task', async () => {
    const archivedTask = createTask({ archived: true });
    const restoredTask = createTask({ archived: false });
    const todoRepository = {
      findById: jest.fn()
        .mockResolvedValueOnce(archivedTask)
        .mockResolvedValueOnce(restoredTask),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      unarchive: jest.fn(async () => undefined),
    };
    const app = makeApp({ todoRepository });

    const res = await withInternalAuth(
      request(app).post('/internal/mcp/tasks/task-1/restore')
    );

    expect(res.status).toBe(200);
    expect(todoRepository.unarchive).toHaveBeenCalled();
  });

  it('returns success for already-active task', async () => {
    const activeTask = createTask({ archived: false });
    const todoRepository = {
      findById: jest.fn(async () => activeTask),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      unarchive: jest.fn(async () => undefined),
    };
    const app = makeApp({ todoRepository });

    const res = await withInternalAuth(
      request(app).post('/internal/mcp/tasks/task-1/restore')
    );

    expect(res.status).toBe(200);
    expect(todoRepository.unarchive).not.toHaveBeenCalled();
  });

  it('returns 404 for non-existent task', async () => {
    const todoRepository = {
      findById: jest.fn(async () => null),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
      unarchive: jest.fn(async () => undefined),
    };
    const app = makeApp({ todoRepository });

    const res = await withInternalAuth(
      request(app).post('/internal/mcp/tasks/task-1/restore')
    );

    expect(res.status).toBe(404);
  });
});
