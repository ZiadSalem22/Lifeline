import type { BatchResult, BatchTodosInput } from '@lifeline/shared';
import type { TodoRepository } from '../ports.js';

export interface BatchTodosDeps {
  todos: TodoRepository;
}

type BatchItemResult = BatchResult['results'][number];
type BatchAction = BatchTodosInput['action'];

/**
 * POST /api/v1/todos/batch — sequential per-item processing with per-item
 * statuses (adopts the old MCP batch semantics keyed by id,
 * audit-domain-logic.md §5):
 * - complete/uncomplete on an archived task → `error` with reason 'archived';
 * - archive is idempotent (`archived` either way);
 * - restore of an active task → `already_active`;
 * - unknown id → `not_found`; unexpected failures → `error` with a reason.
 */
export class BatchTodos {
  constructor(private readonly deps: BatchTodosDeps) {}

  async execute(userId: string, input: BatchTodosInput): Promise<BatchResult> {
    const results: BatchItemResult[] = [];
    for (const id of input.ids) {
      results.push(await this.processOne(userId, input.action, id));
    }
    return { action: input.action, results };
  }

  private async processOne(
    userId: string,
    action: BatchAction,
    id: string,
  ): Promise<BatchItemResult> {
    try {
      const todo = await this.deps.todos.findById(userId, id);
      if (todo === null) return { id, status: 'not_found' };
      switch (action) {
        case 'complete':
        case 'uncomplete': {
          if (todo.archived) return { id, status: 'error', reason: 'archived' };
          await this.deps.todos.setCompleted(userId, id, action === 'complete');
          return { id, status: action === 'complete' ? 'completed' : 'uncompleted' };
        }
        case 'archive': {
          if (!todo.archived) await this.deps.todos.setArchived(userId, id, true);
          return { id, status: 'archived' };
        }
        case 'restore': {
          if (!todo.archived) return { id, status: 'already_active' };
          await this.deps.todos.setArchived(userId, id, false);
          return { id, status: 'restored' };
        }
      }
    } catch (error) {
      return {
        id,
        status: 'error',
        reason: error instanceof Error ? error.message : 'Unexpected error',
      };
    }
  }
}
