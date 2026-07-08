import { api } from '../../../shared/api/client';
import type {
  BatchResult,
  BatchTodosInput,
  CreateTagInput,
  CreateTodoInput,
  Page,
  Tag,
  Todo,
  UpdateTagInput,
  UpdateTodoInput,
} from '@lifeline/shared';

/** Typed `/todos` + `/tags` endpoint functions (02-api-contract-v1.md). */

export interface ListTodosParams {
  q?: string;
  /** csv of tag ids */
  tags?: string;
  priority?: 'low' | 'medium' | 'high';
  status?: 'active' | 'completed';
  flagged?: boolean;
  startDate?: string;
  endDate?: string;
  minDuration?: number;
  maxDuration?: number;
  taskNumber?: number;
  includeArchived?: boolean;
  sortBy?: 'priority' | 'duration' | 'name' | 'date_desc';
  page?: number;
  pageSize?: number;
}

export function buildTodosQueryString(params: ListTodosParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs.length > 0 ? `?${qs}` : '';
}

export function listTodos(params: ListTodosParams = {}): Promise<Page<Todo>> {
  return api.get<Page<Todo>>(`/todos${buildTodosQueryString(params)}`);
}

export function createTodo(input: CreateTodoInput): Promise<Todo> {
  return api.post<Todo>('/todos', input);
}

export function getTodoByNumber(taskNumber: number): Promise<Todo> {
  return api.get<Todo>(`/todos/by-number/${taskNumber}`);
}

export function getSimilarTodos(
  title: string,
  limit = 5,
): Promise<{ items: Todo[]; query: string }> {
  const search = new URLSearchParams({ title, limit: String(limit) });
  return api.get<{ items: Todo[]; query: string }>(`/todos/similar?${search.toString()}`);
}

export function patchTodo(id: string, patch: UpdateTodoInput): Promise<Todo> {
  return api.patch<Todo>(`/todos/${id}`, patch);
}

export function completeTodo(id: string): Promise<{ todo: Todo }> {
  return api.post<{ todo: Todo }>(`/todos/${id}/complete`);
}

export function uncompleteTodo(id: string): Promise<{ todo: Todo }> {
  return api.post<{ todo: Todo }>(`/todos/${id}/uncomplete`);
}

/** DELETE /todos/:id is the archive alias (204). */
export function archiveTodo(id: string): Promise<void> {
  return api.del(`/todos/${id}`);
}

export function restoreTodo(id: string): Promise<unknown> {
  return api.post<unknown>(`/todos/${id}/restore`);
}

export function batchTodos(input: BatchTodosInput): Promise<BatchResult> {
  return api.post<BatchResult>('/todos/batch', input);
}

/* ── tags ─────────────────────────────────────────────────────────────────── */

export function listTags(): Promise<Tag[]> {
  return api.get<Tag[]>('/tags');
}

export function createTag(input: CreateTagInput): Promise<Tag> {
  return api.post<Tag>('/tags', input);
}

export function updateTag(id: string, patch: UpdateTagInput): Promise<Tag> {
  return api.patch<Tag>(`/tags/${id}`, patch);
}

export function deleteTag(id: string): Promise<void> {
  return api.del(`/tags/${id}`);
}
