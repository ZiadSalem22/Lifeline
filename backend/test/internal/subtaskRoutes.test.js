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
    subtasks: [
      { subtaskId: 'sub-1', title: 'Step 1', isCompleted: false, position: 1 },
      { subtaskId: 'sub-2', title: 'Step 2', isCompleted: false, position: 2 },
    ],
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

function makeApp({ todoRepository, subtaskOperations } = {}) {
  const app = express();
  app.use(express.json());

  const task = createTask();
  const defaultTodoRepo = {
    findById: jest.fn(async () => task),
    findByTaskNumber: jest.fn(),
    countByUser: jest.fn(async () => 0),
    save: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
    unarchive: jest.fn(async () => undefined),
    findSimilarByTitle: jest.fn(async () => []),
  };
  const defaultSubtaskOps = {
    addSubtask: jest.fn(async () => createTask()),
    completeSubtask: jest.fn(async () => createTask()),
    uncompleteSubtask: jest.fn(async () => createTask()),
    updateSubtask: jest.fn(async () => createTask()),
    removeSubtask: jest.fn(async () => createTask()),
  };

  app.use('/internal/mcp', createInternalMcpRouter({
    todoRepository: todoRepository || defaultTodoRepo,
    userRepository: {
      findById: jest.fn(async () => ({ id: 'user-1', role: 'paid' })),
    },
    createTodo: { execute: jest.fn(async () => createTask()) },
    updateTodo: { execute: jest.fn(async () => createTask()) },
    deleteTodo: { execute: jest.fn(async () => undefined) },
    setTodoCompletion: { execute: jest.fn(async () => createTask()) },
    searchTodos: { execute: jest.fn(async () => ({ todos: [], total: 0 })) },
    listTodos: { execute: jest.fn(async () => []) },
    subtaskOperations: subtaskOperations || defaultSubtaskOps,
  }));
  app.use(errorHandler);
  return { app, subtaskOperations: subtaskOperations || defaultSubtaskOps };
}

describe('subtask routes', () => {
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

  describe('POST /tasks/:taskId/subtasks', () => {
    it('adds a subtask to an existing task', async () => {
      const { app, subtaskOperations } = makeApp();

      const res = await withInternalAuth(
        request(app)
          .post('/internal/mcp/tasks/task-1/subtasks')
          .send({ title: 'New Step' })
      );

      expect(res.status).toBe(201);
      expect(res.body.task).toBeDefined();
      expect(subtaskOperations.addSubtask).toHaveBeenCalledWith(
        'user-1', 'task-1', { title: 'New Step' }
      );
    });

    it('returns 400 when title is missing', async () => {
      const { app } = makeApp();

      const res = await withInternalAuth(
        request(app)
          .post('/internal/mcp/tasks/task-1/subtasks')
          .send({})
      );

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/title/i);
    });

    it('returns 404 for non-existent parent task', async () => {
      const todoRepository = {
        findById: jest.fn(async () => null),
        findByTaskNumber: jest.fn(),
        countByUser: jest.fn(async () => 0),
        save: jest.fn(async () => undefined),
        delete: jest.fn(async () => undefined),
        unarchive: jest.fn(async () => undefined),
        findSimilarByTitle: jest.fn(async () => []),
      };
      const { app } = makeApp({ todoRepository });

      const res = await withInternalAuth(
        request(app)
          .post('/internal/mcp/tasks/task-1/subtasks')
          .send({ title: 'Step' })
      );

      expect(res.status).toBe(404);
    });
  });

  describe('POST /tasks/:taskId/subtasks/:subtaskId/complete', () => {
    it('completes a subtask', async () => {
      const { app, subtaskOperations } = makeApp();

      const res = await withInternalAuth(
        request(app)
          .post('/internal/mcp/tasks/task-1/subtasks/sub-1/complete')
      );

      expect(res.status).toBe(200);
      expect(subtaskOperations.completeSubtask).toHaveBeenCalledWith(
        'user-1', 'task-1', 'sub-1'
      );
    });
  });

  describe('POST /tasks/:taskId/subtasks/:subtaskId/uncomplete', () => {
    it('uncompletes a subtask', async () => {
      const { app, subtaskOperations } = makeApp();

      const res = await withInternalAuth(
        request(app)
          .post('/internal/mcp/tasks/task-1/subtasks/sub-1/uncomplete')
      );

      expect(res.status).toBe(200);
      expect(subtaskOperations.uncompleteSubtask).toHaveBeenCalledWith(
        'user-1', 'task-1', 'sub-1'
      );
    });
  });

  describe('PATCH /tasks/:taskId/subtasks/:subtaskId', () => {
    it('updates a subtask title', async () => {
      const { app, subtaskOperations } = makeApp();

      const res = await withInternalAuth(
        request(app)
          .patch('/internal/mcp/tasks/task-1/subtasks/sub-1')
          .send({ title: 'Updated Step' })
      );

      expect(res.status).toBe(200);
      expect(subtaskOperations.updateSubtask).toHaveBeenCalledWith(
        'user-1', 'task-1', 'sub-1', { title: 'Updated Step' }
      );
    });

    it('returns 400 when no fields provided', async () => {
      const { app } = makeApp();

      const res = await withInternalAuth(
        request(app)
          .patch('/internal/mcp/tasks/task-1/subtasks/sub-1')
          .send({})
      );

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least one field/i);
    });
  });

  describe('DELETE /tasks/:taskId/subtasks/:subtaskId', () => {
    it('removes a subtask', async () => {
      const { app, subtaskOperations } = makeApp();

      const res = await withInternalAuth(
        request(app)
          .delete('/internal/mcp/tasks/task-1/subtasks/sub-1')
      );

      expect(res.status).toBe(200);
      expect(res.body.removed).toBe(true);
      expect(subtaskOperations.removeSubtask).toHaveBeenCalledWith(
        'user-1', 'task-1', 'sub-1'
      );
    });
  });
});
