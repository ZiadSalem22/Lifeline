import { describe, expect, it } from 'vitest';
import { gymRoutineSchema } from '@lifeline/shared';
import { CARDIO_MET, cardioKcal, computeCardio } from './workout-lib';

/**
 * Cardio math for the timed-exercise type: MET-based calories and the per-day
 * snapshot the card writes into the day blob.
 */

describe('cardioKcal', () => {
  it('uses kcal/min = MET × 3.5 × kg / 200', () => {
    // walk (3.5 MET), 80 kg, 15 min → 3.5 × 3.5 × 80 / 200 × 15 = 73.5
    expect(cardioKcal('walk', 80, 15)).toBeCloseTo(73.5, 1);
    expect(CARDIO_MET.run).toBeGreaterThan(CARDIO_MET.jog);
    expect(CARDIO_MET.jog).toBeGreaterThan(CARDIO_MET.walk);
  });

  it('returns 0 when weight or minutes are unknown (never faked)', () => {
    expect(cardioKcal('run', 0, 20)).toBe(0);
    expect(cardioKcal('run', 80, 0)).toBe(0);
  });
});

describe('computeCardio', () => {
  const routine = gymRoutineSchema.parse({
    name: 'Mixed',
    ex: [
      { n: 'Walk', type: 'time', sets: 1, min: 20, km: 2, effort: 'walk' },
      { n: 'Bench Press', type: 'str', sets: 3, reps: '8', kg: 60 },
      { n: 'Intervals', type: 'time', sets: 4, min: 2, km: 0.5, effort: 'run' },
    ],
  });

  it('sums only COMPLETED timed exercises; strength rows are ignored', () => {
    // Walk done 1 of 1 round (20 min), Bench 3 sets (ignored — strength),
    // Intervals done 3 of 4 rounds → 3 × 2 = 6 min, 3 × 0.5 = 1.5 km.
    const c = computeCardio(routine, [1, 3, 3], 80);
    expect(c.min).toBe(26);
    expect(c.km).toBe(3.5);
    expect(c.kcal).toBeGreaterThan(0);
  });

  it('is zero for a purely strength routine', () => {
    const strength = gymRoutineSchema.parse({
      name: 'Push',
      ex: [{ n: 'Bench Press', type: 'str', sets: 3, reps: '8', kg: 60 }],
    });
    expect(computeCardio(strength, [3], 80)).toEqual({ min: 0, km: 0, kcal: 0 });
  });

  it('clamps done rounds to the exercise round count', () => {
    // 5 taps but only 1 round configured → counts 1 × 20 min, not 5.
    expect(computeCardio(routine, [5, 0, 0], 80).min).toBe(20);
  });
});
