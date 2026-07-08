import type { Todo } from '@lifeline/shared';
import { NotFoundError } from '../../domain/errors.js';
import { canMutate } from '../../domain/todo-rules.js';
import type { TodoRepository } from '../ports.js';

export interface SetTodoCompletionDeps {
  todos: TodoRepository;
}

/**
 * POST /api/v1/todos/:id/complete and /uncomplete. Archived tasks reject the
 * transition with 409 (fixes old bug #2 where the guard never fired).
 */
export class SetTodoCompletion {
  constructor(private readonly deps: SetTodoCompletionDeps) {}

  async execute(userId: string, id: string, isCompleted: boolean): Promise<Todo> {
    const existing = await this.deps.todos.findById(userId, id);
    if (existing === null) throw new NotFoundError('Task not found.');
    canMutate(existing);
    return this.deps.todos.setCompleted(userId, id, isCompleted);
  }
}
