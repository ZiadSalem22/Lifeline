import { describe, expect, it } from 'vitest';
import { defaultDailyPlanSettings, emptyDailyPlanData } from '@lifeline/shared';
import { applyCarryOver, carryOverFrom, materializeNewDay, templateFromDay } from './templates';
import {
  prioritySuggestions,
  quickSuggestions,
  recentMealItems,
  scheduleSuggestions,
} from './suggestions';
import { daysBefore, templateKeyOf } from './plan-model';

describe('day templates + continuity', () => {
  it('a new day materializes from the weekday template plus yesterday tomorrow-plan', () => {
    const settings = defaultDailyPlanSettings();
    settings.templates = {
      all: { schedule: { '05:00': 'الفجر + قرآن' }, priorities: ['Deep work'], quick: ['Stretch'] },
      thu: { schedule: { '06:00': 'Gym — Push' }, priorities: ['Ship v1'], quick: [] },
    };
    const yesterday = emptyDailyPlanData();
    yesterday.tomorrow = [
      { t: 'Prep gym bag', done: false },
      { t: '', done: false },
    ];

    // 2026-07-09 is a Thursday → thu template wins over all.
    const day = materializeNewDay(settings, '2026-07-09', yesterday);
    expect(day.schedule['06:00']).toBe('Gym — Push');
    expect(day.schedule['05:00']).toBeUndefined();
    expect(day.priorities[0]).toEqual({ t: 'Ship v1', done: false });
    expect(day.quick.map((q) => q.t)).toEqual(['Prep gym bag']);

    // A Monday falls back to 'all'.
    const monday = materializeNewDay(settings, '2026-07-06', null);
    expect(monday.schedule['05:00']).toBe('الفجر + قرآن');
    expect(monday.quick.map((q) => q.t)).toEqual(['Stretch']);
  });

  it('templates with more priorities than the default 3 slots keep them all', () => {
    const settings = defaultDailyPlanSettings();
    settings.templates = {
      all: {
        schedule: {},
        priorities: ['One', 'Two', 'Three', 'Four', 'Five'],
        quick: [],
      },
    };
    const day = materializeNewDay(settings, '2026-07-09', null);
    expect(day.priorities.map((p) => p.t)).toEqual(['One', 'Two', 'Three', 'Four', 'Five']);
  });

  it('templateKeyOf maps dates to weekday keys', () => {
    expect(templateKeyOf('2026-07-06')).toBe('mon');
    expect(templateKeyOf('2026-07-09')).toBe('thu');
    expect(templateKeyOf('2026-07-12')).toBe('sun');
    expect(daysBefore('2026-07-09', 1)).toBe('2026-07-08');
  });

  it('carry-over collects unfinished items and fills empty priority slots first', () => {
    const yesterday = emptyDailyPlanData();
    yesterday.priorities = [
      { t: 'Finish report', done: false },
      { t: 'Done thing', done: true },
      { t: '', done: false },
    ];
    yesterday.quick = [
      { t: 'Call bank', done: false },
      { t: 'Bought milk', done: true },
    ];
    const carry = carryOverFrom(yesterday);
    expect(carry.count).toBe(2);

    const today = emptyDailyPlanData();
    today.priorities[0] = { t: 'Existing', done: false };
    const patch = applyCarryOver(today, carry);
    expect(patch.priorities?.[1]).toEqual({ t: 'Finish report', done: false });
    expect(patch.quick?.map((q) => q.t)).toEqual(['Call bank']);
  });

  it('carry-over skips duplicates already present today', () => {
    const yesterday = emptyDailyPlanData();
    yesterday.quick = [{ t: 'Call bank', done: false }];
    const today = emptyDailyPlanData();
    today.quick = [{ t: 'call bank', done: false }];
    const patch = applyCarryOver(today, carryOverFrom(yesterday));
    expect(patch.quick).toHaveLength(1);
  });

  it('templateFromDay snapshots texts only (no done state, no empties)', () => {
    const day = emptyDailyPlanData();
    day.schedule = { '05:00': 'الفجر', '09:00': '' };
    day.priorities = [
      { t: 'Deep work', done: true },
      { t: '', done: false },
    ];
    day.quick = [{ t: 'Stretch', done: true }];
    const template = templateFromDay(day);
    expect(template.schedule).toEqual({ '05:00': 'الفجر' });
    expect(template.priorities).toEqual(['Deep work']);
    expect(template.quick).toEqual(['Stretch']);
  });
});

describe('suggestions from past days', () => {
  const mkDay = (patch: Partial<ReturnType<typeof emptyDailyPlanData>>) => ({
    ...emptyDailyPlanData(),
    ...patch,
  });

  it('schedule suggestions rank by frequency at that hour', () => {
    const days = [
      mkDay({ schedule: { '06:00': 'Gym — Push' } }),
      mkDay({ schedule: { '06:00': 'Gym — Push' } }),
      mkDay({ schedule: { '06:00': 'Long run' } }),
    ];
    expect(scheduleSuggestions(days, '06:00')).toEqual(['Gym — Push', 'Long run']);
    expect(scheduleSuggestions(days, '09:00')).toEqual([]);
  });

  it('priority/quick pools dedupe case-insensitively and cap at 6', () => {
    const days = [
      mkDay({ priorities: [{ t: 'Deep work', done: true }] }),
      mkDay({ priorities: [{ t: 'deep work', done: false }] }),
      mkDay({ quick: [{ t: 'Stretch', done: false }] }),
    ];
    expect(prioritySuggestions(days)).toEqual(['deep work']);
    expect(quickSuggestions(days)).toEqual(['Stretch']);
  });

  it('recentMealItems returns unique names, newest first', () => {
    const older = mkDay({});
    older.meals = {
      breakfast: [{ n: 'Eggs & oats', cal: 520, p: 32, c: 55, f: 18 }],
      lunch: [],
      dinner: [],
      snacks: [],
    };
    const newer = mkDay({});
    newer.meals = {
      breakfast: [{ n: 'eggs & oats', cal: 500, p: 30, c: 50, f: 17 }],
      lunch: [{ n: 'Chicken & rice', cal: 700, p: 50, c: 70, f: 18 }],
      dinner: [],
      snacks: [],
    };
    const recent = recentMealItems([older, newer]);
    expect(recent.map((m) => m.n)).toEqual(['Chicken & rice', 'eggs & oats']);
    expect(recent[1]?.cal).toBe(500); // newest occurrence wins
  });
});
