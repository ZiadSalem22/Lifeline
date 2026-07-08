import type { ListTodosQuery, Page, Todo } from '@lifeline/shared';
import type { TodoRepository } from '../ports.js';

export interface ListTodosDeps {
  todos: TodoRepository;
}

/** GET /api/v1/todos — filtered, paginated `{items, page, pageSize, totalItems, totalPages}`. */
export class ListTodos {
  constructor(private readonly deps: ListTodosDeps) {}

  async execute(userId: string, filters: ListTodosQuery): Promise<Page<Todo>> {
    const { items, totalItems } = await this.deps.todos.list(userId, filters);
    return {
      items,
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / filters.pageSize),
    };
  }
}
