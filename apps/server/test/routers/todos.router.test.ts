import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROBLEM_CONTENT_TYPE, problemSchema, type Todo } from '@lifeline/shared';
import { OpenApiRegistry } from '../../src/http/openapi/registry.js';
import { buildTodosRouter } from '../../src/http/routes/todos.js';
import { CreateTodo } from '../../src/application/todos/create-todo.js';
import { ListTodos } from '../../src/application/todos/list-todos.js';
import { GetTodo } from '../../src/application/todos/get-todo.js';
import { UpdateTodo } from '../../src/application/todos/update-todo.js';
import { SetTodoCompletion } from '../../src/application/todos/set-todo-completion.js';
import { ArchiveTodo } from '../../src/application/todos/archive-todo.js';
import { BatchTodos } from '../../src/application/todos/batch-todos.js';
import { FindSimilarTodos } from '../../src/application/todos/find-similar-todos.js';
import { SubtaskOps } from '../../src/application/todos/subtask-ops.js';
import { InMemoryTagRepository, InMemoryTodoRepository } from '../helpers/feature-fakes.js';
import { makeApp, makeUser } from '../helpers/router-app.js';

const USER = makeUser({ id: 'u1' });

let todos: InMemoryTodoRepository;
let tags: InMemoryTagRepository;
let app: ReturnType<typeof makeApp>;

beforeEach(() => {
  tags = new InMemoryTagRepository();
  tags.seedDefaults();
  todos = new InMemoryTodoRepository(tags);
  const registry = new OpenApiRegistry();
  const router = buildTodosRouter({
    createTodo: new CreateTodo({ todos, tags }),
    listTodos: new ListTodos({ todos }),
    getTodo: new GetTodo({ todos }),
    updateTodo: new UpdateTodo({ todos, tags }),
    setTodoCompletion: new SetTodoCompletion({ todos }),
    archiveTodo: new ArchiveTodo({ todos }),
    batchTodos: new BatchTodos({ todos }),
    findSimilarTodos: new FindSimilarTodos({ todos }),
    subtaskOps: new SubtaskOps({ todos }),
    registry,
  });
  app = makeApp('/api/v1/todos', router, USER);
});

function expectProblem(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  const parsed = problemSchema.safeParse(response.body);
  expect(parsed.success).toBe(true);
  expect(response.body).toMatchObject({ status, code });
}

describe('GET /api/v1/todos', () => {
  it('returns the page envelope {items, page, pageSize, totalItems, totalPages}', async () => {
    for (let i = 0; i < 3; i += 1) todos.seed('u1');
    const response = await request(app).get('/api/v1/todos');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      page: 1,
      pageSize: 50,
      totalItems: 3,
      totalPages: 1,
    });
    expect(response.body.items).toHaveLength(3);
  });

  it('applies filters and excludes archived by default', async () => {
    todos.seed('u1', { title: 'Active high', priority: 'high' });
    todos.seed('u1', { title: 'Archived', archived: true });
    const all = await request(app).get('/api/v1/todos');
    expect(all.body.totalItems).toBe(1);
    const archived = await request(app).get('/api/v1/todos?includeArchived=true');
    expect(archived.body.totalItems).toBe(2);
    const high = await request(app).get('/api/v1/todos?priority=high');
    expect(high.body.totalItems).toBe(1);
  });

  it('400 problem on invalid query params', async () => {
    expectProblem(await request(app).get('/api/v1/todos?pageSize=999'), 400, 'validation_failed');
    expectProblem(
      await request(app).get('/api/v1/todos?priority=urgent'),
      400,
      'validation_failed',
    );
  });
});

