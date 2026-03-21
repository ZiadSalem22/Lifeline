const express = require('express');
const request = require('supertest');
const { CreateTodoForInternalMcp } = require('../../src/application/CreateTodoForInternalMcp');
const SetTodoCompletion = require('../../src/application/SetTodoCompletion');
const { errorHandler } = require('../../src/middleware/errorHandler');
const { createInternalMcpRouter } = require('../../src/internal/mcp/router');
const { formatDateOnly } = require('../../src/internal/mcp/taskDueDate');
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

function createTag(overrides = {}) {
  return {
    id: 'tag-1',
    name: 'Errands',
    color: '#ffffff',
    ...overrides,
  };
}

function withInternalAuth(req, userId = 'user-1') {
  return req
    .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'shared-secret')
    .set(MCP_PRINCIPAL_HEADERS.lifelineUserId, userId)
    .set(MCP_PRINCIPAL_HEADERS.subjectId, `subject-${userId}`);
}

function makeApp({
  todoRepository,
  userRepository,
  createTodo,
  createTodoForInternalMcp,
  listTags,
  updateTodo,
  deleteTodo,
  setTodoCompletion,
} = {}) {
  const app = express();
  app.use(express.json());
  app.use('/internal/mcp', createInternalMcpRouter({
    todoRepository: todoRepository || {
      findById: jest.fn(),
      findByTaskNumber: jest.fn(),
      countByUser: jest.fn(async () => 0),
      save: jest.fn(async () => undefined),
      delete: jest.fn(async () => undefined),
    },
    userRepository: userRepository || {
      findById: jest.fn(async () => ({ id: 'user-1', role: 'paid' })),
    },
    createTodo: createTodo || {
      execute: jest.fn(async () => createTask()),
    },
    createTodoForInternalMcp: createTodoForInternalMcp,
    listTags: listTags,
    updateTodo: updateTodo || {
      execute: jest.fn(async () => createTask()),
    },
    deleteTodo: deleteTodo || {
      execute: jest.fn(async () => undefined),
    },
    setTodoCompletion: setTodoCompletion || {
      execute: jest.fn(async () => createTask({ isCompleted: true })),
    },
    searchTodos: {
      execute: jest.fn(async () => ({ todos: [], total: 0 })),
    },
    listTodos: {
      execute: jest.fn(async () => []),
    },
  }));
  app.use(errorHandler);
  return app;
}

