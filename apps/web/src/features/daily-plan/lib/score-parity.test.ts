import { describe, expect, it } from 'vitest';
import {
  dailyPlanDataSchema,
  extractDayMetrics,
  planScoreFromMetrics,
  type DailyPlanData,
} from '@lifeline/shared';
import { computeScore } from './score';

/**
 * The score ring (computeScore, apps/web) and the Statistics/Review score
 * (planScoreFromMetrics, shared) MUST agree for the same day, or the same
 * date shows two different numbers across pages. This is the parity test the
 * planScoreFromMetrics docstring promises: feed identical days + task counts +
 * settings through both and assert equality. It guards the historical drifts
 * (orphan non-negs, empty quick slots) that this pass fixed.
 */

const SETTINGS = {
  habitIds: ['fajr', 'gym', 'reading'],
  waterGoal: 8,
  nonnegCount: 3,
  hidden: {} as Record<string, boolean>,
};

function both(
  overrides: Partial<DailyPlanData>,
  tasks: { done: number; total: number },
  hidden: Record<string, boolean> = {},
) {
  const day = dailyPlanDataSchema.parse(overrides);
  const ring = computeScore({
    day,
    taskTotal: tasks.total,
    taskDone: tasks.done,
    habitIds: SETTINGS.habitIds,
    waterGoal: SETTINGS.waterGoal,
    nonnegCount: SETTINGS.nonnegCount,
    hidden,
  });
  const stats = planScoreFromMetrics(
    extractDayMetrics('2026-07-13', day),
    { ...SETTINGS, hidden },
    tasks,
  );
  return { ring, stats };
}

describe('score parity: computeScore ↔ planScoreFromMetrics', () => {
  it('a typical lived day agrees', () => {
    const { ring, stats } = both(
      {
        habits: { fajr: true, gym: false, reading: true },
        priorities: [{ t: 'Ship', done: true }],
        quick: [{ t: 'Stretch', done: true }],
        nonnegs: [true, false, true],
        water: 6,
      },
      { done: 3, total: 5 },
    );
    expect(stats).toBe(ring);
  });

  it('skipped habits drop out of both sides identically', () => {
    const { ring, stats } = both(
      { habits: { fajr: true, gym: 'skip', reading: false }, water: 8 },
      { done: 0, total: 0 },
    );
    expect(stats).toBe(ring);
  });

  it('orphan non-neg flags beyond the current label count never inflate either score', () => {
    // 5 stored flags, only 3 labels — the last two are orphans.
    const { ring, stats } = both(
      { nonnegs: [false, false, false, true, true], habits: { fajr: true } },
      { done: 0, total: 0 },
    );
    expect(stats).toBe(ring); // both slice to the first 3 → 0 done
  });

  it('empty quick slots are ignored by both (no ring drag)', () => {
    const { ring, stats } = both(
      {
        quick: [
          { t: '', done: true },
          { t: 'Real', done: false },
        ],
        habits: { fajr: true },
      },
      { done: 0, total: 0 },
    );
    expect(stats).toBe(ring);
  });

  it('water over goal clamps the same on both', () => {
    const { ring, stats } = both({ water: 20, habits: { fajr: true } }, { done: 0, total: 0 });
    expect(stats).toBe(ring);
  });

  it('hidden cards are excluded consistently', () => {
    const { ring, stats } = both(
      { habits: { fajr: true }, water: 4, nonnegs: [true, true, true] },
      { done: 2, total: 4 },
      { water: true, nonneg: true },
    );
    expect(stats).toBe(ring);
  });

  it('an empty day agrees (0)', () => {
    const { ring, stats } = both({}, { done: 0, total: 0 });
    expect(stats).toBe(ring);
  });
});
