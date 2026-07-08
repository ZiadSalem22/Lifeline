import type { Tag, Todo } from '@lifeline/shared';

/**
 * Normalized MCP wire payloads, ported from the old backend
 * `internal/mcp/taskPayloads.js` and `tagHandlers.js` — key set and semantics
 * identical so existing configured clients keep working. One deliberate
 * delta (per the rebuild plan): `createdAt`/`updatedAt` now carry real ISO
 * values (the old repo never mapped them, so they were always null).
 */

export interface McpSubtaskPayload {
  subtaskId: string;
  /** Legacy alias kept for old clients; equals subtaskId when absent. */
  id: string | number;
  title: string;
  isCompleted: boolean;
  position: number;
}

export interface McpTaskPayload {
  id: string;
  taskNumber: number | null;
  title: string;
  description: string;
  dueDate: string | null;
  dueTime: string | null;
  isCompleted: boolean;
  isFlagged: boolean;
  duration: number;
  priority: string;
  tags: { id: string; name: string; color: string }[];
  subtasks: McpSubtaskPayload[];
  recurrence: unknown;
  nextRecurrenceDue: string | null;
  originalId: string | null;
  archived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface McpTagPayload {
  id: string;
  name: string;
  color: string;
  userId: string | null;
  isDefault: boolean;
}

/** `''`/null → null; datetimes truncated to `YYYY-MM-DD` (old normalizeDateOnly). */
export function normalizeDateOnly(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10) || null;
  return date.toISOString().slice(0, 10);
}

function normalizeSubtaskPayload(raw: Todo['subtasks'][number]): McpSubtaskPayload {
  const withAlias = raw as { id?: string | number };
  return {
    subtaskId: raw.subtaskId,
    id: withAlias.id ?? raw.subtaskId,
    title: raw.title,
    isCompleted: raw.isCompleted,
    position: raw.position,
  };
}

export function normalizeTask(todo: Todo): McpTaskPayload {
  return {
    id: todo.id,
    taskNumber: todo.taskNumber ?? null,
    title: todo.title,
    description: todo.description ?? '',
    dueDate: normalizeDateOnly(todo.dueDate),
    dueTime: todo.dueTime ?? null,
    isCompleted: todo.isCompleted,
    isFlagged: todo.isFlagged,
    duration: Number(todo.duration ?? 0),
    priority: todo.priority ?? 'medium',
    tags: todo.tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })),
    subtasks: todo.subtasks.map(normalizeSubtaskPayload),
    recurrence: todo.recurrence ?? null,
    // Data-compat column: kept in the payload, never written by the rebuild.
    nextRecurrenceDue: (todo as { nextRecurrenceDue?: string | null }).nextRecurrenceDue ?? null,
    originalId: todo.originalId ?? null,
    archived: todo.archived,
    createdAt: todo.createdAt ?? null,
    updatedAt: todo.updatedAt ?? null,
  };
}

export function normalizeTaskList(todos: readonly Todo[]): McpTaskPayload[] {
  return todos.map(normalizeTask);
}

export function normalizeTag(tag: Tag): McpTagPayload {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    userId: tag.userId ?? null,
    isDefault: tag.isDefault,
  };
}
