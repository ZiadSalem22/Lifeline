import type { Todo } from '@lifeline/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { TodoRepository } from '../ports.js';

export interface GetTodoDeps {
  todos: TodoRepository;
}

/**
 * GET /api/v1/todos/:id and /todos/by-number/:taskNumber. Both resolve
 * archived rows too (old-app parity — archive is a soft state, not deletion).
 */
export class GetTodo {
  constructor(private readonly deps: GetTodoDeps) {}

  async byId(userId: string, id: string): Promise<Todo> {
    const todo = await this.deps.todos.findById(userId, id);
    if (todo === null) throw new NotFoundError('Task not found.');
    return todo;
  }

  async byTaskNumber(userId: string, taskNumber: number): Promise<Todo> {
    const todo = await this.deps.todos.findByTaskNumber(userId, taskNumber);
    if (todo === null) throw new NotFoundError('No task found with that number.');
    return todo;
  }
}
