import { describe, expect, it } from 'vitest';
import { defaultDailyPlanSettings, emptyDailyPlanData } from '@lifeline/shared';
import { carryOverFrom, carryTitles, materializeNewDay, templateFromDay } from './templates';
import {
  prioritySuggestions,
  quickSuggestions,
  recentMealItems,
  scheduleSuggestions,
} from './suggestions';
import { daysAfter, daysBefore, templateKeyOf } from './plan-model';

describe('day templates + continuity', () => {
  it('a new day materializes from the weekday template (quick stays empty — tasks are real now)', () => {
    const settings = defaultDailyPlanSettings();
    settings.templates = {
      all: { schedule: { '05:00': 'الفجر + قرآن' }, priorities: ['Deep work'], quick: ['Stretch'] },
      thu: { schedule: { '06:00': 'Gym — Push' }, priorities: ['Ship v1'], quick: [] },
    };

    // 2026-07-09 is a Thursday → thu template wins over all.
    const day = materializeNewDay(settings, '2026-07-09');
    expect(day.schedule['06:00']).toBe('Gym — Push');
    expect(day.schedule['05:00']).toBeUndefined();
    expect(day.priorities[0]).toEqual({ t: 'Ship v1', done: false });
    expect(day.quick).toEqual([]);

    // A Monday falls back to 'all' — even a legacy template's quick list no
    // longer seeds scratch items (quick-add creates real tasks instead).
    const monday = materializeNewDay(settings, '2026-07-06');
    expect(monday.schedule['05:00']).toBe('الفجر + قرآن');
    expect(monday.quick).toEqual([]);
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
    const day = materializeNewDay(settings, '2026-07-09');
    expect(day.priorities.map((p) => p.t)).toEqual(['One', 'Two', 'Three', 'Four', 'Five']);
  });

  it('templateKeyOf maps dates to weekday keys', () => {
    expect(templateKeyOf('2026-07-06')).toBe('mon');
    expect(templateKeyOf('2026-07-09')).toBe('thu');
    expect(templateKeyOf('2026-07-12')).toBe('sun');
    expect(daysBefore('2026-07-09', 1)).toBe('2026-07-08');
    expect(daysAfter('2026-07-09', 1)).toBe('2026-07-10');
  });

  it('carry-over collects unfinished priorities, quick items AND tomorrow notes', () => {
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
    yesterday.tomorrow = [
      { t: 'Prep gym bag', done: false },
      { t: 'Checked note', done: true },
      { t: '', done: false },
    ];
    const carry = carryOverFrom(yesterday);
    expect(carry.count).toBe(3);
    expect(carryTitles(carry)).toEqual(['Finish report', 'Call bank', 'Prep gym bag']);
  });

  it('carry-over dedupes case-insensitively across the three pools', () => {
    const yesterday = emptyDailyPlanData();
    yesterday.priorities = [{ t: 'Call bank', done: false }];
    yesterday.quick = [{ t: 'call bank', done: false }];
    yesterday.tomorrow = [{ t: 'CALL BANK', done: false }];
    const carry = carryOverFrom(yesterday);
    expect(carry.count).toBe(1);
    expect(carryTitles(carry)).toEqual(['Call bank']);
  });

  it('templateFromDay snapshots texts only — and never quick items (deprecated)', () => {
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
    expect(template.quick).toEqual([]);
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
