import type { DailyPlanData, DailyPlanSettings, GymRoutine } from '@lifeline/shared';
import { cardioKcal, strengthKcal } from '@lifeline/shared';

/** Workout card domain helpers (pure — shared by the card, view, and tests). */

// Calorie math (MET table + ACSM speed/incline equations) lives in the shared
// energy lib so the server's MCP tools compute identical numbers.
export { CARDIO_MET, acsmKcalPerMin, cardioKcal, strengthKcal } from '@lifeline/shared';

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
    kcal += cardioKcal(ex, weightKg, minutes);
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

export interface StrengthSnapshot {
  sets: number;
  kcal: number;
}

/**
 * Strength counterpart of computeCardio: completed sets across the routine's
 * strength exercises + their kcal estimate. Same snapshot rationale (frozen
 * history, settings-free metrics), same cap discipline (schema: sets ≤ 320,
 * kcal ≤ 5000).
 */
export function computeStrength(
  routine: GymRoutine,
  done: number[],
  weightKg: number,
): StrengthSnapshot {
  let sets = 0;
  routine.ex.forEach((ex, i) => {
    if (ex.type !== 'str') return;
    sets += Math.min(done[i] ?? 0, ex.sets);
  });
  return {
    sets: Math.min(320, sets),
    kcal: Math.min(5000, Math.round(strengthKcal(Math.min(320, sets), weightKg))),
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