describe('POST /api/v1/todos', () => {
  it('201 with the first todo and X-Total-Created for recurrence expansion', async () => {
    const response = await request(app)
      .post('/api/v1/todos')
      .send({
        title: 'Daily standup',
        recurrence: { mode: 'daily', startDate: '2026-03-01', endDate: '2026-03-03' },
      });
    expect(response.status).toBe(201);
    expect(response.headers['x-total-created']).toBe('3');
    expect(response.body).toMatchObject({ title: 'Daily standup', dueDate: '2026-03-01' });
  });

  it('X-Total-Created is 1 for plain creates', async () => {
    const response = await request(app).post('/api/v1/todos').send({ title: 'One' });
    expect(response.status).toBe(201);
    expect(response.headers['x-total-created']).toBe('1');
  });

  it('habitId roundtrips: set at create, changed and cleared via PATCH', async () => {
    const created = await request(app)
      .post('/api/v1/todos')
      .send({ title: 'Udemy hour', habitId: 'udemy' });
    expect(created.status).toBe(201);
    expect(created.body.habitId).toBe('udemy');

    const id = created.body.id as string;
    const relinked = await request(app).patch(`/api/v1/todos/${id}`).send({ habitId: 'reading' });
    expect(relinked.status).toBe(200);
    expect(relinked.body.habitId).toBe('reading');

    const cleared = await request(app).patch(`/api/v1/todos/${id}`).send({ habitId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.habitId).toBeNull();
  });

  it('400 problem with field errors for an empty body', async () => {
    const response = await request(app).post('/api/v1/todos').send({});
    expectProblem(response, 400, 'validation_failed');
    expect(response.body.errors).toHaveProperty('title');
  });

  it('403 problem at the free-tier cap', async () => {
    for (let i = 0; i < 200; i += 1) todos.seed('u1');
    const response = await request(app).post('/api/v1/todos').send({ title: 'Over cap' });
    expectProblem(response, 403, 'forbidden');
    expect(response.body.detail).toBe('Free tier max tasks reached.');
  });
});

describe('route ordering: /similar, /by-number, /batch before /:id', () => {
  it('GET /similar responds with {items, query} (not a 404 id lookup)', async () => {
    todos.seed('u1', { title: 'Water the plants' });
    const response = await request(app).get('/api/v1/todos/similar?title=Water%20the%20plants');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ query: 'Water the plants' });
    expect(response.body.items).toHaveLength(1);
  });

  it('GET /similar validates bounds (limit 1-20, threshold 0.1-1)', async () => {
    expectProblem(
      await request(app).get('/api/v1/todos/similar?title=x&limit=21'),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app).get('/api/v1/todos/similar?title=x&threshold=0.05'),
      400,
      'validation_failed',
    );
    expectProblem(await request(app).get('/api/v1/todos/similar'), 400, 'validation_failed');
  });

  it('GET /by-number/:n resolves and 404s with the contract message', async () => {
    const seeded = todos.seed('u1', { taskNumber: 7 });
    const found = await request(app).get('/api/v1/todos/by-number/7');
    expect(found.status).toBe(200);
    expect(found.body.id).toBe(seeded.id);
    const missing = await request(app).get('/api/v1/todos/by-number/999');
    expectProblem(missing, 404, 'not_found');
    expect(missing.body.detail).toBe('No task found with that number.');
    expectProblem(await request(app).get('/api/v1/todos/by-number/0'), 400, 'validation_failed');
  });

  it('POST /batch returns {action, results} with per-item statuses', async () => {
    const active = todos.seed('u1');
    const archived = todos.seed('u1', { archived: true });
    const response = await request(app)
      .post('/api/v1/todos/batch')
      .send({ action: 'complete', ids: [active.id, archived.id, 'ghost'] });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      action: 'complete',
      results: [
        { id: active.id, status: 'completed' },
        { id: archived.id, status: 'error', reason: 'archived' },
        { id: 'ghost', status: 'not_found' },
      ],
    });
  });

  it('POST /batch validates action and ids bounds (1-100)', async () => {
    expectProblem(
      await request(app)
        .post('/api/v1/todos/batch')
        .send({ action: 'delete', ids: ['x'] }),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app).post('/api/v1/todos/batch').send({ action: 'complete', ids: [] }),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app)
        .post('/api/v1/todos/batch')
        .send({ action: 'complete', ids: Array.from({ length: 101 }, (_, i) => `id-${i}`) }),
      400,
      'validation_failed',
    );
  });
});

