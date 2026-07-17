import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_HABITS,
  dailyPlanDataSchema,
  dailyPlanRangeQuerySchema,
  dailyPlanSettingsSchema,
  defaultDailyPlanSettings,
  emptyDailyPlanData,
} from './daily-plan.js';

describe('dailyPlanDataSchema', () => {
  it('parse({}) yields a complete, well-formed empty day', () => {
    const day = emptyDailyPlanData();
    expect(day.priorities).toHaveLength(3);
    expect(day.tomorrow).toHaveLength(4);
    expect(day.nonnegs).toEqual([false, false, false, false, false]);
    expect(day.meals).toEqual({ breakfast: [], lunch: [], dinner: [], snacks: [] });
    expect(day.water).toBe(0);
    expect(day.habits).toEqual({});
    expect(day.workoutDone).toEqual({});
    expect(day.workoutRoutine).toBeNull();
    expect(day.lastLog).toBeNull();
  });

  it('accepts a realistic day blob and preserves values', () => {
    const day = dailyPlanDataSchema.parse({
      schedule: { '05:00': 'الفجر + قرآن', '06:00': 'Gym — Push' },
      priorities: [{ t: 'Ship Daily Plan v1', done: true }],
      habits: { fajr: true, gym: false },
      quick: [{ t: 'Refill protein', done: false }],
      water: 5,
      meals: { breakfast: [{ n: 'Eggs & oats', cal: 520, p: 32, c: 55, f: 18 }] },
      chat: [{ who: 'ai', t: 'logged ✓', foods: [{ name: 'egg', cal: 78, p: 6, c: 0.6, f: 5 }] }],
      lastLog: { slot: 'breakfast', count: 1 },
      workoutDone: { push: [4, 3, 0] },
      workoutRoutine: 'push',
    });
    expect(day.schedule['05:00']).toBe('الفجر + قرآن');
    expect(day.habits['fajr']).toBe(true);
    expect(day.meals.breakfast[0]?.cal).toBe(520);
    expect(day.workoutDone['push']).toEqual([4, 3, 0]);
  });

  it('rejects out-of-bounds values (water, rating, oversized text)', () => {
    expect(dailyPlanDataSchema.safeParse({ water: 99 }).success).toBe(false);
    expect(dailyPlanDataSchema.safeParse({ rating: 9 }).success).toBe(false);
    expect(dailyPlanDataSchema.safeParse({ focusText: 'x'.repeat(2001) }).success).toBe(false);
  });
});

describe('dailyPlanSettingsSchema', () => {
  it('parse({}) seeds the 15 design habits (5 prayers first) and default gym/presets/targets', () => {
    const settings = defaultDailyPlanSettings();
    expect(settings.habits).toHaveLength(15);
    expect(settings.habits.slice(0, 5).every((h) => h.salah)).toBe(true);
    expect(settings.habits.map((h) => h.id)).toEqual(DEFAULT_PLAN_HABITS.map((h) => h.id));
    expect(Object.keys(settings.gym.routines)).toEqual(
      expect.arrayContaining(['push', 'pull', 'legs', 'rest']),
    );
    expect(settings.gym.week).toHaveLength(7);
    expect(settings.targets).toEqual({ kcal: 2400, protein: 180, carbs: 250, water: 8 });
    expect(settings.gymTaskNumber).toBeNull();
    expect(settings.gymHabitId).toBe('gym');
    expect(settings.presets.filter((p) => p.pinned)).toHaveLength(2);
  });

  it('gym week must be exactly 7 entries', () => {
    expect(dailyPlanSettingsSchema.safeParse({ gym: { week: ['push'] } }).success).toBe(false);
  });

  it('personalization defaults: labels, motto, hours, counts, empty templates', () => {
    const settings = defaultDailyPlanSettings();
    expect(settings.nonnegLabels).toHaveLength(5);
    expect(settings.nonnegLabels[0]).toBe('Stay Disciplined');
    expect(settings.motto).toBe('No excuses. Just execution.');
    expect(settings.subtitle).toBe('discipline · focus · execution');
    expect(settings.dayStartHour).toBe(4);
    expect(settings.dayEndHour).toBe(24);
    expect(settings.priorityCount).toBe(3);
    expect(settings.gratitudeCount).toBe(3);
    expect(settings.tomorrowCount).toBe(4);
    expect(settings.templates).toEqual({});
    // Prayer times default dormant (no city/coords) with Auto calculation method.
    expect(settings.prayer).toEqual({
      enabled: true,
      city: '',
      country: '',
      method: -1,
      latitude: null,
      longitude: null,
    });
  });

  it('day templates roundtrip per weekday and stored pre-personalization blobs self-heal', () => {
    const parsed = dailyPlanSettingsSchema.parse({
      density: 'roomy', // an "old" blob — none of the new fields present
      templates: {
        mon: { schedule: { '06:00': 'Gym — Push' }, priorities: ['Deep work'], quick: ['Stretch'] },
      },
    });
    expect(parsed.templates.mon?.schedule['06:00']).toBe('Gym — Push');
    expect(parsed.templates.mon?.priorities).toEqual(['Deep work']);
    expect(parsed.nonnegLabels).toHaveLength(5); // healed defaults
    expect(parsed.dayStartHour).toBe(4);
    expect(
      dailyPlanSettingsSchema.safeParse({ templates: { funday: { schedule: {} } } }).success,
    ).toBe(false);
  });
});

describe('dailyPlanRangeQuerySchema', () => {
  it('accepts ordered ranges and rejects reversed ones', () => {
    expect(
      dailyPlanRangeQuerySchema.safeParse({ start: '2026-07-06', end: '2026-07-12' }).success,
    ).toBe(true);
    expect(
      dailyPlanRangeQuerySchema.safeParse({ start: '2026-07-12', end: '2026-07-06' }).success,
    ).toBe(false);
  });
});
