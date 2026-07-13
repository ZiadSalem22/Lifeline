import { describe, expect, it } from 'vitest';
import { makeTag, makeTodo } from '../../test/test-utils';
import {
  computeGuestStats,
  defaultQueryForPeriod,
  monthRange,
  presetWeekRange,
  statsQueryKey,
  statsQueryString,
  weekRange,
  yearRange,
} from './stats-lib';
import type { StatsQuery } from './stats-lib';

const rangeQuery = (startDate: string, endDate: string): StatsQuery => ({
  mode: 'range',
  range: { startDate, endDate },
});

const NOW = new Date('2026-07-08T12:00:00'); // a Wednesday

describe('period → range mapping (mirrors the old Statistics.jsx pickers)', () => {
  it('weekRange respects the week-start preference', () => {
    expect(weekRange('2026-07-08', 'monday')).toEqual({
      startDate: '2026-07-06',
      endDate: '2026-07-12',
    });
    expect(weekRange('2026-07-08', 'sunday')).toEqual({
      startDate: '2026-07-05',
      endDate: '2026-07-11',
    });
    expect(weekRange('2026-07-08', 'saturday')).toEqual({
      startDate: '2026-07-04',
      endDate: '2026-07-10',
    });
  });

  it('month and year ranges cover the full calendar unit', () => {
    expect(monthRange('2026-02')).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
    expect(yearRange('2026')).toEqual({ startDate: '2026-01-01', endDate: '2026-12-31' });
  });

  it('defaultQueryForPeriod: day = today range, all = period branch', () => {
    expect(defaultQueryForPeriod('day', 'monday', NOW)).toEqual(
      rangeQuery('2026-07-08', '2026-07-08'),
    );
    expect(defaultQueryForPeriod('week', 'monday', NOW)).toEqual(
      rangeQuery('2026-07-06', '2026-07-12'),
    );
    // "All" must NOT resolve to a sentinel date range — it uses the period branch.
    expect(defaultQueryForPeriod('all', 'monday', NOW)).toEqual({ mode: 'all' });
  });

  it('presetWeekRange(-1) is last week', () => {
    expect(presetWeekRange(-1, 'monday', NOW)).toEqual({
      startDate: '2026-06-29',
      endDate: '2026-07-05',
    });
  });

  it('builds the GET /stats query string per branch', () => {
    expect(statsQueryString(rangeQuery('2026-07-01', '2026-07-31'))).toBe(
      '?startDate=2026-07-01&endDate=2026-07-31',
    );
    // Regression: the All tab must send ?period=year, never a 1970→2100 range
    // that would make the server zero-fill ~47,800 day groups.
    expect(statsQueryString({ mode: 'all' })).toBe('?period=year');
  });

  it('statsQueryKey is stable and distinct per selection', () => {
    expect(statsQueryKey({ mode: 'all' })).toEqual(['stats', 'all']);
    expect(statsQueryKey(rangeQuery('2026-07-01', '2026-07-31'))).toEqual([
      'stats',
      '2026-07-01',
      '2026-07-31',
    ]);
  });
});

describe('computeGuestStats', () => {
  const work = makeTag({ name: 'Work' });
  const play = makeTag({ name: 'Play' });

  it('computes totals, completion %, durations, top tags, and per-day groups', () => {
    const todos = [
      makeTodo({ dueDate: '2026-07-01', isCompleted: true, duration: 30, tags: [work] }),
      makeTodo({ dueDate: '2026-07-01', duration: 60, tags: [work, play] }),
      makeTodo({ dueDate: '2026-07-02', duration: 0, tags: [] }),
    ];
    const stats = computeGuestStats(todos, [work, play], rangeQuery('2026-07-01', '2026-07-31'));
    expect(stats.periodTotals).toEqual({
      totalTodos: 3,
      completedCount: 1,
      completionRate: 33, // round(1/3 * 100)
      avgDuration: 45, // round((30 + 60) / 2) — mean of POSITIVE durations, matching the server
      timeSpentTotal: 90, // sum of ALL durations
    });
    expect(stats.topTags[0]).toMatchObject({ id: work.id, name: 'Work', count: 2 });
    expect(stats.topTags[1]).toMatchObject({ id: play.id, count: 1 });
    // Zero-filled one group per day in [start, end] (matches the server), so
    // the tasks-per-day line's x-axis is time-true, not collapsed over gaps.
    expect(stats.groups).toHaveLength(31);
    expect(stats.groups[0]).toEqual({ period: '2026-07-01', date: '2026-07-01', count: 2 });
    expect(stats.groups[1]).toEqual({ period: '2026-07-02', date: '2026-07-02', count: 1 });
    expect(stats.groups[2]).toEqual({ period: '2026-07-03', date: '2026-07-03', count: 0 });
    expect(stats.groups[30]).toEqual({ period: '2026-07-31', date: '2026-07-31', count: 0 });
  });

  it('filters by range, excludes archived, and "all" keeps unscheduled todos', () => {
    const inRange = makeTodo({ dueDate: '2026-07-01' });
    const outOfRange = makeTodo({ dueDate: '2026-08-01' });
    const unscheduled = makeTodo({ dueDate: null });
    const archived = makeTodo({ dueDate: '2026-07-01', archived: true });
    const all = [inRange, outOfRange, unscheduled, archived];

    const ranged = computeGuestStats(all, [], rangeQuery('2026-07-01', '2026-07-31'));
    expect(ranged.periodTotals.totalTodos).toBe(1);

    const overall = computeGuestStats(all, [], { mode: 'all' });
    expect(overall.periodTotals.totalTodos).toBe(3); // archived still excluded
    // "All" buckets by YEAR (matching the server's ?period=year branch); the
    // two dated todos fall in 2026, the unscheduled one has no year bucket.
    expect(overall.groups).toEqual([{ period: '2026', date: '2026', count: 2 }]);
  });
});
