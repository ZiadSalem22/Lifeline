import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  addSubtaskSchema,
  batchResultSchema,
  batchTodosSchema,
  createTodoSchema,
  listTodosQuerySchema,
  pageOf,
  problemSchema,
  similarTodosQuerySchema,
  todoSchema,
  updateSubtaskSchema,
  updateTodoSchema,
  type BatchTodosInput,
  type CreateTodoInput,
  type ListTodosQuery,
  type SimilarTodosQuery,
  type UpdateTodoInput,
} from '@lifeline/shared';
import { UnauthorizedError } from '../../domain/errors.js';
import type { ArchiveTodo } from '../../application/todos/archive-todo.js';
import type { BatchTodos } from '../../application/todos/batch-todos.js';
import type { CreateTodo } from '../../application/todos/create-todo.js';
import type { FindSimilarTodos } from '../../application/todos/find-similar-todos.js';
import type { GetTodo } from '../../application/todos/get-todo.js';
import type { ListTodos } from '../../application/todos/list-todos.js';
import type { SetTodoCompletion } from '../../application/todos/set-todo-completion.js';
import type { SubtaskOps } from '../../application/todos/subtask-ops.js';
import type { UpdateTodo, UpdateTodoRequest } from '../../application/todos/update-todo.js';
import { getValidated, validate } from '../middleware/validate.js';
import type { OpenApiRegistry } from '../openapi/registry.js';

export interface TodosRouterDeps {
  createTodo: CreateTodo;
  listTodos: ListTodos;
  getTodo: GetTodo;
  updateTodo: UpdateTodo;
  setTodoCompletion: SetTodoCompletion;
  archiveTodo: ArchiveTodo;
  batchTodos: BatchTodos;
  findSimilarTodos: FindSimilarTodos;
  subtaskOps: SubtaskOps;
  registry: OpenApiRegistry;
  /** Optional extra rate limiter (app.ts already mounts the todos limiter). */
  limiter?: RequestHandler | undefined;
}

const idParamsSchema = z.object({ id: z.string().min(1) });
const taskNumberParamsSchema = z.object({ taskNumber: z.coerce.number().int().min(1) });
const subtaskParamsSchema = z.object({
  id: z.string().min(1),
  subtaskId: z.string().min(1),
});

type IdParams = z.infer<typeof idParamsSchema>;
type TaskNumberParams = z.infer<typeof taskNumberParamsSchema>;
type SubtaskParams = z.infer<typeof subtaskParamsSchema>;
type AddSubtaskInput = z.infer<typeof addSubtaskSchema>;
type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>;

const todoEnvelopeSchema = z.object({ todo: todoSchema });
const restoreResponseSchema = z.object({
  todo: todoSchema,
  restored: z.literal(true),
  note: z.string().optional(),
});
const similarResponseSchema = z.object({ items: z.array(todoSchema), query: z.string() });

/**
 * Todos feature router (mounted at /api/v1/todos). Route registration order
 * matters: `/similar`, `/by-number/:taskNumber`, and `/batch` are registered
 * BEFORE the `/:id` matchers.
 */
