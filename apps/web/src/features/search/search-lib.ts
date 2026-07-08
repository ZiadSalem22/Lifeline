import {
  addDays,
  format,
  isSameYear,
  isThisWeek,
  isToday,
  isTomorrow,
  isValid,
  isYesterday,
  parseISO,
} from 'date-fns';
import type { Todo } from '@lifeline/shared';
import type { ListTodosParams } from '../todos/data/api';

/**
 * Advanced-search engine helpers — a faithful port of the old
 * components/search/AdvancedSearch.jsx filter/sort/grouping logic, extracted
 * pure so both the component and tests share one implementation.
 *
 * Documented deltas from the old component:
 * - the old client-side `filtered` memo never applied the priority filter
 *   (the "High Priority" quick filter only worked in server mode) — fixed;
 * - archived todos are excluded client-side unless `includeArchived` (the old
 *   client had no archive concept; decision 05 adds the archived view).
 */

export type SearchSort = 'date_desc' | 'date_asc' | 'priority' | 'duration' | 'name';

export interface SearchFilters {
  q: string;
  taskNumber: string;
  tagIds: string[];
  priority: 'any' | 'low' | 'medium' | 'high';
  status: 'any' | 'active' | 'completed';
  flaggedOnly: boolean;
  startDate: string;
  endDate: string;
  minDuration: string;
  maxDuration: string;
  includeArchived: boolean;
  sortBy: SearchSort;
}

export const EMPTY_FILTERS: SearchFilters = {
  q: '',
  taskNumber: '',
  tagIds: [],
  priority: 'any',
  status: 'any',
  flaggedOnly: false,
  startDate: '',
  endDate: '',
  minDuration: '',
  maxDuration: '',
  includeArchived: false,
  sortBy: 'date_desc',
};

export function hasActiveFilters(filters: SearchFilters): boolean {
  return (
    filters.q.trim().length > 0 ||
    filters.taskNumber !== '' ||
    filters.tagIds.length > 0 ||
    filters.priority !== 'any' ||
    filters.status !== 'any' ||
    filters.flaggedOnly ||
    filters.startDate !== '' ||
    filters.endDate !== '' ||
    filters.minDuration !== '' ||
    filters.maxDuration !== '' ||
    filters.includeArchived
  );
}

/**
 * Filter state → GET /todos query params. UI 'date_asc' maps to the server's
 * default sort (dueDate ASC), so no sortBy param is sent for it.
 */
export function buildSearchParams(
  filters: SearchFilters,
  page: number,
  pageSize: number,
): ListTodosParams {
  const params: ListTodosParams = { page, pageSize };
  const q = filters.q.trim();
  if (q) params.q = q;
  if (filters.tagIds.length > 0) params.tags = filters.tagIds.join(',');
  if (filters.priority !== 'any') params.priority = filters.priority;
  if (filters.status !== 'any') params.status = filters.status;
  if (filters.flaggedOnly) params.flagged = true;
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;
  const min = Number.parseInt(filters.minDuration, 10);
  if (!Number.isNaN(min)) params.minDuration = min;
  const max = Number.parseInt(filters.maxDuration, 10);
  if (!Number.isNaN(max)) params.maxDuration = max;
  const taskNumber = Number.parseInt(filters.taskNumber, 10);
  if (!Number.isNaN(taskNumber)) params.taskNumber = taskNumber;
  if (filters.includeArchived) params.includeArchived = true;
  if (filters.sortBy !== 'date_asc') {
    params.sortBy = filters.sortBy === 'date_desc' ? 'date_desc' : filters.sortBy;
  }
  return params;
}

/** Free-text match over title / description / subtask titles / task number. */
export function matchesQuery(todo: Todo, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (todo.title.toLowerCase().includes(q)) return true;
  if ((todo.description ?? '').toLowerCase().includes(q)) return true;
  if (todo.subtasks.some((subtask) => subtask.title.toLowerCase().includes(q))) return true;
  const cleanQ = q.replace(/^#/, '').trim();
  return cleanQ.length > 0 && String(todo.taskNumber).includes(cleanQ);
}

export function sortSearchTodos(todos: readonly Todo[], sortBy: SearchSort): Todo[] {
  const list = [...todos];
  const weight: Record<string, number> = { high: 3, medium: 2, low: 1 };
  switch (sortBy) {
    case 'priority':
      list.sort((a, b) => (weight[b.priority] ?? 2) - (weight[a.priority] ?? 2));
      break;
    case 'duration':
      list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
      break;
    case 'name':
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'date_desc':
      list.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return b.dueDate.localeCompare(a.dueDate);
      });
      break;
    default:
      list.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }
  return list;
}

