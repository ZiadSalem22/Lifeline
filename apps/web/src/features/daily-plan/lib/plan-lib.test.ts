import { describe, expect, it } from 'vitest';
import { emptyDailyPlanData } from '@lifeline/shared';
import { detectMeal, guessSlot, logSummary, parseFood } from './food-parser';
import { masonryRowSpan } from './masonry';
import { scheduleHours, weekDatesOf, weekIndexOf, weekStartOf } from './plan-model';
import { computeScore } from './score';

describe('food-parser', () => {
  it('parses "2 eggs and toast" with quantities and macros', () => {
    const foods = parseFood('I ate 2 eggs and toast for breakfast');
    expect(foods.map((f) => f.name)).toEqual(['2× egg', 'toast']);
    expect(foods[0]).toMatchObject({ cal: 156, p: 12 });
  });

  it('matches Arabic aliases (شاورما, رز)', () => {
    const foods = parseFood('شاورما مع رز');
    expect(foods.map((f) => f.name)).toEqual(expect.arrayContaining(['shawarma', 'rice']));
  });

  it('returns [] for unknown foods', () => {
    expect(parseFood('mystery casserole')).toEqual([]);
  });

  it('detectMeal: explicit mention wins, otherwise time of day', () => {
    expect(detectMeal('eggs for dinner', 8)).toBe('dinner');
    expect(detectMeal('غداء دجاج', 22)).toBe('lunch');
    expect(detectMeal('just eggs', 8)).toBe('breakfast');
    expect(guessSlot(12)).toBe('lunch');
    expect(guessSlot(18)).toBe('dinner');
    expect(guessSlot(23)).toBe('snacks');
  });

  it('logSummary reports kcal + protein into the slot', () => {
    const summary = logSummary(parseFood('2 eggs'), 'breakfast');
    expect(summary).toContain('Breakfast ✓');
    expect(summary).toContain('+156 kcal');
    expect(summary).toContain('+12g protein');
  });
});

describe('masonryRowSpan', () => {
  it('ceil((h+gap)/(8+gap)) with a 1-row floor', () => {
    expect(masonryRowSpan(300, 14)).toBe(Math.ceil((300 + 14) / 22));
    expect(masonryRowSpan(0, 14)).toBe(1);
  });
});

describe('plan-model week math', () => {
  it('weekStartOf/weekDatesOf are Monday-first', () => {
    // 2026-07-09 is a Thursday.
    expect(weekStartOf('2026-07-09')).toBe('2026-07-06');
    expect(weekDatesOf('2026-07-09')).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
    expect(weekIndexOf('2026-07-09')).toBe(3);
    expect(weekIndexOf('2026-07-06')).toBe(0);
    expect(weekIndexOf('2026-07-12')).toBe(6);
  });

  it('schedule runs 04:00 → 00:00 (21 rows) by default and honors custom hours', () => {
    const hours = scheduleHours();
    expect(hours).toHaveLength(21);
    expect(hours[0]).toBe('04:00');
    expect(hours[20]).toBe('00:00');
    expect(scheduleHours(6, 22)).toEqual([
      '06:00',
      '07:00',
      '08:00',
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
      '19:00',
      '20:00',
      '21:00',
      '22:00',
    ]);
  });
});

describe('computeScore (fair — only counts used, visible sections)', () => {
  const fifteen = Array.from({ length: 15 }, (_, i) => `h${i}`);

  it('counts habits, tasks, quick, USED priorities, non-negs, water', () => {
    const day = emptyDailyPlanData();
    day.habits = { h0: true, h1: true };
    day.quick = [{ t: 'a', done: true }];
    day.priorities[0] = { t: 'p1', done: true }; // slots 2+3 empty → NOT counted
    day.nonnegs = [true, false, false, false, false];
    day.water = 4;
    const score = computeScore({
      day,
      taskTotal: 2,
      taskDone: 1,
      habitIds: fifteen,
      waterGoal: 8,
      nonnegCount: 5,
      hidden: {},
    });
    // total = 15 + (2+1) + 1 + 5 + 8 = 32; done = 2 + (1+1) + 1 + 1 + 4 = 10
    expect(score).toBe(Math.round((10 / 32) * 100));
  });

  it('orphan checkmarks from deleted habits do not inflate the score', () => {
    const day = emptyDailyPlanData();
    day.habits = { fajr: true, deletedHabit: true };
    const score = computeScore({
      day,
      taskTotal: 0,
      taskDone: 0,
      habitIds: ['fajr', 'gym'],
      waterGoal: 8,
      nonnegCount: 0,
      hidden: { water: true, nonneg: true, todo: true, priorities: true },
    });
    // Only fajr counts (deletedHabit is not in the tracker): 1/2.
    expect(score).toBe(50);
  });

  it('hidden cards are excluded entirely', () => {
    const day = emptyDailyPlanData();
    day.habits = { fajr: true };
    day.water = 0;
    const score = computeScore({
      day,
      taskTotal: 0,
      taskDone: 0,
      habitIds: ['fajr', 'gym'],
      waterGoal: 8,
      nonnegCount: 5,
      hidden: { water: true, nonneg: true, todo: true, priorities: true },
    });
    // Only habits count: 1/2.
    expect(score).toBe(50);
  });

  it('empty day scores 0 without dividing by zero', () => {
    const day = emptyDailyPlanData();
    expect(
      computeScore({
        day,
        taskTotal: 0,
        taskDone: 0,
        habitIds: [],
        waterGoal: 0,
        nonnegCount: 0,
        hidden: { water: true },
      }),
    ).toBe(0);
  });
});
