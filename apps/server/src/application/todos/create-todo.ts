import { LIMITS, type CreateTodoInput, type Role, type Todo } from '@lifeline/shared';
import { expandRecurrenceDates } from '../../domain/recurrence.js';
import { normalizeSubtasks } from '../../domain/subtask-contract.js';
import { assertActiveTodoCapacity } from '../../domain/todo-rules.js';
import type { CreateTodoOptions, NewTodoData, TagRepository, TodoRepository } from '../ports.js';
import { normalizeDueDate, normalizeDueTime, resolveTagReferenceIds } from './inputs.js';

export interface CreateTodoDeps {
  todos: TodoRepository;
  tags: TagRepository;
}

export interface CreateTodoResult {
  /** The first created todo (the only one for non-recurring creates). */
  todo: Todo;
  /** Total rows created (recurrence pre-expansion may add many). */
  createdCount: number;
}

/**
 * POST /api/v1/todos. Recurrence is pre-expanded at creation (old-app
 * semantics, audit-domain-logic.md §2): every occurrence becomes its own row
 * with its own task number, carrying a copy of the recurrence object and the
 * SAME normalized subtasks array (same subtaskIds on every row — parity).
 * The free-tier cap counts all rows the create would add.
 */
export class CreateTodo {
  constructor(private readonly deps: CreateTodoDeps) {}

  async execute(userId: string, role: Role, input: CreateTodoInput): Promise<CreateTodoResult> {
    const subtasks = normalizeSubtasks(input.subtasks);
    const dueDate = normalizeDueDate(input.dueDate);
    const dueTime = normalizeDueTime(input.dueTime);
    const tagIds = await resolveTagReferenceIds(this.deps.tags, userId, input.tags);
    const recurrence = input.recurrence ?? null;
    const occurrenceDates =
      recurrence === null ? [dueDate] : expandRecurrenceDates(recurrence, dueDate);

    // Friendly pre-check: fail fast without touching the DB write path. The
    // AUTHORITATIVE cap check runs INSIDE the create transaction (via
    // createOptions.activeCap) so concurrent creates can't jointly exceed it
    // (confirmed-findings-round1 #4).
    const activeCount = await this.deps.todos.countActiveByUser(userId);
    assertActiveTodoCapacity(role, activeCount, occurrenceDates.length);

    // Only free users are capped; paid/admin skip (undefined = no cap).
    const createOptions: CreateTodoOptions =
      role === 'free' ? { activeCap: LIMITS.freeTierActiveTodosMax } : {};

    const rows: NewTodoData[] = occurrenceDates.map((occurrenceDate) => ({
      title: input.title,
      description: input.description ?? null,
      dueDate: occurrenceDate,
      dueTime,
      isFlagged: input.isFlagged ?? false,
      duration: input.duration ?? 0,
      priority: input.priority ?? 'medium',
      subtasks,
      order: 0,
      recurrence,
      // The habit link rides on every expanded occurrence — a recurring task
      // drives its habit each day it recurs.
      habitId: input.habitId ?? null,
      originalId: null,
      tagIds,
    }));

    const first = rows[0];
    const created =
      rows.length === 1 && first !== undefined
        ? [await this.deps.todos.create(userId, first, createOptions)]
        : await this.deps.todos.createMany(userId, rows, createOptions);
    const todo = created[0];
    if (todo === undefined) throw new Error('Todo creation returned no rows');
    return { todo, createdCount: created.length };
  }
}