export function buildTodosRouter(deps: TodosRouterDeps): Router {
  const router = Router();
  if (deps.limiter !== undefined) router.use(deps.limiter);
  registerOpenApi(deps.registry);

  router.get('/', validate(listTodosQuerySchema, 'query'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const query = getValidated<ListTodosQuery>(req, 'query');
    res.json(await deps.listTodos.execute(user.id, query));
  });

  router.post('/', validate(createTodoSchema), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const input = getValidated<CreateTodoInput>(req);
    const { todo, createdCount } = await deps.createTodo.execute(user.id, user.role, input);
    res.status(201).set('X-Total-Created', String(createdCount)).json(todo);
  });

  router.get('/similar', validate(similarTodosQuerySchema, 'query'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const query = getValidated<SimilarTodosQuery>(req, 'query');
    res.json(await deps.findSimilarTodos.execute(user.id, query));
  });

  router.get(
    '/by-number/:taskNumber',
    validate(taskNumberParamsSchema, 'params'),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { taskNumber } = getValidated<TaskNumberParams>(req, 'params');
      res.json(await deps.getTodo.byTaskNumber(user.id, taskNumber));
    },
  );

  router.post('/batch', validate(batchTodosSchema), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const input = getValidated<BatchTodosInput>(req);
    res.json(await deps.batchTodos.execute(user.id, input));
  });

  router.get('/:id', validate(idParamsSchema, 'params'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { id } = getValidated<IdParams>(req, 'params');
    res.json(await deps.getTodo.byId(user.id, id));
  });

  router.patch(
    '/:id',
    validate(idParamsSchema, 'params'),
    validate(updateTodoSchema),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { id } = getValidated<IdParams>(req, 'params');
      const body = getValidated<UpdateTodoInput>(req);
      // The schema strips unknown keys, so a client-sent `recurrence` must be
      // re-attached from the raw body for the use-case's immutability guard.
      const raw: unknown = req.body;
      const input: UpdateTodoRequest =
        raw !== null && typeof raw === 'object' && 'recurrence' in raw
          ? { ...body, recurrence: (raw as { recurrence?: unknown }).recurrence }
          : body;
      res.json(await deps.updateTodo.execute(user.id, id, input));
    },
  );

  router.post('/:id/complete', validate(idParamsSchema, 'params'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { id } = getValidated<IdParams>(req, 'params');
    res.json({ todo: await deps.setTodoCompletion.execute(user.id, id, true) });
  });

  router.post('/:id/uncomplete', validate(idParamsSchema, 'params'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { id } = getValidated<IdParams>(req, 'params');
    res.json({ todo: await deps.setTodoCompletion.execute(user.id, id, false) });
  });

  router.post('/:id/archive', validate(idParamsSchema, 'params'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { id } = getValidated<IdParams>(req, 'params');
    res.json({ todo: await deps.archiveTodo.archive(user.id, id) });
  });

  router.post('/:id/restore', validate(idParamsSchema, 'params'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { id } = getValidated<IdParams>(req, 'params');
    res.json(await deps.archiveTodo.restore(user.id, id));
  });

  // DELETE = archive alias (decisions #4); unknown ids 404 (v1 delta from the
  // old silent no-op).
  router.delete('/:id', validate(idParamsSchema, 'params'), async (req, res) => {
    const user = requireCurrentUser(req.currentUser);
    const { id } = getValidated<IdParams>(req, 'params');
    await deps.archiveTodo.archive(user.id, id);
    res.status(204).send();
  });

  router.post(
    '/:id/subtasks',
    validate(idParamsSchema, 'params'),
    validate(addSubtaskSchema),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { id } = getValidated<IdParams>(req, 'params');
      const { title } = getValidated<AddSubtaskInput>(req);
      res.status(201).json(await deps.subtaskOps.add(user.id, id, title));
    },
  );

  router.patch(
    '/:id/subtasks/:subtaskId',
    validate(subtaskParamsSchema, 'params'),
    validate(updateSubtaskSchema),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { id, subtaskId } = getValidated<SubtaskParams>(req, 'params');
      const patch = getValidated<UpdateSubtaskInput>(req);
      res.json(
        await deps.subtaskOps.update(user.id, id, subtaskId, {
          title: patch.title,
          isCompleted: patch.isCompleted,
        }),
      );
    },
  );

  router.delete(
    '/:id/subtasks/:subtaskId',
    validate(subtaskParamsSchema, 'params'),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { id, subtaskId } = getValidated<SubtaskParams>(req, 'params');
      res.json(await deps.subtaskOps.remove(user.id, id, subtaskId));
    },
  );

  router.post(
    '/:id/subtasks/:subtaskId/complete',
    validate(subtaskParamsSchema, 'params'),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { id, subtaskId } = getValidated<SubtaskParams>(req, 'params');
      res.json(await deps.subtaskOps.setCompletion(user.id, id, subtaskId, true));
    },
  );

  router.post(
    '/:id/subtasks/:subtaskId/uncomplete',
    validate(subtaskParamsSchema, 'params'),
    async (req, res) => {
      const user = requireCurrentUser(req.currentUser);
      const { id, subtaskId } = getValidated<SubtaskParams>(req, 'params');
      res.json(await deps.subtaskOps.setCompletion(user.id, id, subtaskId, false));
    },
  );

  return router;
}

function requireCurrentUser<T extends { id: string }>(user: T | null | undefined): T {
  if (!user?.id) throw new UnauthorizedError();
  return user;
}