describe('internal MCP task write routes', () => {
  const originalSecret = process.env.MCP_INTERNAL_SHARED_SECRET;
  const frozenNow = new Date('2026-03-21T12:00:00.000Z');

  beforeEach(() => {
    process.env.MCP_INTERNAL_SHARED_SECRET = 'shared-secret';
    jest.useFakeTimers().setSystemTime(frozenNow);
  });

  afterEach(() => {
    jest.useRealTimers();
    if (typeof originalSecret === 'undefined') {
      delete process.env.MCP_INTERNAL_SHARED_SECRET;
    } else {
      process.env.MCP_INTERNAL_SHARED_SECRET = originalSecret;
    }
  });

  it('rejects task writes without internal service auth', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/internal/mcp/tasks')
      .send({ title: 'New task' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Missing internal service authentication/i);
  });

  it('rejects task writes with invalid internal service auth', async () => {
    const app = makeApp();
    const res = await request(app)
      .delete('/internal/mcp/tasks/task-1')
      .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'wrong-secret');

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid internal service authentication/i);
  });

  it('rejects task writes without internal principal context', async () => {
    const app = makeApp();
    const res = await request(app)
      .patch('/internal/mcp/tasks/task-1')
      .set(INTERNAL_MCP_SHARED_SECRET_HEADER, 'shared-secret')
      .send({ title: 'Updated' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Missing internal principal context/i);
  });

  it('creates a task within the explicit user scope and preserves recurrence input', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 3),
      findById: jest.fn(),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const userRepository = {
      findById: jest.fn(async () => ({ id: 'user-1', role: 'free' })),
    };
    const createdTask = createTask({
      id: 'created-1',
      taskNumber: 22,
      title: 'Created task',
      recurrence: { mode: 'dateRange', startDate: '2026-03-07', endDate: '2026-03-09' },
    });
    const createTodo = {
      execute: jest.fn(async () => createdTask),
    };
    const createTodoForInternalMcp = new CreateTodoForInternalMcp({ userRepository, todoRepository, createTodo });

    const app = makeApp({ todoRepository, userRepository, createTodo, createTodoForInternalMcp });
    const res = await withInternalAuth(
      request(app)
        .post('/internal/mcp/tasks')
        .send({
          title: 'Created task',
          dueDate: '2026-03-07',
          tags: [createTag()],
          isFlagged: true,
          duration: 45,
          priority: 'high',
          dueTime: '12:30',
          subtasks: [{ id: 'sub-1', title: 'Subtask' }],
          description: 'Task body',
          recurrence: { mode: 'dateRange', startDate: '2026-03-07', endDate: '2026-03-09' },
        }),
    ).expect(201);

    expect(userRepository.findById).toHaveBeenCalledWith('user-1');
    expect(todoRepository.countByUser).toHaveBeenCalledWith('user-1');
    expect(createTodo.execute).toHaveBeenCalledWith(
      'user-1',
      'Created task',
      '2026-03-07',
      [expect.objectContaining({ id: 'tag-1' })],
      true,
      45,
      'high',
      '12:30',
      [{ id: 'sub-1', title: 'Subtask' }],
      'Task body',
      { mode: 'dateRange', startDate: '2026-03-07', endDate: '2026-03-09' },
    );
    expect(res.body.task.id).toBe('created-1');
    expect(res.body.task.taskNumber).toBe(22);
  });

  it('defaults create dueDate to today when MCP omits it', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const userRepository = {
      findById: jest.fn(async () => ({ id: 'user-1', role: 'paid' })),
    };
    const createTodo = {
      execute: jest.fn(async () => createTask({ dueDate: formatDateOnly(frozenNow) })),
    };
    const createTodoForInternalMcp = new CreateTodoForInternalMcp({ userRepository, todoRepository, createTodo });

    const app = makeApp({ todoRepository, userRepository, createTodo, createTodoForInternalMcp });
    await withInternalAuth(
      request(app)
        .post('/internal/mcp/tasks')
        .send({ title: 'Default due date task' }),
    ).expect(201);

    expect(createTodo.execute).toHaveBeenCalledWith(
      'user-1',
      'Default due date task',
      '2026-03-21',
      [],
      undefined,
      undefined,
      'medium',
      null,
      [],
      '',
      null,
    );
  });

  it('defaults update dueDate to today when an unscheduled MCP task is updated without one', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async (id, userId) => (id === 'task-7' && userId === 'user-1' ? createTask({ id, taskNumber: 7, dueDate: null }) : null)),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const updateTodo = {
      execute: jest.fn(async (_userId, id, updates) => createTask({ id, taskNumber: 7, title: updates.title, dueDate: updates.dueDate })),
    };

    const app = makeApp({ todoRepository, updateTodo });
    const res = await withInternalAuth(
      request(app)
        .patch('/internal/mcp/tasks/task-7')
        .send({ title: 'Updated title' }),
    ).expect(200);

    expect(updateTodo.execute).toHaveBeenCalledWith('user-1', 'task-7', {
      title: 'Updated title',
      dueDate: '2026-03-21',
    });
    expect(res.body.task.dueDate).toBe('2026-03-21');
  });

  it('keeps an existing dueDate on update when MCP omits the field', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async (id, userId) => (id === 'task-7' && userId === 'user-1' ? createTask({ id, taskNumber: 7, dueDate: '2026-03-30' }) : null)),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const updateTodo = {
      execute: jest.fn(async (_userId, id, updates) => createTask({ id, taskNumber: 7, title: updates.title, dueDate: updates.dueDate })),
    };

    const app = makeApp({ todoRepository, updateTodo });
    const res = await withInternalAuth(
      request(app)
        .patch('/internal/mcp/tasks/task-7')
        .send({ title: 'Updated title' }),
    ).expect(200);

    expect(updateTodo.execute).toHaveBeenCalledWith('user-1', 'task-7', {
      title: 'Updated title',
      dueDate: '2026-03-30',
    });
    expect(res.body.task.dueDate).toBe('2026-03-30');
  });

  it('rejects create when the free-tier task cap is reached', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 200),
      findById: jest.fn(),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const userRepository = {
      findById: jest.fn(async () => ({ id: 'user-1', role: 'free' })),
    };
    const createTodo = {
      execute: jest.fn(async () => createTask()),
    };
    const createTodoForInternalMcp = new CreateTodoForInternalMcp({ userRepository, todoRepository, createTodo });

    const app = makeApp({ todoRepository, userRepository, createTodo, createTodoForInternalMcp });
    const res = await withInternalAuth(
      request(app)
        .post('/internal/mcp/tasks')
        .send({ title: 'Blocked task' }),
    ).expect(403);

    expect(userRepository.findById).toHaveBeenCalledWith('user-1');
    expect(todoRepository.countByUser).toHaveBeenCalledWith('user-1');
    expect(createTodo.execute).not.toHaveBeenCalled();
    expect(res.body.message).toMatch(/Free tier max tasks reached/i);
  });

  it('updates only allowed mutable fields for an exact user-owned task', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async (id, userId) => (id === 'task-7' && userId === 'user-1' ? createTask({ id, taskNumber: 7 }) : null)),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const updateTodo = {
      execute: jest.fn(async (_userId, id, updates) => createTask({ id, taskNumber: 7, title: updates.title, priority: updates.priority })),
    };

    const app = makeApp({ todoRepository, updateTodo });
    const res = await withInternalAuth(
      request(app)
        .patch('/internal/mcp/tasks/task-7')
        .send({ title: 'Updated title', priority: 'low' }),
    ).expect(200);

    expect(todoRepository.findById).toHaveBeenCalledWith('task-7', 'user-1');
    expect(updateTodo.execute).toHaveBeenCalledWith('user-1', 'task-7', {
      title: 'Updated title',
      dueDate: '2026-03-07',
      priority: 'low',
    });
    expect(res.body.task.title).toBe('Updated title');
    expect(res.body.task.priority).toBe('low');
  });

  it('resolves update tags from MCP tag names before validation', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async (id, userId) => (id === 'task-7' && userId === 'user-1' ? createTask({ id, taskNumber: 7 }) : null)),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const listTags = {
      execute: jest.fn(async () => [
        createTag({ id: 'tag-personal', name: 'Personal', color: '#10B981', isDefault: true }),
        createTag({ id: 'tag-health', name: 'Health', color: '#EF4444', isDefault: true }),
      ]),
    };
    const updateTodo = {
      execute: jest.fn(async (_userId, id, updates) => createTask({ id, taskNumber: 7, tags: updates.tags, dueDate: updates.dueDate })),
    };

    const app = makeApp({ todoRepository, listTags, updateTodo });
    const res = await withInternalAuth(
      request(app)
        .patch('/internal/mcp/tasks/task-7')
        .send({ tags: ['Personal', { name: 'Health' }] }),
    ).expect(200);

    expect(listTags.execute).toHaveBeenCalledWith('user-1');
    expect(updateTodo.execute).toHaveBeenCalledWith('user-1', 'task-7', {
      dueDate: '2026-03-07',
      tags: [
        expect.objectContaining({ id: 'tag-personal', name: 'Personal', color: '#10B981' }),
        expect.objectContaining({ id: 'tag-health', name: 'Health', color: '#EF4444' }),
      ],
    });
    expect(res.body.task.tags).toEqual([
      expect.objectContaining({ id: 'tag-personal', name: 'Personal', color: '#10B981' }),
      expect.objectContaining({ id: 'tag-health', name: 'Health', color: '#EF4444' }),
    ]);
  });

  it('rejects unknown MCP tag names with a clear validation error', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async (id, userId) => (id === 'task-7' && userId === 'user-1' ? createTask({ id, taskNumber: 7 }) : null)),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const listTags = {
      execute: jest.fn(async () => [createTag({ id: 'tag-personal', name: 'Personal', color: '#10B981', isDefault: true })]),
    };
    const updateTodo = {
      execute: jest.fn(async () => createTask()),
    };

    const app = makeApp({ todoRepository, listTags, updateTodo });
    const res = await withInternalAuth(
      request(app)
        .patch('/internal/mcp/tasks/task-7')
        .send({ tags: ['Missing Tag'] }),
    ).expect(400);

    expect(updateTodo.execute).not.toHaveBeenCalled();
    expect(res.body.message).toMatch(/Tag "Missing Tag" was not found/i);
  });

  it('rejects unsupported internal update fields explicitly', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async (id, userId) => (id === 'task-7' && userId === 'user-1' ? createTask({ id, taskNumber: 7 }) : null)),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const updateTodo = {
      execute: jest.fn(async () => createTask()),
    };

    const app = makeApp({ todoRepository, updateTodo });
    const res = await withInternalAuth(
      request(app)
        .patch('/internal/mcp/tasks/task-7')
        .send({ title: 'Updated title', recurrence: { mode: 'daily' } }),
    ).expect(400);

    expect(updateTodo.execute).not.toHaveBeenCalled();
    expect(res.body.message).toMatch(/Unsupported update fields: recurrence/i);
  });

  it('returns 404 when updating a task outside the current user scope', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async () => null),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const updateTodo = {
      execute: jest.fn(),
    };

    const app = makeApp({ todoRepository, updateTodo });
    const res = await withInternalAuth(
      request(app).patch('/internal/mcp/tasks/task-missing').send({ title: 'Updated' }),
    ).expect(404);

    expect(updateTodo.execute).not.toHaveBeenCalled();
    expect(res.body.message).toMatch(/Task not found/i);
  });

  it('completes a task explicitly and idempotently', async () => {
    const completedTask = createTask({ id: 'task-complete', taskNumber: 4, isCompleted: true });
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async (id, userId) => (id === 'task-complete' && userId === 'user-1' ? completedTask : null)),
      findByTaskNumber: jest.fn(),
      save: jest.fn(async () => undefined),
      delete: jest.fn(),
    };
    const setTodoCompletion = new SetTodoCompletion(todoRepository);

    const app = makeApp({ todoRepository, setTodoCompletion });
    const res = await withInternalAuth(request(app).post('/internal/mcp/tasks/task-complete/complete')).expect(200);

    expect(todoRepository.findById).toHaveBeenCalledWith('task-complete', 'user-1');
    expect(todoRepository.save).not.toHaveBeenCalled();
    expect(res.body.completed).toBe(true);
    expect(res.body.task.isCompleted).toBe(true);
  });

  it('uncompletes a task explicitly and idempotently', async () => {
    const activeTask = createTask({ id: 'task-uncomplete', taskNumber: 8, isCompleted: false });
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async (id, userId) => (id === 'task-uncomplete' && userId === 'user-1' ? activeTask : null)),
      findByTaskNumber: jest.fn(),
      save: jest.fn(async () => undefined),
      delete: jest.fn(),
    };
    const setTodoCompletion = new SetTodoCompletion(todoRepository);

    const app = makeApp({ todoRepository, setTodoCompletion });
    const res = await withInternalAuth(request(app).post('/internal/mcp/tasks/task-uncomplete/uncomplete')).expect(200);

    expect(todoRepository.findById).toHaveBeenCalledWith('task-uncomplete', 'user-1');
    expect(todoRepository.save).not.toHaveBeenCalled();
    expect(res.body.completed).toBe(false);
    expect(res.body.task.isCompleted).toBe(false);
  });

  it('deletes a task using archive-oriented active-set removal semantics', async () => {
    const todoRepository = {
      countByUser: jest.fn(async () => 0),
      findById: jest.fn(async (id, userId) => (id === 'task-delete' && userId === 'user-1' ? createTask({ id, taskNumber: 13, title: 'Delete me' }) : null)),
      findByTaskNumber: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(async () => undefined),
    };
    const deleteTodo = {
      execute: jest.fn(async () => undefined),
    };

    const app = makeApp({ todoRepository, deleteTodo });
    const res = await withInternalAuth(request(app).delete('/internal/mcp/tasks/task-delete')).expect(200);

    expect(deleteTodo.execute).toHaveBeenCalledWith('user-1', 'task-delete');
    expect(res.body).toEqual({
      id: 'task-delete',
      taskNumber: 13,
      deleted: true,
      deleteMode: 'archived',
    });
  });
});