describe('GET/PATCH /api/v1/todos/:id', () => {
  it('GET resolves archived rows too; 404 for unknown', async () => {
    const archived = todos.seed('u1', { archived: true });
    const response = await request(app).get(`/api/v1/todos/${archived.id}`);
    expect(response.status).toBe(200);
    expect(response.body.archived).toBe(true);
    expectProblem(await request(app).get('/api/v1/todos/ghost'), 404, 'not_found');
  });

  it('PATCH updates fields; 404 unknown; 409 archived; 400 recurrence', async () => {
    const seeded = todos.seed('u1');
    const ok = await request(app)
      .patch(`/api/v1/todos/${seeded.id}`)
      .send({ title: 'Renamed', order: 3 });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ title: 'Renamed', order: 3 });

    expectProblem(
      await request(app).patch('/api/v1/todos/ghost').send({ title: 'x' }),
      404,
      'not_found',
    );

    const archived = todos.seed('u1', { archived: true });
    expectProblem(
      await request(app).patch(`/api/v1/todos/${archived.id}`).send({ title: 'x' }),
      409,
      'conflict',
    );

    const recurrence = await request(app)
      .patch(`/api/v1/todos/${seeded.id}`)
      .send({ title: 'x', recurrence: { mode: 'daily' } });
    expectProblem(recurrence, 400, 'validation_failed');
    expect(recurrence.body.detail).toBe('Recurrence cannot be changed after creation.');
  });

  it('PATCH with an empty body → 400 (at least one field)', async () => {
    const seeded = todos.seed('u1');
    expectProblem(
      await request(app).patch(`/api/v1/todos/${seeded.id}`).send({}),
      400,
      'validation_failed',
    );
  });
});

describe('lifecycle endpoints', () => {
  it('complete/uncomplete wrap the todo in {todo}; archived → 409', async () => {
    const seeded = todos.seed('u1');
    const completed = await request(app).post(`/api/v1/todos/${seeded.id}/complete`);
    expect(completed.status).toBe(200);
    expect(completed.body.todo.isCompleted).toBe(true);
    const uncompleted = await request(app).post(`/api/v1/todos/${seeded.id}/uncomplete`);
    expect(uncompleted.body.todo.isCompleted).toBe(false);

    const archived = todos.seed('u1', { archived: true });
    expectProblem(
      await request(app).post(`/api/v1/todos/${archived.id}/complete`),
      409,
      'conflict',
    );
    expectProblem(await request(app).post('/api/v1/todos/ghost/complete'), 404, 'not_found');
  });

  it('archive/restore round-trip; restore of active carries a note', async () => {
    const seeded = todos.seed('u1');
    const archived = await request(app).post(`/api/v1/todos/${seeded.id}/archive`);
    expect(archived.status).toBe(200);
    expect(archived.body.todo.archived).toBe(true);

    const restored = await request(app).post(`/api/v1/todos/${seeded.id}/restore`);
    expect(restored.status).toBe(200);
    expect(restored.body).toMatchObject({ restored: true });
    expect(restored.body.todo.archived).toBe(false);

    const again = await request(app).post(`/api/v1/todos/${seeded.id}/restore`);
    expect(again.body).toMatchObject({ restored: true, note: 'Task was already active.' });
  });

  it('DELETE /:id archives (204, tags preserved); unknown → 404', async () => {
    const seeded = todos.seed('u1', {
      tags: [{ id: 'default-work', name: 'Work', color: '#3B82F6', userId: null, isDefault: true }],
    });
    const response = await request(app).delete(`/api/v1/todos/${seeded.id}`);
    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    const row = todos.rowsFor('u1').find((todo) => todo.id === seeded.id);
    expect(row?.archived).toBe(true);
    expect(row?.tags).toHaveLength(1); // links preserved
    expectProblem(await request(app).delete('/api/v1/todos/ghost'), 404, 'not_found');
  });
});

