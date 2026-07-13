import { describe, expect, it } from 'vitest';
import { dailyPlanDataSchema, emptyDailyPlanData } from './daily-plan.js';
import { extractDayMetrics, planScoreFromMetrics } from './daily-plan-metrics.js';

describe('extractDayMetrics', () => {
  it('an empty day yields zeros, empty maps, and NULL mood/rating (0 = unset)', () => {
    const m = extractDayMetrics('2026-07-13', emptyDailyPlanData());
    expect(m).toMatchObject({
      date: '2026-07-13',
      habits: {},
      prioritiesDone: 0,
      prioritiesTotal: 0,
      quickDone: 0,
      quickTotal: 0,
      nonnegsDone: 0,
      water: 0,
      kcal: 0,
      protein: 0,
      mealCount: 0,
      workoutSets: 0,
      workoutByRoutine: {},
      moodAm: null,
      moodPm: null,
      rating: null,
      weight: null,
      journal: false,
      gratitudeCount: 0,
    });
  });

  it('weight: 0-as-unset maps to null, a logged weigh-in passes through', () => {
    expect(extractDayMetrics('2026-07-13', emptyDailyPlanData()).weight).toBeNull();
    const weighed = dailyPlanDataSchema.parse({ weight: 82.4 });
    expect(extractDayMetrics('2026-07-13', weighed).weight).toBe(82.4);
  });

  it('a lived day sums meals, counts sets per routine, and keeps raw habit marks', () => {
    const day = dailyPlanDataSchema.parse({
      habits: { fajr: true, gym: 'skip', deletedHabit: true, reading: false },
      priorities: [
        { t: 'Ship it', done: true },
        { t: 'Call bank', done: false },
        { t: '', done: true }, // empty slot: never counted, even "done"
      ],
      quick: [{ t: 'Stretch', done: true }],
      nonnegs: [true, true, false],
      water: 6,
      meals: {
        breakfast: [{ n: 'Eggs', cal: 156, p: 12, c: 1, f: 10 }],
        lunch: [{ n: 'Chicken & rice', cal: 700, p: 50, c: 70, f: 18 }],
        dinner: [],
        snacks: [{ n: 'Apple', cal: 95, p: 0, c: 25, f: 0 }],
      },
      workoutDone: { push: [3, 3, 2], legs: [0, 0] },
      moodAm: 4,
      moodPm: 0, // unset
      rating: 3,
      reviewWell: 'Great focus.',
      gratitude: ['صحة الوالدين', '', 'Coffee'],
    });
    const m = extractDayMetrics('2026-07-13', day);
    expect(m.habits).toEqual({ fajr: true, gym: 'skip', deletedHabit: true, reading: false });
    expect(m.prioritiesDone).toBe(1);
    expect(m.prioritiesTotal).toBe(2);
    expect(m.quickDone).toBe(1);
    expect(m.nonnegsDone).toBe(2);
    expect(m.kcal).toBe(951);
    expect(m.protein).toBe(62);
    expect(m.carbs).toBe(96);
    expect(m.fat).toBe(28);
    expect(m.mealCount).toBe(3);
    expect(m.workoutSets).toBe(8);
    expect(m.workoutByRoutine).toEqual({ push: 8 }); // zero-set routines omitted
    expect(m.moodAm).toBe(4);
    expect(m.moodPm).toBeNull();
    expect(m.rating).toBe(3);
    expect(m.journal).toBe(true);
    expect(m.gratitudeCount).toBe(2);
  });
});

describe('planScoreFromMetrics', () => {
  const settings = {
    habitIds: ['fajr', 'gym', 'reading'],
    waterGoal: 8,
    nonnegCount: 5,
    hidden: {},
  };

  it('mirrors the score-ring math: skip-neutral, used-priorities-only, water clamp', () => {
    const day = dailyPlanDataSchema.parse({
      habits: { fajr: true, gym: 'skip', reading: false, orphan: true },
      priorities: [
        { t: 'One', done: true },
        { t: '', done: false },
      ],
      water: 10, // over goal → clamped to 8
      nonnegs: [true],
    });
    const m = extractDayMetrics('2026-07-13', day);
    const score = planScoreFromMetrics(m, settings, { done: 1, total: 2 });
    // habits 1/2 (gym skipped, orphan filtered) + tasks 1/2 + priorities 1/1
    // + nonnegs 1/5 + water 8/8 → done 12 / total 18
    expect(score).toBe(Math.round((12 / 18) * 100));
  });

  it('omitting tasks gives a plan-only score; hidden cards drop out', () => {
    const m = extractDayMetrics(
      '2026-07-13',
      dailyPlanDataSchema.parse({ habits: { fajr: true } }),
    );
    const score = planScoreFromMetrics(m, {
      ...settings,
      hidden: { water: true, nonneg: true, todo: true, priorities: true },
    });
    expect(score).toBe(Math.round((1 / 3) * 100)); // fajr of 3 tracked habits
  });
});
