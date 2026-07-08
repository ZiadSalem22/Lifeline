import type { StatsQuery, StatsResponse, Todo } from '@lifeline/shared';
import { DomainValidationError } from '../../domain/errors.js';
import type { TodoRepository } from '../ports.js';

/**
 * GET /api/v1/stats — in-memory aggregation over ALL of the user's
 * non-archived todos, ported 1:1 from the old
 * `TypeORMTodoRepository.getStatisticsForUserInRange/-Aggregated`
 * (audit-domain-logic.md §9). v1 renames `topTagsInPeriod` → `topTags`.
 */

const DAY_MS = 86_400_000;

/**
 * Cap on the inclusive day span a range query may request. The range branch
 * zero-fills ONE group entry per day (groupByDayInRange), so an unbounded span
 * (the old "All" tab sent 1970-01-01..2100-12-31) produced ~47.8k group
 * objects — multi-MB payloads that froze the client chart. Long spans should
 * use `?period=…` grouping instead. ~3 years of daily buckets is plenty.
 */
export const MAX_RANGE_DAYS = 1100;

export interface PeriodTotals {
  totalTodos: number;
  completedCount: number;
  completionRate: number;
  avgDuration: number;
  timeSpentTotal: number;
}

export interface TagCount {
  id: string;
  name: string;
  color: string;
  count: number;
}

/** Parse a date-only string as UTC midnight (all stats math is UTC). */
function utcMs(dateOnly: string): number {
  return Date.parse(`${dateOnly}T00:00:00.000Z`);
}

/**
 * Totals over a todo set: completionRate is an integer percentage
 * (Math.round), avgDuration is the rounded mean of POSITIVE durations only,
 * timeSpentTotal sums ALL durations.
 */
export function buildPeriodTotals(todos: readonly Todo[]): PeriodTotals {
  const totalTodos = todos.length;
  const completedCount = todos.filter((todo) => todo.isCompleted).length;
  const completionRate = totalTodos > 0 ? Math.round((completedCount / totalTodos) * 100) : 0;
  const positiveDurations = todos.map((todo) => todo.duration).filter((value) => value > 0);
  const avgDuration =
    positiveDurations.length > 0
      ? Math.round(
          positiveDurations.reduce((sum, value) => sum + value, 0) / positiveDurations.length,
        )
      : 0;
  const timeSpentTotal = todos.reduce((sum, todo) => sum + todo.duration, 0);
  return { totalTodos, completedCount, completionRate, avgDuration, timeSpentTotal };
}

/** Top 10 tags by usage count (ties keep first-seen order, like the old sort). */
export function buildTopTags(todos: readonly Todo[]): TagCount[] {
  const counts = new Map<string, TagCount>();
  for (const todo of todos) {
    for (const tag of todo.tags) {
      const existing = counts.get(tag.id) ?? {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        count: 0,
      };
      existing.count += 1;
      counts.set(tag.id, existing);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 10);
}

/**
 * Period group key, ported EXACTLY from the old `_groupTodosForPeriod`
 * formatter — including the Jan-1-based week calculation
 * (`week = ceil((daysSinceJan1 + jan1UtcDay + 1) / 7)`), which is NOT
 * ISO-8601 week numbering.
 */
export function periodKeyFor(dateOnly: string, period: 'day' | 'week' | 'month' | 'year'): string {
  const date = new Date(utcMs(dateOnly));
  if (period === 'year') return `${date.getUTCFullYear()}`;
  if (period === 'month') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  if (period === 'week') {
    const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const days = Math.floor((date.getTime() - firstDay.getTime()) / DAY_MS);
    const week = Math.ceil((days + firstDay.getUTCDay() + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return date.toISOString().slice(0, 10);
}

interface StatsGroup {
  period: string;
  date: string;
  count: number;
}

/** One entry PER DAY in [startDate, endDate] inclusive, zero-filled. */
function groupByDayInRange(
  todos: readonly Todo[],
  startDate: string,
  endDate: string,
): StatsGroup[] {
  const counts = new Map<string, number>();
  for (const todo of todos) {
    if (todo.dueDate === null) continue;
    counts.set(todo.dueDate, (counts.get(todo.dueDate) ?? 0) + 1);
  }
  const groups: StatsGroup[] = [];
  const endMs = utcMs(endDate);
  for (let ms = utcMs(startDate); ms <= endMs; ms += DAY_MS) {
    const key = new Date(ms).toISOString().slice(0, 10);
    groups.push({ period: key, date: key, count: counts.get(key) ?? 0 });
  }
  return groups;
}

/** Only keys with data, sorted lexically; `date` mirrors the period key. */
function groupByPeriod(
  todos: readonly Todo[],
  period: 'day' | 'week' | 'month' | 'year',
): StatsGroup[] {
  const counts = new Map<string, number>();
  for (const todo of todos) {
    if (todo.dueDate === null) continue;
    const key = periodKeyFor(todo.dueDate, period);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ period: key, date: key, count }));
}

export interface GetStatsDeps {
  todos: Pick<TodoRepository, 'listAll'>;
}

export class GetStats {
  constructor(private readonly deps: GetStatsDeps) {}

  async execute(userId: string, query: StatsQuery): Promise<StatsResponse> {
    const todos = await this.deps.todos.listAll(userId, { includeArchived: false });

    // Range branch wins when both bounds are present (old route behavior);
    // todos WITHOUT a dueDate are excluded from range stats entirely.
    if (query.startDate !== undefined && query.endDate !== undefined) {
      const start = utcMs(query.startDate);
      const endExclusive = utcMs(query.endDate) + DAY_MS;
      // Guard the zero-fill BEFORE it runs: reject spans too wide to enumerate
      // day-by-day (round2 finding #3). Callers wanting long spans use period
      // grouping (?period=day|week|month|year), which emits only non-empty keys.
      const spanDays = Math.floor((endExclusive - start) / DAY_MS);
      if (spanDays > MAX_RANGE_DAYS) {
        throw new DomainValidationError(
          'Date range too large; use period grouping for long spans.',
        );
      }
      const inRange = todos.filter((todo) => {
        if (todo.dueDate === null) return false;
        const due = utcMs(todo.dueDate);
        return due >= start && due < endExclusive;
      });
      return {
        periodTotals: buildPeriodTotals(inRange),
        topTags: buildTopTags(inRange),
        groups: groupByDayInRange(inRange, query.startDate, query.endDate),
      };
    }

    // Period branch: ALL non-archived todos (no date cut) — todos without a
    // dueDate count toward the totals but never appear in groups.
    const period = query.period ?? 'day';
    return {
      periodTotals: buildPeriodTotals(todos),
      topTags: buildTopTags(todos),
      groups: groupByPeriod(todos, period),
    };
  }
}