describe('subtask routes (all return the updated todo)', () => {
  it('POST /:id/subtasks → 201 with the appended subtask', async () => {
    const seeded = todos.seed('u1');
    const response = await request(app)
      .post(`/api/v1/todos/${seeded.id}/subtasks`)
      .send({ title: 'Step 1' });
    expect(response.status).toBe(201);
    const body = response.body as Todo;
    expect(body.subtasks).toHaveLength(1);
    expect(body.subtasks[0]).toMatchObject({ title: 'Step 1', position: 1, isCompleted: false });
  });

  it('missing title → 400; unknown parent → 404; archived parent → 409', async () => {
    const seeded = todos.seed('u1');
    expectProblem(
      await request(app).post(`/api/v1/todos/${seeded.id}/subtasks`).send({}),
      400,
      'validation_failed',
    );
    expectProblem(
      await request(app).post('/api/v1/todos/ghost/subtasks').send({ title: 'x' }),
      404,
      'not_found',
    );
    const archived = todos.seed('u1', { archived: true });
    expectProblem(
      await request(app).post(`/api/v1/todos/${archived.id}/subtasks`).send({ title: 'x' }),
      409,
      'conflict',
    );
  });

  it('complete/uncomplete/update/remove by subtaskId; positions re-sequence', async () => {
    const sub = { subtaskId: 'aaaaaaaa-1111-2222-3333-444444444444' };
    const seeded = todos.seed('u1', {
      subtasks: [
        { ...sub, title: 'A', isCompleted: false, position: 1 },
        {
          subtaskId: 'bbbbbbbb-1111-2222-3333-444444444444',
          title: 'B',
          isCompleted: false,
          position: 2,
        },
      ],
    });

    const completed = await request(app).post(
      `/api/v1/todos/${seeded.id}/subtasks/${sub.subtaskId}/complete`,
    );
    expect(completed.status).toBe(200);
    expect(completed.body.subtasks[0].isCompleted).toBe(true);

    const uncompleted = await request(app).post(
      `/api/v1/todos/${seeded.id}/subtasks/${sub.subtaskId}/uncomplete`,
    );
    expect(uncompleted.body.subtasks[0].isCompleted).toBe(false);

    const renamed = await request(app)
      .patch(`/api/v1/todos/${seeded.id}/subtasks/${sub.subtaskId}`)
      .send({ title: 'Renamed' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.subtasks[0].title).toBe('Renamed');

    expectProblem(
      await request(app).patch(`/api/v1/todos/${seeded.id}/subtasks/${sub.subtaskId}`).send({}),
      400,
      'validation_failed',
    );

    const removed = await request(app).delete(
      `/api/v1/todos/${seeded.id}/subtasks/${sub.subtaskId}`,
    );
    expect(removed.status).toBe(200);
    expect(removed.body.subtasks).toHaveLength(1);
    expect(removed.body.subtasks[0]).toMatchObject({ title: 'B', position: 1 }); // re-sequenced

    expectProblem(
      await request(app).delete(`/api/v1/todos/${seeded.id}/subtasks/${sub.subtaskId}`),
      404,
      'not_found',
    );
  });
});

describe('auth guard', () => {
  it('401 problem when no current user is attached', async () => {
    const registry = new OpenApiRegistry();
    const bare = makeApp(
      '/api/v1/todos',
      buildTodosRouter({
        createTodo: new CreateTodo({ todos, tags }),
        listTodos: new ListTodos({ todos }),
        getTodo: new GetTodo({ todos }),
        updateTodo: new UpdateTodo({ todos, tags }),
        setTodoCompletion: new SetTodoCompletion({ todos }),
        archiveTodo: new ArchiveTodo({ todos }),
        batchTodos: new BatchTodos({ todos }),
        findSimilarTodos: new FindSimilarTodos({ todos }),
        subtaskOps: new SubtaskOps({ todos }),
        registry,
      }),
      null,
    );
    expectProblem(await request(bare).get('/api/v1/todos'), 401, 'unauthorized');
  });
});
