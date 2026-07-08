import type { Todo } from '@lifeline/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { TodoRepository } from '../ports.js';

export interface ArchiveTodoDeps {
  todos: TodoRepository;
}

export interface RestoreResult {
  todo: Todo;
  restored: true;
  /** Present when the task was not archived to begin with (old MCP parity). */
  note?: string;
}

/**
 * POST /api/v1/todos/:id/archive, /restore, and DELETE /todos/:id (archive
 * alias — decisions #4: tags are ALWAYS preserved, DELETE never clears
 * links). Both directions are idempotent.
 */
export class ArchiveTodo {
  constructor(private readonly deps: ArchiveTodoDeps) {}

  async archive(userId: string, id: string): Promise<Todo> {
    const existing = await this.deps.todos.findById(userId, id);
    if (existing === null) throw new NotFoundError('Task not found.');
    if (existing.archived) return existing;
    return this.deps.todos.setArchived(userId, id, true);
  }

  async restore(userId: string, id: string): Promise<RestoreResult> {
    const existing = await this.deps.todos.findById(userId, id);
    if (existing === null) throw new NotFoundError('Task not found.');
    if (!existing.archived) {
      return { todo: existing, restored: true, note: 'Task was already active.' };
    }
    const todo = await this.deps.todos.setArchived(userId, id, false);
    return { todo, restored: true };
  }
}
