import type { DailyPlanData } from '@lifeline/shared';

export interface ScoreInput {
  day: DailyPlanData;
  /** The day's real tasks (already day-filtered). */
  taskTotal: number;
  taskDone: number;
  /** Habit rows shown in the tracker (settings.habits length). */
  habitCount: number;
  waterGoal: number;
}

/**
 * Daily score = done/total across habits (today), real tasks, quick to-dos,
 * top-3 priorities, non-negotiables, and water cups — the masthead ring.
 */
export function computeScore(input: ScoreInput): number {
  const { day, taskTotal, taskDone, habitCount, waterGoal } = input;
  const habitsDone = Object.values(day.habits).filter(Boolean).length;
  const quickDone = day.quick.filter((q) => q.done).length;
  const prioDone = day.priorities.filter((p) => p.done).length;
  const nnDone = day.nonnegs.filter(Boolean).length;

  const total =
    habitCount +
    taskTotal +
    day.quick.length +
    day.priorities.length +
    day.nonnegs.length +
    waterGoal;
  const done =
    Math.min(habitsDone, habitCount) +
    taskDone +
    quickDone +
    prioDone +
    nnDone +
    Math.min(day.water, waterGoal);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
