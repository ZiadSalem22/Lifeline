import { describe, expect, it } from 'vitest';
import { makeTag, makeTodo } from '../../../test/test-utils';
import {
  completedCountForDay,
  coversDay,
  filterTodosForDay,
  matchesDay,
  regroupIncompleteFirst,
  resolveDayString,
  sortTodos,
  totalDurationMinutes,
} from './day-filter';

const NOW = new Date('2026-07-06T12:00:00');

describe('resolveDayString', () => {
  it('resolves today, tomorrow, and passes explicit dates through', () => {
    expect(resolveDayString('today', NOW)).toBe('2026-07-06');
    expect(resolveDayString('tomorrow', NOW)).toBe('2026-07-07');
    expect(resolveDayString('2026-12-24', NOW)).toBe('2026-12-24');
  });
});

describe('matchesDay / coversDay', () => {
  it('matches exact dueDate', () => {
    const todo = makeTodo({ dueDate: '2026-07-06' });
    expect(matchesDay(todo, 'today', NOW)).toBe(true);
    expect(matchesDay(todo, 'tomorrow', NOW)).toBe(false);
  });

  it('matches dateRange spans on every day in [startDate, endDate]', () => {
    const span = makeTodo({
      dueDate: '2026-07-01',
      recurrence: { mode: 'dateRange', startDate: '2026-07-01', endDate: '2026-07-10' },
    });
    expect(coversDay(span, '2026-07-01')).toBe(true);
    expect(coversDay(span, '2026-07-06')).toBe(true);
    expect(coversDay(span, '2026-07-10')).toBe(true);
    expect(coversDay(span, '2026-07-11')).toBe(false);
    expect(coversDay(span, '2026-06-30')).toBe(false);
    // The plain dueDate filter alone would hide it on later days.
    expect(matchesDay(span, 'today', NOW)).toBe(true);
  });

  it('does not treat daily recurrence rows as spans', () => {
    const daily = makeTodo({
      dueDate: '2026-07-01',
      recurrence: { mode: 'daily', startDate: '2026-07-01', endDate: '2026-07-10' },
    });
    expect(coversDay(daily, '2026-07-06')).toBe(false);
  });
});

describe('filterTodosForDay', () => {
  const work = makeTag({ name: 'Work' });
  const home = makeTag({ name: 'Home' });

  it('filters by day, excludes archived, and applies AND tag semantics', () => {
    const both = makeTodo({ dueDate: '2026-07-06', tags: [work, home] });
    const onlyWork = makeTodo({ dueDate: '2026-07-06', tags: [work] });
    const archived = makeTodo({ dueDate: '2026-07-06', archived: true });
    const otherDay = makeTodo({ dueDate: '2026-07-07' });

    const all = filterTodosForDay([both, onlyWork, archived, otherDay], 'today', { now: NOW });
    expect(all.map((todo) => todo.id)).toEqual([both.id, onlyWork.id]);

    const tagged = filterTodosForDay([both, onlyWork], 'today', {
      tagIds: [work.id, home.id],
      now: NOW,
    });
    expect(tagged.map((todo) => todo.id)).toEqual([both.id]);
  });

  it('filters by text over title + description', () => {
    const inTitle = makeTodo({ dueDate: '2026-07-06', title: 'Buy groceries' });
    const inDescription = makeTodo({
      dueDate: '2026-07-06',
      title: 'Other',
      description: 'grocery run notes',
    });
    const miss = makeTodo({ dueDate: '2026-07-06', title: 'Unrelated' });
    const result = filterTodosForDay([inTitle, inDescription, miss], 'today', {
      query: 'groce',
      now: NOW,
    });
    expect(result.map((todo) => todo.id)).toEqual([inTitle.id, inDescription.id]);
  });
});

describe('sortTodos', () => {
  it('sorts priority high > medium > low', () => {
    const low = makeTodo({ priority: 'low' });
    const high = makeTodo({ priority: 'high' });
    const medium = makeTodo({ priority: 'medium' });
    expect(sortTodos([low, high, medium], 'priority').map((todo) => todo.priority)).toEqual([
      'high',
      'medium',
      'low',
    ]);
  });

  it('sorts duration descending and name ascending', () => {
    const short = makeTodo({ duration: 10, title: 'zeta' });
    const long = makeTodo({ duration: 120, title: 'alpha' });
    expect(sortTodos([short, long], 'duration')[0]?.id).toBe(long.id);
    expect(sortTodos([short, long], 'name')[0]?.id).toBe(long.id);
  });

  it('date sort breaks ties by persisted order then taskNumber', () => {
    const a = makeTodo({ dueDate: '2026-07-06', order: 2, taskNumber: 1 });
    const b = makeTodo({ dueDate: '2026-07-06', order: 1, taskNumber: 9 });
    const c = makeTodo({ dueDate: '2026-07-05', order: 5, taskNumber: 5 });
    expect(sortTodos([a, b, c], 'date').map((todo) => todo.id)).toEqual([c.id, b.id, a.id]);
  });
});

describe('regroup + hero numbers', () => {
  it('regroups incomplete first, preserving in-group order', () => {
    const done = makeTodo({ isCompleted: true });
    const open1 = makeTodo();
    const open2 = makeTodo();
    expect(regroupIncompleteFirst([done, open1, open2]).map((todo) => todo.id)).toEqual([
      open1.id,
      open2.id,
      done.id,
    ]);
  });

  it('completedCountForDay counts over the DATE-filtered list only', () => {
    const doneToday = makeTodo({ dueDate: '2026-07-06', isCompleted: true, tags: [] });
    const openToday = makeTodo({ dueDate: '2026-07-06' });
    const doneTomorrow = makeTodo({ dueDate: '2026-07-07', isCompleted: true });
    expect(completedCountForDay([doneToday, openToday, doneTomorrow], 'today', NOW)).toBe(1);
  });

  it('totals durations', () => {
    expect(totalDurationMinutes([makeTodo({ duration: 30 }), makeTodo({ duration: 45 })])).toBe(75);
  });
});
