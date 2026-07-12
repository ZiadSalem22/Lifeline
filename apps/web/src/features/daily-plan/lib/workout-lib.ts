import type { DailyPlanData, DailyPlanSettings, GymRoutine } from '@lifeline/shared';

/** Workout card domain helpers (pure — shared by the card, view, and tests). */

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