/** Old AdvancedSearch `filtered` memo (guest mode / browse mode filtering). */
export function filterTodosClient(todos: readonly Todo[], filters: SearchFilters): Todo[] {
  let out = todos.filter((todo) => filters.includeArchived || !todo.archived);

  if (filters.q.trim()) out = out.filter((todo) => matchesQuery(todo, filters.q));

  const taskNumber = Number.parseInt(filters.taskNumber, 10);
  if (!Number.isNaN(taskNumber)) out = out.filter((todo) => todo.taskNumber === taskNumber);

  if (filters.tagIds.length > 0) {
    // OR semantics — any selected tag matches (old search behavior; the day
    // view uses AND, search uses ANY).
    out = out.filter((todo) => todo.tags.some((tag) => filters.tagIds.includes(tag.id)));
  }
  if (filters.priority !== 'any') out = out.filter((todo) => todo.priority === filters.priority);
  if (filters.status !== 'any') {
    out = out.filter((todo) =>
      filters.status === 'completed' ? todo.isCompleted : !todo.isCompleted,
    );
  }
  if (filters.flaggedOnly) out = out.filter((todo) => todo.isFlagged);
  if (filters.startDate) {
    out = out.filter((todo) => todo.dueDate !== null && todo.dueDate >= filters.startDate);
  }
  if (filters.endDate) {
    out = out.filter((todo) => todo.dueDate !== null && todo.dueDate <= filters.endDate);
  }
  const min = Number.parseInt(filters.minDuration, 10);
  if (!Number.isNaN(min)) out = out.filter((todo) => (todo.duration || 0) >= min);
  const max = Number.parseInt(filters.maxDuration, 10);
  if (!Number.isNaN(max)) out = out.filter((todo) => (todo.duration || 0) <= max);

  return sortSearchTodos(out, filters.sortBy);
}

export const PREVIEW_LIMIT = 50;

/** Client "Preview" over the prefetched month cache (q >= 2 chars, ≤ 50 rows). */
export function clientPreview(monthTodos: readonly Todo[], query: string): Todo[] {
  if (query.trim().length < 2) return [];
  return monthTodos.filter((todo) => matchesQuery(todo, query)).slice(0, PREVIEW_LIMIT);
}

/** "This Week"/"Older" grouping — only when sorted by date (old behavior). */
export function groupThisWeekOlder(
  todos: readonly Todo[],
  sortBy: SearchSort,
): { grouped: boolean; thisWeek: Todo[]; older: Todo[] } {
  const shouldGroup =
    (sortBy === 'date_desc' || sortBy === 'date_asc') && todos.some((todo) => todo.dueDate);
  if (!shouldGroup) return { grouped: false, thisWeek: [], older: [] };
  const thisWeek: Todo[] = [];
  const older: Todo[] = [];
  for (const todo of todos) {
    const parsed = todo.dueDate ? parseISO(todo.dueDate) : null;
    if (parsed && isValid(parsed) && isThisWeek(parsed)) thisWeek.push(todo);
    else older.push(todo);
  }
  return { grouped: true, thisWeek, older };
}

/** Date pill label: Today / Tomorrow / Yesterday / MMM d (+ year off-year). */
export function formatDueDateLabel(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  const parsed = parseISO(dateStr);
  if (!isValid(parsed)) return 'No date';
  if (isToday(parsed)) return 'Today';
  if (isTomorrow(parsed)) return 'Tomorrow';
  if (isYesterday(parsed)) return 'Yesterday';
  return format(parsed, isSameYear(parsed, new Date()) ? 'MMM d' : 'MMM d, yyyy');
}

/**
 * Row-selection reducer: plain click toggles the id; shift-click merges the
 * anchor→index range into the selection (old handleRowClick).
 */
export function applyRowSelection(
  selectedIds: readonly string[],
  visibleIds: readonly string[],
  index: number,
  shiftKey: boolean,
  anchorIndex: number | null,
): { selectedIds: string[]; anchorIndex: number } {
  if (shiftKey && anchorIndex !== null) {
    const start = Math.min(anchorIndex, index);
    const end = Math.max(anchorIndex, index);
    const rangeIds = visibleIds.slice(start, end + 1);
    return { selectedIds: [...new Set([...selectedIds, ...rangeIds])], anchorIndex };
  }
  const id = visibleIds[index];
  if (id === undefined) return { selectedIds: [...selectedIds], anchorIndex: index };
  return {
    selectedIds: selectedIds.includes(id)
      ? selectedIds.filter((selected) => selected !== id)
      : [...selectedIds, id],
    anchorIndex: index,
  };
}

/** '/day/:token' route token for a date (today/tomorrow collapse, old handleGoToDay). */
export function dayRouteToken(dateStr: string, now: Date = new Date()): string {
  const clean = dateStr.includes('T') ? (dateStr.split('T')[0] ?? dateStr) : dateStr;
  const today = format(now, 'yyyy-MM-dd');
  const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
  if (clean === today) return 'today';
  if (clean === tomorrow) return 'tomorrow';
  return clean;
}
