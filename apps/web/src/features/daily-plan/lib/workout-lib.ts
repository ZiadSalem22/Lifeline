import type { DailyPlanData, DailyPlanSettings, GymExercise, GymRoutine } from '@lifeline/shared';

/** Workout card domain helpers (pure — shared by the card, view, and tests). */

/** MET (metabolic equivalent) per cardio intensity — 2011 Compendium values. */
export const CARDIO_MET: Record<GymExercise['effort'], number> = {
  walk: 3.5,
  jog: 7.0,
  run: 9.8,
};

/**
 * Calories for `minutes` of cardio at a given effort and body weight, via the
 * standard MET formula: kcal/min = MET × 3.5 × kg / 200. Honest to ±, so
 * callers round and prefix "~". Returns 0 when weight is unknown (never fake it).
 */
export function cardioKcal(
  effort: GymExercise['effort'],
  weightKg: number,
  minutes: number,
): number {
  if (weightKg <= 0 || minutes <= 0) return 0;
  return ((CARDIO_MET[effort] * 3.5 * weightKg) / 200) * minutes;
}

export interface CardioSnapshot {
  min: number;
  km: number;
  kcal: number;
}

/**
 * Recompute a routine's cardio snapshot (minutes/km/kcal) from its COMPLETED
 * timed exercises — one dot = one round of `min` minutes. Written into the day
 * blob on every timed-dot change so the settings-free metrics extractor can
 * read cardio, and so later routine edits never rewrite this day's history.
 */
export function computeCardio(
  routine: GymRoutine,
  done: number[],
  weightKg: number,
): CardioSnapshot {
  let min = 0;
  let km = 0;
  let kcal = 0;
  routine.ex.forEach((ex, i) => {
    if (ex.type !== 'time') return;
    const rounds = Math.min(done[i] ?? 0, ex.sets);
    if (rounds <= 0) return;
    const minutes = rounds * ex.min;
    min += minutes;
    km += rounds * ex.km;
    kcal += cardioKcal(ex.effort, weightKg, minutes);
  });
  // Clamp to the cardioDone schema caps — per-exercise input caps don't
  // compose to the day caps (10 rounds × 600 min = 6000 > 1440), and an
  // over-cap snapshot would throw on save and silently drop the whole day.
  return {
    min: Math.min(1440, min),
    km: Math.min(300, Math.round(km * 100) / 100),
    kcal: Math.min(5000, Math.round(kcal)),
  };
}

export interface WorkoutState {
  day: DailyPlanData;
  settings: DailyPlanSettings;
  selectedIdx: number;
}

/** Per-day override → weekly split → rest. */
export function resolveRoutineKey(state: WorkoutState): string {
  const { day, settings, selectedIdx } = state;
  if (day.workoutRoutine && settings.gym.routines[day.workoutRoutine]) return day.workoutRoutine;
  const fromWeek = settings.gym.week[selectedIdx];
  if (fromWeek && settings.gym.routines[fromWeek]) return fromWeek;
  return 'rest';
}

export function routineOf(settings: DailyPlanSettings, key: string): GymRoutine {
  return settings.gym.routines[key] ?? { name: 'Rest', ex: [] };
}

/**
 * Unique routine key checked against the persisted set. A module counter
 * alone resets per page load and can re-mint an existing key, silently
 * REPLACING that routine on spread-merge (data loss).
 */
export function newRoutineKey(routines: Record<string, GymRoutine>): string {
  let seq = 1;
  while (`r${seq}` in routines) seq += 1;
  return `r${seq}`;
}

export function isRoutineComplete(routine: GymRoutine, done: number[]): boolean {
  return (
    routine.ex.length > 0 && routine.ex.every((ex, i) => Math.min(done[i] ?? 0, ex.sets) >= ex.sets)
  );
}

/** Header badge: `x/y SETS` or `REST`. */
export function workoutBadge(state: WorkoutState): string {
  const key = resolveRoutineKey(state);
  const routine = routineOf(state.settings, key);
  if (routine.ex.length === 0) return 'REST';
  const done = state.day.workoutDone[key] ?? [];
  const total = routine.ex.reduce((a, x) => a + x.sets, 0);
  const doneSets = routine.ex.reduce((a, x, i) => a + Math.min(done[i] ?? 0, x.sets), 0);
  return `${doneSets}/${total} SETS`;
}
