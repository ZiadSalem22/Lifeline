import type { SimilarTodosQuery, Todo } from '@lifeline/shared';
import type { TodoRepository } from '../ports.js';

export interface FindSimilarTodosDeps {
  todos: TodoRepository;
}

export interface SimilarTodosResult {
  items: Todo[];
  query: string;
}

/**
 * GET /api/v1/todos/similar — pg_trgm similarity over titles (was MCP-only in
 * the old app; archived rows are included, audit-domain-logic.md §6).
 */
export class FindSimilarTodos {
  constructor(private readonly deps: FindSimilarTodosDeps) {}

  async execute(userId: string, query: SimilarTodosQuery): Promise<SimilarTodosResult> {
    const items = await this.deps.todos.findSimilarByTitle(
      userId,
      query.title,
      query.limit,
      query.threshold,
    );
    return { items, query: query.title };
  }
}
