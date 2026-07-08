import type { Todo } from '@lifeline/shared';
import { NotFoundError } from '../../domain/errors.js';
import {
  addSubtask,
  normalizeSubtasks,
  removeSubtask,
  setSubtaskCompletion,
  updateSubtask,
  type SubtaskPatch,
  type SubtaskRecord,
} from '../../domain/subtask-contract.js';
import { canMutate } from '../../domain/todo-rules.js';
import type { TodoRepository } from '../ports.js';

export interface SubtaskOpsDeps {
  todos: TodoRepository;
}

/**
 * Per-subtask operations (add/complete/uncomplete/update/remove). Each op
 * loads the parent (404), rejects archived parents (409), applies the domain
 * subtask-contract helper, and persists the whole normalized array (the
 * stable-identity contract, ADR-0003 / audit-domain-logic.md §3). Every op
 * returns the updated parent todo.
 */
export class SubtaskOps {
  constructor(private readonly deps: SubtaskOpsDeps) {}

  async add(userId: string, todoId: string, title: string): Promise<Todo> {
    const current = await this.loadMutable(userId, todoId);
    return this.save(userId, todoId, addSubtask(current, title));
  }

  async setCompletion(
    userId: string,
    todoId: string,
    subtaskId: string,
    isCompleted: boolean,
  ): Promise<Todo> {
    const current = await this.loadMutable(userId, todoId);
    return this.save(userId, todoId, setSubtaskCompletion(current, subtaskId, isCompleted));
  }

  async update(
    userId: string,
    todoId: string,
    subtaskId: string,
    patch: SubtaskPatch,
  ): Promise<Todo> {
    const current = await this.loadMutable(userId, todoId);
    return this.save(userId, todoId, updateSubtask(current, subtaskId, patch));
  }

  async remove(userId: string, todoId: string, subtaskId: string): Promise<Todo> {
    const current = await this.loadMutable(userId, todoId);
    return this.save(userId, todoId, removeSubtask(current, subtaskId));
  }

  /** Load the parent's subtasks as canonical records; 404 unknown, 409 archived. */
  private async loadMutable(userId: string, todoId: string): Promise<SubtaskRecord[]> {
    const todo = await this.deps.todos.findById(userId, todoId);
    if (todo === null) throw new NotFoundError('Task not found.');
    canMutate(todo);
    return normalizeSubtasks(todo.subtasks);
  }

  private save(userId: string, todoId: string, subtasks: SubtaskRecord[]): Promise<Todo> {
    return this.deps.todos.update(userId, todoId, { subtasks });
  }
}
