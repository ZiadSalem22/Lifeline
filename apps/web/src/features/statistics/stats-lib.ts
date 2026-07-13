import { addDays, endOfMonth, format, startOfWeek } from 'date-fns';
import type { StatsResponse, Tag, Todo } from '@lifeline/shared';

/**
 * Statistics helpers — the old Statistics.jsx period/range mapping and guest
 * local computation, extracted pure. The v1 stats endpoint takes `period` XOR
 * `startDate+endDate`; the Day/Week/Month/Year pickers resolve to explicit
 * date ranges, while "All" uses the period branch.
 *
 * "All" must NOT send a 1970→2100 sentinel range: the server's range branch
 * zero-fills one group PER DAY (~47,800 groups, ~2 MB) and rejects ranges
 * longer than 1100 days. Instead the All tab queries `?period=year`, which
 * aggregates every non-archived todo and returns only years that have data.
 */

export type StatsPeriod = 'all' | 'day' | 'week' | 'month' | 'year';
export type WeekStart = 'monday' | 'sunday' | 'saturday';

export interface StatsRange {
  startDate: string;
  endDate: string;
}

/**
 * A resolved statistics selection: either the unbounded "all" view (period
 * branch) or an explicit date range (range branch). Drives the server query
 * and the guest-mode local computation identically.
 */
export type StatsQuery = { mode: 'all' } | { mode: 'range'; range: StatsRange };

const WEEK_STARTS_ON: Record<WeekStart, 0 | 1 | 6> = { sunday: 0, monday: 1, saturday: 6 };

export function weekRange(dateStr: string, weekStart: WeekStart): StatsRange {
  const base = new Date(`${dateStr}T00:00:00`);
  const start = startOfWeek(base, { weekStartsOn: WEEK_STARTS_ON[weekStart] });
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(addDays(start, 6), 'yyyy-MM-dd'),
  };
}

export function monthRange(monthStr: string): StatsRange {
  const [year, month] = monthStr.split('-').map(Number);
  const first = new Date(year ?? 1970, (month ?? 1) - 1, 1);
  return {
    startDate: format(first, 'yyyy-MM-dd'),
    endDate: format(endOfMonth(first), 'yyyy-MM-dd'),
  };
}

export function yearRange(yearStr: string): StatsRange {
  return { startDate: `${yearStr}-01-01`, endDate: `${yearStr}-12-31` };
}

/** Selection when a period tab is activated (old changePeriod). */
export function defaultQueryForPeriod(
  period: StatsPeriod,
  weekStart: WeekStart,
  now: Date = new Date(),
): StatsQuery {
  const today = format(now, 'yyyy-MM-dd');
  switch (period) {
    case 'day':
      return { mode: 'range', range: { startDate: today, endDate: today } };
    case 'week':
      return { mode: 'range', range: weekRange(today, weekStart) };
    case 'month':
      return { mode: 'range', range: monthRange(format(now, 'yyyy-MM')) };
    case 'year':
      return { mode: 'range', range: yearRange(format(now, 'yyyy')) };
    default:
      return { mode: 'all' };
  }
}

/** This Week (offset 0) / Last Week (offset -1) presets. */
export function presetWeekRange(
  offsetWeeks: number,
  weekStart: WeekStart,
  now: Date = new Date(),
): StatsRange {
  return weekRange(format(addDays(now, offsetWeeks * 7), 'yyyy-MM-dd'), weekStart);
}

/** Metrics window for the "All" tab: the trailing 366 days (fits the cap). */
export function allMetricsRange(now: Date = new Date()): StatsRange {
  const end = format(now, 'yyyy-MM-dd');
  return { startDate: format(addDays(now, -365), 'yyyy-MM-dd'), endDate: end };
}

