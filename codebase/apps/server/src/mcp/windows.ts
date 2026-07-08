import type { DayName, Todo } from '@lifeline/shared';
import { DAY_NAMES } from '@lifeline/shared';
import { McpToolInputError } from './errors.js';
import { formatDateOnly } from './due-date.js';
import { normalizeDateOnly } from './payloads.js';

/**
 * Date/day/window computations for the MCP read tools, ported from the old
 * backend `internal/mcp/taskDateFilters.js` with two rebuild deltas:
 * - all math is UTC (the old date-fns helpers used server-local time);
 * - week windows honor the user's start-day-of-week preference (the old code
 *   hardcoded `weekStartsOn = 0` — audit-mcp.md §8.2).
 */

export const ISO_DATE_TOKEN_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YYYY_MM_PATTERN = /^\d{4}-\d{2}$/;

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcWeek(date: Date, weekStartsOn: number): Date {
  const day = date.getUTCDay();
  const diff = (day - weekStartsOn + 7) % 7;
  const start = addUtcDays(date, -diff);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function startOfUtcMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function endOfUtcMonth(year: number, monthIndex: number): Date {
  // Day 0 of the next month = last day of this month.
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

/** `today` / `tomorrow` / `YYYY-MM-DD` → resolved date string (UTC). */
export function resolveDateToken(dateToken: string, now = new Date()): string {
  if (dateToken === 'today') return formatDateOnly(now);
  if (dateToken === 'tomorrow') return formatDateOnly(addUtcDays(now, 1));
  if (ISO_DATE_TOKEN_PATTERN.test(dateToken)) return dateToken;
  throw new McpToolInputError('Invalid date token. Use today, tomorrow, or YYYY-MM-DD.');
}

export interface ResolvedWindow {
  start: string;
  end: string;
}

/**
 * Window token → `{start, end}` date strings (inclusive). Tokens: this_week,
 * next_week, this_month, next_month, overdue, YYYY-MM. `weekStartsOn` is
 * 0=Sunday..6=Saturday.
 */
export function resolveWindowToken(
  windowToken: string,
  now = new Date(),
  { weekStartsOn = 0 }: { weekStartsOn?: number | undefined } = {},
): ResolvedWindow {
  if (windowToken === 'this_week') {
    const start = startOfUtcWeek(now, weekStartsOn);
    return { start: formatDateOnly(start), end: formatDateOnly(addUtcDays(start, 6)) };
  }

  if (windowToken === 'next_week') {
    const start = startOfUtcWeek(addUtcDays(now, 7), weekStartsOn);
    return { start: formatDateOnly(start), end: formatDateOnly(addUtcDays(start, 6)) };
  }

  if (windowToken === 'this_month') {
    return {
      start: formatDateOnly(startOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth())),
      end: formatDateOnly(endOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth())),
    };
  }

  if (windowToken === 'next_month') {
    return {
      start: formatDateOnly(startOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth() + 1)),
      end: formatDateOnly(endOfUtcMonth(now.getUTCFullYear(), now.getUTCMonth() + 1)),
    };
  }

  if (windowToken === 'overdue') {
    return { start: '2000-01-01', end: formatDateOnly(addUtcDays(now, -1)) };
  }

  if (YYYY_MM_PATTERN.test(windowToken)) {
    const [year, month] = windowToken.split('-').map(Number) as [number, number];
    return {
      start: formatDateOnly(startOfUtcMonth(year, month - 1)),
      end: formatDateOnly(endOfUtcMonth(year, month - 1)),
    };
  }

  throw new McpToolInputError(
    'Invalid window token. Use this_week, next_week, this_month, next_month, overdue, or YYYY-MM.',
  );
}

// ---------------------------------------------------------------------------
// Task date spans (dateRange recurrence aware)
// ---------------------------------------------------------------------------

export interface TaskDateSpan {
  start: string;
  end: string;
  isDateRange: boolean;
}

export function getTaskDateSpan(todo: Todo): TaskDateSpan | null {
  const dueDate = normalizeDateOnly(todo.dueDate);
  const recurrence = todo.recurrence as {
    mode?: unknown;
    startDate?: string;
    endDate?: string;
  } | null;

  if (recurrence?.mode === 'dateRange') {
    const start = normalizeDateOnly(recurrence.startDate ?? dueDate);
    const end = normalizeDateOnly(recurrence.endDate ?? dueDate);
    if (start !== null && end !== null) {
      return { start, end, isDateRange: true };
    }
  }

  if (dueDate === null) return null;
  return { start: dueDate, end: dueDate, isDateRange: false };
}

/** Task occurs within [rangeStart, rangeEnd] inclusive (span-aware). */
export function doesTaskOccurInRange(todo: Todo, rangeStart: string, rangeEnd: string): boolean {
  const span = getTaskDateSpan(todo);
  if (span === null) return false;
  return span.start <= rangeEnd && span.end >= rangeStart;
}

export function doesTaskOccurOnDate(todo: Todo, dateValue: string): boolean {
  const span = getTaskDateSpan(todo);
  if (span === null) return false;
  return dateValue >= span.start && dateValue <= span.end;
}

export function isTaskEligibleForUpcoming(todo: Todo, fromDate: string): boolean {
  if (todo.isCompleted) return false;
  const span = getTaskDateSpan(todo);
  if (span === null) return false;
  return span.end >= fromDate;
}

function getUpcomingSortDate(todo: Todo, fromDate: string): string {
  const span = getTaskDateSpan(todo);
  if (span === null) return '9999-12-31';
  return span.start < fromDate ? fromDate : span.start;
}

/** Ordering: effectiveDateAsc, orderAsc, taskNumberAsc (old parity). */
export function compareTasksForUpcoming(a: Todo, b: Todo, fromDate: string): number {
  const byEffectiveDate = getUpcomingSortDate(a, fromDate).localeCompare(
    getUpcomingSortDate(b, fromDate),
  );
  if (byEffectiveDate !== 0) return byEffectiveDate;

  const byOrder = (a.order || 0) - (b.order || 0);
  if (byOrder !== 0) return byOrder;

  return (a.taskNumber || 0) - (b.taskNumber || 0);
}

// ---------------------------------------------------------------------------
// Week-start preference (fixes audit-mcp.md §8.2)
// ---------------------------------------------------------------------------

const DAY_NAME_TO_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** Default week start when no preference exists: Monday. */
export const DEFAULT_WEEK_STARTS_ON = 1;

/**
 * `startDayOfWeek` profile value (day name) → 0=Sunday..6=Saturday index.
 * Also accepts a raw number or day-name string (settings.layout.weekStart
 * fallback); anything unusable resolves to null.
 */
export function weekStartIndexFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }
  if (typeof value === 'string') {
    const index = DAY_NAME_TO_INDEX[value.trim().toLowerCase()];
    if (index !== undefined) return index;
  }
  return null;
}

export function dayNameToWeekStart(day: DayName): number {
  return weekStartIndexFrom(day) ?? DEFAULT_WEEK_STARTS_ON;
}

/** Type guard so profile values flow without casts. */
export function isDayName(value: unknown): value is DayName {
  return typeof value === 'string' && (DAY_NAMES as readonly string[]).includes(value);
}
