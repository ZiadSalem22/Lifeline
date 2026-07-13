import { z } from 'zod';
import { dateOnlySchema } from './todo.js';
import { dailyPlanRangeQuerySchema, habitMarkSchema } from './daily-plan.js';
import type { DailyPlanData, HabitMark } from './daily-plan.js';

/**
 * Derived analytics over the daily-plan store. `extractDayMetrics` is the
 * single source of truth: the server metrics endpoint and the guest local
 * adapter both map stored day blobs through it, so both modes agree by
 * construction. The extractor is settings-free on purpose — everything that
 * depends on settings (habit labels, goals, hidden cards, targets) happens
 * at aggregation time against the CURRENT settings.
 */

/**
 * Metrics range cap — imported by the server use case AND the guest local
 * adapter. Deliberately one constant: the 62-day cap on the raw range
 * endpoint is duplicated in two places today and has already drifted once.
 */
export const MAX_PLAN_METRICS_DAYS = 400;

export const dayMetricsSchema = z.object({
  date: dateOnlySchema,
  /**
   * RAW marks including orphaned habit ids — consumers filter against the
   * current settings.habits at read time (the computeScore idiom).
   */
  habits: z.record(z.string(), habitMarkSchema),
  /** "Used" priorities = non-empty text (empty slots never count). */
  prioritiesDone: z.number().int(),
  prioritiesTotal: z.number().int(),
  quickDone: z.number().int(),
  quickTotal: z.number().int(),
  /** Total comes from settings.nonnegLabels at read time. */
  nonnegsDone: z.number().int(),
  water: z.number().int(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  /** Distinguishes "nothing logged" from a genuine 0-kcal day. */
  mealCount: z.number().int(),
  /** Sets done across all routines. */
  workoutSets: z.number().int(),
  /** routineKey → sets done (only keys with > 0). */
  workoutByRoutine: z.record(z.string(), z.number().int()),
  /** Storage uses 0-as-unset — null here so averages never see fake zeros. */
  moodAm: z.number().int().min(1).max(5).nullable(),
  moodPm: z.number().int().min(1).max(5).nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  /** Any journal text written (review fields or focus). */
  journal: z.boolean(),
  gratitudeCount: z.number().int(),
});
export type DayMetrics = z.infer<typeof dayMetricsSchema>;

export const planMetricsQuerySchema = dailyPlanRangeQuerySchema;
export type PlanMetricsQuery = z.infer<typeof planMetricsQuerySchema>;

export const planMetricsResponseSchema = z.object({
  items: z.array(dayMetricsSchema),
});
export type PlanMetricsResponse = z.infer<typeof planMetricsResponseSchema>;

const nonEmpty = (t: string): boolean => t.trim().length > 0;
const nullIfUnset = (v: number): number | null => (v >= 1 && v <= 5 ? v : null);

/** Compact per-day metrics from a stored day blob (pure, settings-free). */
export function extractDayMetrics(date: string, data: DailyPlanData): DayMetrics {
  const usedPriorities = data.priorities.filter((p) => nonEmpty(p.t));
  const usedQuick = data.quick.filter((q) => nonEmpty(q.t));

  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let mealCount = 0;
  for (const slot of [data.meals.breakfast, data.meals.lunch, data.meals.dinner]) {
    for (const item of slot) {
      kcal += item.cal;
      protein += item.p;
      carbs += item.c;
      fat += item.f;
      mealCount += 1;
    }
  }
  for (const item of data.meals.snacks) {
    kcal += item.cal;
    protein += item.p;
    carbs += item.c;
    fat += item.f;
    mealCount += 1;
  }

  let workoutSets = 0;
  const workoutByRoutine: Record<string, number> = {};
  for (const [routineKey, sets] of Object.entries(data.workoutDone)) {
    const done = sets.reduce((sum, n) => sum + n, 0);
    if (done > 0) {
      workoutByRoutine[routineKey] = done;
      workoutSets += done;
    }
  }

  return {
    date,
    habits: { ...data.habits },
    prioritiesDone: usedPriorities.filter((p) => p.done).length,
    prioritiesTotal: usedPriorities.length,
    quickDone: usedQuick.filter((q) => q.done).length,
    quickTotal: usedQuick.length,
    nonnegsDone: data.nonnegs.filter(Boolean).length,
    water: data.water,
    kcal,
    protein,
    carbs,
    fat,
    mealCount,
    workoutSets,
    workoutByRoutine,
    moodAm: nullIfUnset(data.moodAm),
    moodPm: nullIfUnset(data.moodPm),
    rating: nullIfUnset(data.rating),
    journal:
      nonEmpty(data.reviewWell) ||
      nonEmpty(data.reviewImprove) ||
      nonEmpty(data.reviewForward) ||
      nonEmpty(data.focusText),
    gratitudeCount: data.gratitude.filter(nonEmpty).length,
  };
}

export interface PlanScoreSettings {
  habitIds: string[];
  waterGoal: number;
  nonnegCount: number;
  hidden: Record<string, boolean>;
}

/**
 * The daily score ring's section math over DayMetrics — skip-neutral habits,
 * used-priorities-only, water clamped to goal, hidden cards excluded. Pass
 * `tasks` to include the real-task portion (the web joins it from the todos
 * store); omitted = plan-only score. A web parity test pins this to the plan
 * view's computeScore so the two can never drift.
 */
export function planScoreFromMetrics(
  m: DayMetrics,
  s: PlanScoreSettings,
  tasks?: { done: number; total: number },
): number {
  let total = 0;
  let done = 0;

  if (!s.hidden['habits']) {
    const marks = s.habitIds.map((id): HabitMark | undefined => m.habits[id]);
    const counted = marks.filter((mark) => mark !== 'skip');
    total += counted.length;
    done += counted.filter((mark) => mark === true).length;
  }
  if (!s.hidden['todo']) {
    total += (tasks?.total ?? 0) + m.quickTotal;
    done += (tasks?.done ?? 0) + m.quickDone;
  }
  if (!s.hidden['priorities']) {
    total += m.prioritiesTotal;
    done += m.prioritiesDone;
  }
  if (!s.hidden['nonneg']) {
    total += s.nonnegCount;
    done += Math.min(m.nonnegsDone, s.nonnegCount);
  }
  if (!s.hidden['water']) {
    total += s.waterGoal;
    done += Math.min(m.water, s.waterGoal);
  }

  return total > 0 ? Math.round((done / total) * 100) : 0;
}