/** Step the active range one period back/forward (the ‹ › chevrons). */
export function stepRange(period: StatsPeriod, range: StatsRange, dir: -1 | 1): StatsRange {
  const start = new Date(`${range.startDate}T00:00:00`);
  switch (period) {
    case 'day': {
      const day = format(addDays(start, dir), 'yyyy-MM-dd');
      return { startDate: day, endDate: day };
    }
    case 'week': {
      const start2 = format(addDays(start, dir * 7), 'yyyy-MM-dd');
      return { startDate: start2, endDate: format(addDays(start, dir * 7 + 6), 'yyyy-MM-dd') };
    }
    case 'month': {
      const first = new Date(start.getFullYear(), start.getMonth() + dir, 1);
      return monthRange(format(first, 'yyyy-MM'));
    }
    case 'year':
      return yearRange(String(start.getFullYear() + dir));
    default:
      return range;
  }
}

/** GET /stats query string for a selection (period branch for "all"). */
export function statsQueryString(query: StatsQuery): string {
  if (query.mode === 'all') return '?period=year';
  const search = new URLSearchParams({
    startDate: query.range.startDate,
    endDate: query.range.endDate,
  });
  return `?${search.toString()}`;
}

/** Stable React Query key for a selection. */
export function statsQueryKey(query: StatsQuery): string[] {
  return query.mode === 'all'
    ? ['stats', 'all']
    : ['stats', query.range.startDate, query.range.endDate];
}

/**
 * Guest-mode stats, computed locally from localStorage todos (old Statistics
 * guest branch), shaped like the v1 StatsResponse. Range mode filters by
 * dueDate; "all" mode includes every non-archived todo (unscheduled included).
 */
export function computeGuestStats(
  todos: readonly Todo[],
  tags: readonly Tag[],
  query: StatsQuery,
): StatsResponse {
  const inRange = todos.filter((todo) => {
    if (todo.archived) return false;
    if (query.mode === 'all') return true;
    return (
      todo.dueDate !== null &&
      todo.dueDate >= query.range.startDate &&
      todo.dueDate <= query.range.endDate
    );
  });

  const totalTodos = inRange.length;
  const completedCount = inRange.filter((todo) => todo.isCompleted).length;
  const completionRate = totalTodos > 0 ? Math.round((completedCount / totalTodos) * 100) : 0;
  const timeSpentTotal = inRange.reduce((acc, todo) => acc + (todo.duration || 0), 0);
  // Server averages over positive durations only; mirror that here.
  const withDuration = inRange.filter((todo) => todo.duration > 0);
  const avgDuration =
    withDuration.length > 0
      ? Math.round(withDuration.reduce((acc, todo) => acc + todo.duration, 0) / withDuration.length)
      : 0;

  const tagCounts = new Map<string, number>();
  for (const todo of inRange) {
    for (const tag of todo.tags) tagCounts.set(tag.id, (tagCounts.get(tag.id) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()]
    .map(([id, count]) => {
      const tag = tags.find((candidate) => candidate.id === id);
      return { id, name: tag?.name ?? 'Tag', color: tag?.color ?? '#6B7280', count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Groups mirror the server EXACTLY so the "Tasks per …" line matches in both
  // modes: All → one point per year with data; a range → one point per day
  // in [start, end], zero-filled, so the x-axis is time-true (not collapsed
  // over empty days).
  let groups: StatsResponse['groups'];
  if (query.mode === 'all') {
    const perYear = new Map<string, number>();
    for (const todo of inRange) {
      if (todo.dueDate !== null) {
        const year = todo.dueDate.slice(0, 4);
        perYear.set(year, (perYear.get(year) ?? 0) + 1);
      }
    }
    groups = [...perYear.entries()]
      .map(([year, count]) => ({ period: year, date: year, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } else {
    const perDay = new Map<string, number>();
    for (const todo of inRange) {
      if (todo.dueDate !== null) perDay.set(todo.dueDate, (perDay.get(todo.dueDate) ?? 0) + 1);
    }
    groups = [];
    let date = query.range.startDate;
    // 1100-day ceiling matches the server's max range guard.
    for (let i = 0; i < 1100 && date <= query.range.endDate; i += 1) {
      groups.push({ period: date, date, count: perDay.get(date) ?? 0 });
      date = format(addDays(new Date(`${date}T00:00:00`), 1), 'yyyy-MM-dd');
    }
  }

  return {
    periodTotals: { totalTodos, completedCount, completionRate, avgDuration, timeSpentTotal },
    topTags,
    groups,
  };
}