function registerOpenApi(registry: OpenApiRegistry): void {
  const tag = 'todos';
  const problem = (description: string) => ({ description, schema: problemSchema });

  registry.register({
    method: 'get',
    path: '/api/v1/todos',
    summary: 'List/search todos (filters + pagination; archived excluded by default)',
    tag,
    request: { query: listTodosQuerySchema },
    responses: {
      '200': { description: 'Paginated todos', schema: pageOf(todoSchema) },
      '400': problem('Validation failed'),
      '401': problem('Not authenticated'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/todos',
    summary:
      'Create a todo (recurrence pre-expands; first row returned, X-Total-Created carries the count)',
    tag,
    request: { body: createTodoSchema },
    responses: {
      '201': { description: 'First created todo', schema: todoSchema },
      '400': problem('Validation failed'),
      '403': problem('Free tier max tasks reached'),
    },
  });
  registry.register({
    method: 'get',
    path: '/api/v1/todos/similar',
    summary: 'Find similar todos by title (pg_trgm similarity)',
    tag,
    request: { query: similarTodosQuerySchema },
    responses: {
      '200': { description: 'Similar todos', schema: similarResponseSchema },
      '400': problem('Validation failed'),
    },
  });
  registry.register({
    method: 'get',
    path: '/api/v1/todos/by-number/:taskNumber',
    summary: 'Fetch a todo by its per-user task number (archived resolvable)',
    tag,
    request: { params: taskNumberParamsSchema },
    responses: {
      '200': { description: 'Todo', schema: todoSchema },
      '404': problem('No task with that number'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/todos/batch',
    summary: 'Batch complete/uncomplete/archive/restore with per-item results',
    tag,
    request: { body: batchTodosSchema },
    responses: {
      '200': { description: 'Per-item results', schema: batchResultSchema },
      '400': problem('Validation failed'),
    },
  });
  registry.register({
    method: 'get',
    path: '/api/v1/todos/:id',
    summary: 'Fetch a todo by id (archived resolvable)',
    tag,
    request: { params: idParamsSchema },
    responses: {
      '200': { description: 'Todo', schema: todoSchema },
      '404': problem('Not found'),
    },
  });
  registry.register({
    method: 'patch',
    path: '/api/v1/todos/:id',
    summary: 'Partial update (recurrence immutable → 400; archived → 409)',
    tag,
    request: { params: idParamsSchema, body: updateTodoSchema },
    responses: {
      '200': { description: 'Updated todo', schema: todoSchema },
      '400': problem('Validation failed / recurrence immutable'),
      '404': problem('Not found'),
      '409': problem('Task is archived'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/todos/:id/complete',
    summary: 'Mark completed (archived → 409)',
    tag,
    request: { params: idParamsSchema },
    responses: {
      '200': { description: 'Updated todo', schema: todoEnvelopeSchema },
      '404': problem('Not found'),
      '409': problem('Task is archived'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/todos/:id/uncomplete',
    summary: 'Mark not completed (archived → 409)',
    tag,
    request: { params: idParamsSchema },
    responses: {
      '200': { description: 'Updated todo', schema: todoEnvelopeSchema },
      '404': problem('Not found'),
      '409': problem('Task is archived'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/todos/:id/archive',
    summary: 'Archive (idempotent; tag links preserved)',
    tag,
    request: { params: idParamsSchema },
    responses: {
      '200': { description: 'Archived todo', schema: todoEnvelopeSchema },
      '404': problem('Not found'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/todos/:id/restore',
    summary: 'Restore an archived todo (idempotent; note set when already active)',
    tag,
    request: { params: idParamsSchema },
    responses: {
      '200': { description: 'Restored todo', schema: restoreResponseSchema },
      '404': problem('Not found'),
    },
  });
  registry.register({
    method: 'delete',
    path: '/api/v1/todos/:id',
    summary: 'Soft delete (alias of archive; tags preserved)',
    tag,
    request: { params: idParamsSchema },
    responses: {
      '204': { description: 'Archived' },
      '404': problem('Not found'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/todos/:id/subtasks',
    summary: 'Add a subtask (max 50 per task); returns the updated todo',
    tag,
    request: { params: idParamsSchema, body: addSubtaskSchema },
    responses: {
      '201': { description: 'Updated todo', schema: todoSchema },
      '400': problem('Validation failed'),
      '404': problem('Not found'),
      '409': problem('Task is archived'),
    },
  });
  registry.register({
    method: 'patch',
    path: '/api/v1/todos/:id/subtasks/:subtaskId',
    summary: 'Update a subtask title/completion; returns the updated todo',
    tag,
    request: { params: subtaskParamsSchema, body: updateSubtaskSchema },
    responses: {
      '200': { description: 'Updated todo', schema: todoSchema },
      '400': problem('Validation failed'),
      '404': problem('Todo or subtask not found'),
      '409': problem('Task is archived'),
    },
  });
  registry.register({
    method: 'delete',
    path: '/api/v1/todos/:id/subtasks/:subtaskId',
    summary: 'Remove a subtask; returns the updated todo',
    tag,
    request: { params: subtaskParamsSchema },
    responses: {
      '200': { description: 'Updated todo', schema: todoSchema },
      '404': problem('Todo or subtask not found'),
      '409': problem('Task is archived'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/todos/:id/subtasks/:subtaskId/complete',
    summary: 'Complete a subtask; returns the updated todo',
    tag,
    request: { params: subtaskParamsSchema },
    responses: {
      '200': { description: 'Updated todo', schema: todoSchema },
      '404': problem('Todo or subtask not found'),
      '409': problem('Task is archived'),
    },
  });
  registry.register({
    method: 'post',
    path: '/api/v1/todos/:id/subtasks/:subtaskId/uncomplete',
    summary: 'Un-complete a subtask; returns the updated todo',
    tag,
    request: { params: subtaskParamsSchema },
    responses: {
      '200': { description: 'Updated todo', schema: todoSchema },
      '404': problem('Todo or subtask not found'),
      '409': problem('Task is archived'),
    },
  });
}
