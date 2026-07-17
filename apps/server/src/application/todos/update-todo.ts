import type { Todo, UpdateTodoInput } from '@lifeline/shared';
import { DomainValidationError, NotFoundError } from '../../domain/errors.js';
import { normalizeSubtasks } from '../../domain/subtask-contract.js';
import { canMutate } from '../../domain/todo-rules.js';
import type { TagRepository, TodoRepository, TodoUpdateData } from '../ports.js';
import { normalizeDueDate, normalizeDueTime, resolveTagReferenceIds } from './inputs.js';

export interface UpdateTodoDeps {
  todos: TodoRepository;
  tags: TagRepository;
}

/**
 * Router-facing input: the zod schema strips unknown keys (including
 * `recurrence`), so the router re-attaches the raw `recurrence` key when the
 * client sent one, letting this use-case reject it with the intended 400.
 */
export type UpdateTodoRequest = UpdateTodoInput & { recurrence?: unknown };

/**
 * PATCH /api/v1/todos/:id. Guard order: 404 unknown → 409 archived →
 * 400 recurrence-immutable → normalize + persist. `archived`/`isCompleted`
 * are never touched here (explicit endpoints own those transitions —
 * decisions #2). Tag links are replaced only when `tags` is present.
 */
export class UpdateTodo {
  constructor(private readonly deps: UpdateTodoDeps) {}

  async execute(userId: string, id: string, input: UpdateTodoRequest): Promise<Todo> {
    const existing = await this.deps.todos.findById(userId, id);
    if (existing === null) throw new NotFoundError('Task not found.');
    canMutate(existing);
    if ('recurrence' in input) {
      throw new DomainValidationError('Recurrence cannot be changed after creation.');
    }

    const changes: TodoUpdateData = {};
    if (input.title !== undefined) changes.title = input.title;
    if (input.description !== undefined) changes.description = input.description ?? null;
    if (input.dueDate !== undefined) changes.dueDate = normalizeDueDate(input.dueDate);
    if (input.dueTime !== undefined) changes.dueTime = normalizeDueTime(input.dueTime);
    if (input.isFlagged !== undefined) changes.isFlagged = input.isFlagged;
    if (input.duration !== undefined) changes.duration = input.duration;
    if (input.priority !== undefined) changes.priority = input.priority;
    if (input.subtasks !== undefined) changes.subtasks = normalizeSubtasks(input.subtasks);
    if (input.order !== undefined) changes.order = input.order;
    if (input.habitId !== undefined) changes.habitId = input.habitId ?? null;
    if (input.tags !== undefined) {
      changes.tagIds = await resolveTagReferenceIds(this.deps.tags, userId, input.tags);
    }
    return this.deps.todos.update(userId, id, changes);
  }
}
