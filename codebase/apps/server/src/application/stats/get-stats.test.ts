import { describe, expect, it } from 'vitest';
import type { Tag } from '@lifeline/shared';
import { DomainValidationError } from '../../domain/errors.js';
import { InMemoryTodoRepository } from '../../../test/helpers/feature-fakes.js';
import {
  GetStats,
  MAX_RANGE_DAYS,
  buildPeriodTotals,
  buildTopTags,
  periodKeyFor,
} from './get-stats.js';

function tag(id: string, name = id): Tag {
  return { id, name, color: '#000000', userId: null, isDefault: true };
}

function build() {
  const todos = new InMemoryTodoRepository();
  return { todos, getStats: new GetStats({ todos }) };
}

describe('buildPeriodTotals', () => {
  it('completionRate is an integer percentage (rounded)', () => {
    const { todos } = build();
    todos.seed('u1', { isCompleted: true });
    todos.seed('u1');
    todos.seed('u1');
    expect(buildPeriodTotals(todos.rowsFor('u1')).completionRate).toBe(33); // round(33.33)
  });

  it('avgDuration averages POSITIVE durations only; timeSpentTotal sums ALL', () => {
    const { todos } = build();
    todos.seed('u1', { duration: 30 });
    todos.seed('u1', { duration: 0 });
    todos.seed('u1', { duration: 60 });
    const totals = buildPeriodTotals(todos.rowsFor('u1'));
    expect(totals.avgDuration).toBe(45); // mean(30, 60), zero excluded
    expect(totals.timeSpentTotal).toBe(90);
  });

  it('empty set → all zeros', () => {
    expect(buildPeriodTotals([])).toEqual({
      totalTodos: 0,
      completedCount: 0,
      completionRate: 0,
      avgDuration: 0,
      timeSpentTotal: 0,
    });
  });
});

describe('buildTopTags', () => {
  it('orders by usage count and caps at 10', () => {
    const { todos } = build();
    todos.seed('u1', { tags: [tag('a'), tag('b')] });
    todos.seed('u1', { tags: [tag('a')] });
    todos.seed('u1', { tags: [tag('a')] });
    const top = buildTopTags(todos.rowsFor('u1'));
    expect(top.map((entry) => [entry.id, entry.count])).toEqual([
      ['a', 3],
      ['b', 1],
    ]);

    const many = new InMemoryTodoRepository();
    many.seed('u1', { tags: Array.from({ length: 11 }, (_, i) => tag(`t${i}`)) });
    expect(buildTopTags(many.rowsFor('u1'))).toHaveLength(10);
  });
});

describe('periodKeyFor — Jan-1-based week math (NOT ISO 8601)', () => {
  // 2026-01-01 is a Thursday (getUTCDay = 4): week = ceil((days + 4 + 1) / 7).
  it.each([
    ['2026-01-01', 'week', '2026-W01'],
    ['2026-01-03', 'week', '2026-W01'], // Saturday, days=2 → ceil(7/7)=1
    ['2026-01-04', 'week', '2026-W02'], // Sunday, days=3 → ceil(8/7)=2
    ['2026-12-31', 'week', '2026-W53'],
    ['2026-07-06', 'month', '2026-07'],
    ['2026-07-06', 'year', '2026'],
    ['2026-07-06', 'day', '2026-07-06'],
  ] as const)('%s + %s → %s', (date, period, expected) => {
    expect(periodKeyFor(date, period)).toBe(expected);
  });
});

