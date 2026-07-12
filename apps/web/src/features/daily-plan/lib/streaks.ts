import type { HabitMark } from '@lifeline/shared';
import { daysBefore } from './plan-model';

/**
 * Habit streak math. Marks come from day blobs across sources (this week's
 * cache + the 28-day recent window), so callers pass a lookup instead of a
 * single map. Semantics:
 * - a streak is consecutive DONE days ending today or yesterday (today not
 *   being done YET must not read as a broken streak mid-morning);
 * - 'skip' days pass through — they neither count nor break;
 * - an unmarked/false day before that ends the walk.
 */
export function habitStreak(
  markFor: (date: string) => HabitMark | undefined,
  todayStr: string,
  maxDays = 366,
): number {
  let count = 0;
  let date = todayStr;
  // Today: done counts; empty or skip is neutral (the day isn't over).
  const today = markFor(date);
  if (today === true) count += 1;
  else if (today === false) return 0;
  for (let i = 1; i <= maxDays; i += 1) {
    date = daysBefore(date, 1);
    const mark = markFor(date);
    if (mark === true) count += 1;
    else if (mark === 'skip') continue;
    else break;
  }
  return count;
}

/**
 * The last `windowDays` marks ENDING TODAY, oldest → newest — the habit
 * mini-history strip. Missing days come back undefined.
 */
export function habitHistory(
  markFor: (date: string) => HabitMark | undefined,
  todayStr: string,
  windowDays = 28,
): { date: string; mark: HabitMark | undefined }[] {
  const out: { date: string; mark: HabitMark | undefined }[] = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const date = daysBefore(todayStr, i);
    out.push({ date, mark: markFor(date) });
  }
  return out;
}
