import { addDays, format } from 'date-fns';
import type { Todo } from '@lifeline/shared';

/**
 * Client-side day filtering — a faithful port of the old TodoProvider
 * `filteredTodos` memo (client/src/providers/TodoProvider.jsx:175-227):
 *
 * - date filter: dueDate equals the resolved day, OR a `dateRange` recurrence
 *   span covering the day (spans have dueDate = startDate, so the plain
 *   dueDate filter alone would hide them on later days);
 * - text filter over title + description (case-insensitive substring);
 * - tag filter: every selected tag id must be present (AND semantics);
 * - sorts: date | priority | duration | name.
 *
 * Documented deltas from the old memo:
 * - `priority` sorts high > medium > low via weights. The old code compared
 *   priority strings lexicographically (medium > low > high), which put
 *   high-priority tasks last — an obvious accident, not behavior worth keeping.
 * - `date` ties break by `order` then `taskNumber`, mirroring the server's
 *   default sort, so the (now persisted) drag-drop order survives reloads.
 * - archived todos are always excluded (the server list excludes them too;
 *   this guards the guest/local path).
 */

export type SortOption = 'date' | 'priority' | 'duration' | 'name';

const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve 'today' | 'tomorrow' | 'YYYY-MM-DD' to a date-only string. */
export function resolveDayString(selectedDay: string, now: Date = new Date()): string {
  if (selectedDay === 'today') return format(now, 'yyyy-MM-dd');
  if (selectedDay === 'tomorrow') return format(addDays(now, 1), 'yyyy-MM-dd');
  return selectedDay;
}

interface RecurrenceLike {
  mode?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}

/** True when the todo is a dateRange span whose [startDate, endDate] covers dayStr. */
export function coversDay(todo: Todo, dayStr: string): boolean {
  const rec = todo.recurrence as RecurrenceLike | null;
  if (!rec || rec.mode !== 'dateRange') return false;
  const start =
    typeof rec.startDate === 'string' && rec.startDate.length > 0 ? rec.startDate : todo.dueDate;
  const end =
    typeof rec.endDate === 'string' && rec.endDate.length > 0 ? rec.endDate : todo.dueDate;
  if (!start || !end) return false;
  return dayStr >= start && dayStr <= end;
}

/** Day membership: exact dueDate match or dateRange span coverage. */
export function matchesDay(todo: Todo, selectedDay: string, now: Date = new Date()): boolean {
  const dayStr = resolveDayString(selectedDay, now);
  // Non-date tokens fall back to "show everything" (old 'All Tasks' behavior).
  if (!DATE_ONLY_RE.test(dayStr)) return true;
  return todo.dueDate === dayStr || coversDay(todo, dayStr);
}

export function sortTodos(todos: readonly Todo[], sort: SortOption): Todo[] {
  const list = [...todos];
  switch (sort) {
    case 'priority':
      list.sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 2) - (PRIORITY_WEIGHT[a.priority] ?? 2));
      break;
    case 'duration':
      list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      break;
    case 'name':
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    default:
      list.sort((a, b) => {
        const byDate = (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
        if (byDate !== 0) return byDate;
        if (a.order !== b.order) return a.order - b.order;
        return a.taskNumber - b.taskNumber;
      });
  }
  return list;
}

export interface DayFilterOptions {
  query?: string;
  tagIds?: readonly string[];
  sort?: SortOption;
  now?: Date;
}

export function filterTodosForDay(
  todos: readonly Todo[],
  selectedDay: string,
  options: DayFilterOptions = {},
): Todo[] {
  const { query = '', tagIds = [], sort = 'date', now = new Date() } = options;
  const q = query.trim().toLowerCase();
  const filtered = todos.filter((todo) => {
    if (todo.archived) return false;
    if (!matchesDay(todo, selectedDay, now)) return false;
    if (
      q.length > 0 &&
      !todo.title.toLowerCase().includes(q) &&
      !(todo.description ?? '').toLowerCase().includes(q)
    ) {
      return false;
    }
    if (tagIds.length > 0 && !tagIds.every((id) => todo.tags.some((tag) => tag.id === id))) {
      return false;
    }
    return true;
  });
  return sortTodos(filtered, sort);
}

/** Home list regroup: incomplete first, preserving in-group order (App.jsx:549-557). */
export function regroupIncompleteFirst(todos: readonly Todo[]): Todo[] {
  const incomplete: Todo[] = [];
  const complete: Todo[] = [];
  for (const todo of todos) {
    (todo.isCompleted ? complete : incomplete).push(todo);
  }
  return [...incomplete, ...complete];
}

/**
 * Hero "N of M completed" numerator — the old app counted completions over the
 * DATE-filtered list only (ignoring tag/text filters; App.jsx:514-543).
 */
export function completedCountForDay(
  todos: readonly Todo[],
  selectedDay: string,
  now: Date = new Date(),
): number {
  return todos
    .filter((todo) => !todo.archived && matchesDay(todo, selectedDay, now))
    .filter((todo) => todo.isCompleted).length;
}

export function totalDurationMinutes(todos: readonly Todo[]): number {
  return todos.reduce((acc, todo) => acc + (todo.duration || 0), 0);
}
