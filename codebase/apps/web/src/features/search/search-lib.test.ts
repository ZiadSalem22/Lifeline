import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { makeTag, makeTodo } from '../../test/test-utils';
import {
  applyRowSelection,
  buildSearchParams,
  clientPreview,
  dayRouteToken,
  EMPTY_FILTERS,
  filterTodosClient,
  formatDueDateLabel,
  groupThisWeekOlder,
  hasActiveFilters,
} from './search-lib';
import type { SearchFilters } from './search-lib';

const filters = (overrides: Partial<SearchFilters> = {}): SearchFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe('buildSearchParams (filter → GET /todos param mapping)', () => {
  it('maps every filter onto the v1 query surface', () => {
    expect(
      buildSearchParams(
        filters({
          q: ' report ',
          taskNumber: '12',
          tagIds: ['t1', 't2'],
          priority: 'high',
          status: 'active',
          flaggedOnly: true,
          startDate: '2026-07-01',
          endDate: '2026-07-31',
          minDuration: '15',
          maxDuration: '120',
          includeArchived: true,
          sortBy: 'date_desc',
        }),
        2,
        10,
      ),
    ).toEqual({
      page: 2,
      pageSize: 10,
      q: 'report',
      tags: 't1,t2',
      priority: 'high',
      status: 'active',
      flagged: true,
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      minDuration: 15,
      maxDuration: 120,
      taskNumber: 12,
      includeArchived: true,
      sortBy: 'date_desc',
    });
  });

  it('omits empty filters and maps date_asc to the server default sort', () => {
    expect(buildSearchParams(filters({ sortBy: 'date_asc' }), 1, 10)).toEqual({
      page: 1,
      pageSize: 10,
    });
    expect(buildSearchParams(filters({ sortBy: 'priority' }), 1, 10).sortBy).toBe('priority');
  });
});

describe('hasActiveFilters', () => {
  it('is false for the empty state and true for any set filter', () => {
    expect(hasActiveFilters(filters())).toBe(false);
    expect(hasActiveFilters(filters({ q: 'x' }))).toBe(true);
    expect(hasActiveFilters(filters({ includeArchived: true }))).toBe(true);
    expect(hasActiveFilters(filters({ tagIds: ['t'] }))).toBe(true);
  });
});

describe('filterTodosClient', () => {
  it('matches q against title, description, subtasks, and #taskNumber', () => {
    const bySubtask = makeTodo({
      title: 'Other',
      subtasks: [{ subtaskId: 's', title: 'buy paint', isCompleted: false, position: 1 }],
    });
    const byNumber = makeTodo({ taskNumber: 4711, title: 'Nothing' });
    const miss = makeTodo({ title: 'Nope', taskNumber: 1 });

    expect(filterTodosClient([bySubtask, miss], filters({ q: 'paint' }))).toHaveLength(1);
    expect(filterTodosClient([byNumber, miss], filters({ q: '#4711' }))).toHaveLength(1);
  });

  it('applies tag OR semantics, priority, status, flags, dates, and durations', () => {
    const tag = makeTag();
    const match = makeTodo({
      tags: [tag],
      priority: 'high',
      isFlagged: true,
      dueDate: '2026-07-10',
      duration: 60,
    });
    const wrongPriority = makeTodo({ tags: [tag], priority: 'low', dueDate: '2026-07-10' });
    const result = filterTodosClient(
      [match, wrongPriority],
      filters({
        tagIds: [tag.id, 'other-tag'],
        priority: 'high',
        status: 'active',
        flaggedOnly: true,
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        minDuration: '30',
        maxDuration: '90',
      }),
    );
    expect(result.map((todo) => todo.id)).toEqual([match.id]);
  });

  it('excludes archived todos unless includeArchived', () => {
    const archived = makeTodo({ archived: true });
    const active = makeTodo();
    expect(filterTodosClient([archived, active], filters())).toHaveLength(1);
    expect(filterTodosClient([archived, active], filters({ includeArchived: true }))).toHaveLength(
      2,
    );
  });

  it('sorts date_desc with null dates last', () => {
    const noDate = makeTodo({ dueDate: null });
    const older = makeTodo({ dueDate: '2026-01-01' });
    const newer = makeTodo({ dueDate: '2026-06-01' });
    const result = filterTodosClient([noDate, older, newer], filters({ sortBy: 'date_desc' }));
    expect(result.map((todo) => todo.id)).toEqual([newer.id, older.id, noDate.id]);
  });
});

describe('clientPreview', () => {
  it('requires q >= 2 chars and caps at 50 rows', () => {
    const todos = Array.from({ length: 60 }, (_, index) =>
      makeTodo({ title: `preview item ${index}` }),
    );
    expect(clientPreview(todos, 'p')).toHaveLength(0);
    expect(clientPreview(todos, 'preview')).toHaveLength(50);
  });
});

describe('groupThisWeekOlder', () => {
  it('groups only for date sorts', () => {
    const thisWeek = makeTodo({ dueDate: format(new Date(), 'yyyy-MM-dd') });
    const older = makeTodo({ dueDate: '2020-01-01' });
    const grouped = groupThisWeekOlder([thisWeek, older], 'date_desc');
    expect(grouped.grouped).toBe(true);
    expect(grouped.thisWeek.map((todo) => todo.id)).toEqual([thisWeek.id]);
    expect(grouped.older.map((todo) => todo.id)).toEqual([older.id]);

    expect(groupThisWeekOlder([thisWeek, older], 'priority').grouped).toBe(false);
  });
});

describe('applyRowSelection', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];

  it('plain click toggles and records the anchor', () => {
    const first = applyRowSelection([], ids, 1, false, null);
    expect(first).toEqual({ selectedIds: ['b'], anchorIndex: 1 });
    const toggledOff = applyRowSelection(first.selectedIds, ids, 1, false, first.anchorIndex);
    expect(toggledOff.selectedIds).toEqual([]);
  });

  it('shift-click merges the anchor→index range', () => {
    const first = applyRowSelection([], ids, 1, false, null);
    const range = applyRowSelection(first.selectedIds, ids, 3, true, first.anchorIndex);
    expect(range.selectedIds).toEqual(['b', 'c', 'd']);
    // Reverse direction also works and keeps prior selection merged.
    const reverse = applyRowSelection(['e'], ids, 0, true, 2);
    expect(reverse.selectedIds).toEqual(['e', 'a', 'b', 'c']);
  });
});

describe('formatting + routing helpers', () => {
  it('formats due-date pills', () => {
    const iso = format(new Date(), 'yyyy-MM-dd'); // local date, not UTC
    expect(formatDueDateLabel(iso)).toBe('Today');
    expect(formatDueDateLabel(null)).toBe('No date');
    expect(formatDueDateLabel('2020-02-01')).toBe('Feb 1, 2020');
  });

  it('collapses today/tomorrow into route tokens', () => {
    const now = new Date('2026-07-06T10:00:00');
    expect(dayRouteToken('2026-07-06', now)).toBe('today');
    expect(dayRouteToken('2026-12-24T00:00:00.000Z', now)).toBe('2026-12-24');
  });
});