describe('GetStats — range mode', () => {
  it('zero-fills one group per day inclusive and filters todos to the range', async () => {
    const { todos, getStats } = build();
    todos.seed('u1', { dueDate: '2026-03-01', isCompleted: true, duration: 30 });
    todos.seed('u1', { dueDate: '2026-03-01', duration: 0 });
    todos.seed('u1', { dueDate: '2026-03-03', duration: 60, tags: [tag('a')] });
    todos.seed('u1', { dueDate: '2026-04-15' }); // outside range
    todos.seed('u1', { dueDate: null }); // no dueDate → excluded from range stats
    todos.seed('u1', { dueDate: '2026-03-02', archived: true }); // archived excluded

    const stats = await getStats.execute('u1', {
      startDate: '2026-03-01',
      endDate: '2026-03-04',
    });
    expect(stats.groups).toEqual([
      { period: '2026-03-01', date: '2026-03-01', count: 2 },
      { period: '2026-03-02', date: '2026-03-02', count: 0 },
      { period: '2026-03-03', date: '2026-03-03', count: 1 },
      { period: '2026-03-04', date: '2026-03-04', count: 0 },
    ]);
    expect(stats.periodTotals).toEqual({
      totalTodos: 3,
      completedCount: 1,
      completionRate: 33,
      avgDuration: 45,
      timeSpentTotal: 90,
    });
    expect(stats.topTags).toEqual([{ id: 'a', name: 'a', color: '#000000', count: 1 }]);
  });

  it('endDate is inclusive (exclusive next-day cut internally)', async () => {
    const { todos, getStats } = build();
    todos.seed('u1', { dueDate: '2026-03-04' });
    const stats = await getStats.execute('u1', {
      startDate: '2026-03-04',
      endDate: '2026-03-04',
    });
    expect(stats.periodTotals.totalTodos).toBe(1);
    expect(stats.groups).toEqual([{ period: '2026-03-04', date: '2026-03-04', count: 1 }]);
  });

  // Regression (round2 finding #3): the range branch zero-fills one group per
  // day, so an unbounded span (old "All" tab: 1970..2100) produced ~47.8k
  // groups. Spans longer than MAX_RANGE_DAYS are now rejected with a 400.
  describe('range span guard', () => {
    it('a MAX_RANGE_DAYS-day span is accepted (boundary OK)', async () => {
      const { getStats } = build();
      // 2026-01-01 .. 2029-01-04 inclusive = exactly 1100 days.
      const stats = await getStats.execute('u1', {
        startDate: '2026-01-01',
        endDate: '2029-01-04',
      });
      expect(stats.groups).toHaveLength(MAX_RANGE_DAYS);
    });

    it('a span of MAX_RANGE_DAYS + 1 is rejected with a validation error', async () => {
      const { getStats } = build();
      // 2026-01-01 .. 2029-01-05 inclusive = 1101 days.
      await expect(
        getStats.execute('u1', { startDate: '2026-01-01', endDate: '2029-01-05' }),
      ).rejects.toThrow(
        new DomainValidationError('Date range too large; use period grouping for long spans.'),
      );
    });

    it('the sentinel 1970..2100 range that froze the client is rejected', async () => {
      const { getStats } = build();
      await expect(
        getStats.execute('u1', { startDate: '1970-01-01', endDate: '2100-12-31' }),
      ).rejects.toThrow(DomainValidationError);
    });
  });
});

describe('GetStats — period mode', () => {
  it('groups only keys with data, sorted lexically; week keys use Jan-1 math', async () => {
    const { todos, getStats } = build();
    todos.seed('u1', { dueDate: '2026-01-03' }); // W01
    todos.seed('u1', { dueDate: '2026-01-04' }); // W02
    todos.seed('u1', { dueDate: '2026-01-04' }); // W02
    const stats = await getStats.execute('u1', { period: 'week' });
    expect(stats.groups).toEqual([
      { period: '2026-W01', date: '2026-W01', count: 1 },
      { period: '2026-W02', date: '2026-W02', count: 2 },
    ]);
  });

  it('todos without a dueDate count toward totals but never appear in groups', async () => {
    const { todos, getStats } = build();
    todos.seed('u1', { dueDate: null, isCompleted: true });
    todos.seed('u1', { dueDate: '2026-07-06' });
    const stats = await getStats.execute('u1', { period: 'day' });
    expect(stats.periodTotals.totalTodos).toBe(2);
    expect(stats.periodTotals.completedCount).toBe(1);
    expect(stats.groups).toEqual([{ period: '2026-07-06', date: '2026-07-06', count: 1 }]);
  });

  it('period mode has no date cut (all non-archived todos count)', async () => {
    const { todos, getStats } = build();
    todos.seed('u1', { dueDate: '2020-01-01' });
    todos.seed('u1', { dueDate: '2030-12-31' });
    todos.seed('u1', { archived: true });
    const stats = await getStats.execute('u1', { period: 'year' });
    expect(stats.periodTotals.totalTodos).toBe(2);
    expect(stats.groups.map((group) => group.period)).toEqual(['2020', '2030']);
  });

  it('range branch wins when both bounds are present alongside period', async () => {
    const { todos, getStats } = build();
    todos.seed('u1', { dueDate: '2020-01-01' });
    const stats = await getStats.execute('u1', {
      period: 'year',
      startDate: '2026-03-01',
      endDate: '2026-03-01',
    });
    expect(stats.periodTotals.totalTodos).toBe(0); // range filter applied
    expect(stats.groups).toHaveLength(1); // one zero-filled day, not year keys
  });
});
