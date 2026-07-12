import type { DailyPlanData } from '@lifeline/shared';

export interface ScoreInput {
  day: DailyPlanData;
  /** The day's real tasks (already day-filtered). */
  taskTotal: number;
  taskDone: number;
  /**
   * The habit ids currently in the tracker — deleted habits may leave orphan
   * checkmarks in old day rows, which must not inflate the score.
   */
  habitIds: string[];
  waterGoal: number;
  /** Editable non-negotiable labels count. */
  nonnegCount: number;
  /** Hidden cards don't count against the score. */
  hidden: Record<string, boolean>;
}

/**
 * Daily score — done/total across the sections the user actually uses:
 * hidden cards are excluded entirely, and only priorities with text count
 * (three empty slots must not drag the ring down). The masthead ring.
 */
export function computeScore(input: ScoreInput): number {
  const { day, taskTotal, taskDone, habitIds, waterGoal, nonnegCount, hidden } = input;

  let total = 0;
  let done = 0;

  if (!hidden['habits']) {
    // Skipped habits (sick/travel day) drop out of BOTH sides — a deliberate
    // rest must not tank the ring the tracker is supposed to reward.
    const counted = habitIds.filter((id) => day.habits[id] !== 'skip');
    total += counted.length;
    done += counted.filter((id) => day.habits[id] === true).length;
  }
  if (!hidden['todo']) {
    total += taskTotal + day.quick.length;
    done += taskDone + day.quick.filter((q) => q.done).length;
  }
  if (!hidden['priorities']) {
    const used = day.priorities.filter((p) => p.t.trim().length > 0);
    total += used.length;
    done += used.filter((p) => p.done).length;
  }
  if (!hidden['nonneg']) {
    total += nonnegCount;
    done += day.nonnegs.slice(0, nonnegCount).filter(Boolean).length;
  }
  if (!hidden['water']) {
    total += waterGoal;
    done += Math.min(day.water, waterGoal);
  }

  return total > 0 ? Math.round((done / total) * 100) : 0;
}
