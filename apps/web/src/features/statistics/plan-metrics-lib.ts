import { planScoreFromMetrics } from '@lifeline/shared';
import type { DailyPlanSettings, DayMetrics, HabitMark } from '@lifeline/shared';
import { habitStreak } from '../daily-plan/lib/streaks';
import { daysAfter, daysBefore } from '../daily-plan/lib/plan-model';
import type { StatsRange } from './stats-lib';

/**
 * Pure aggregations over DayMetrics for the Statistics sections. Everything
 * settings-dependent (habit labels, goals, targets, hidden cards) resolves
 * against the CURRENT settings — orphaned habit ids are filtered exactly
 * like the plan's score ring does.
 */

export interface HabitAggRow {
  id: string;
  label: string;
  done: number;
  counted: number;
  pct: number | null;
  currentStreak: number;
  longestRun: number;
}

export interface RoutineAggRow {
  key: string;
  label: string;
  sessions: number;
  sets: number;
}

export interface PlanAggregates {
  /** Every date of the range, ascending (chart X axes). */
  dates: string[];
  daysWithData: number;
  byDate: Map<string, DayMetrics>;
  /** Plan score per date; null = no entry that day. */
  scoreByDate: (number | null)[];
  scoreAvg: number | null;
  habitPct: number | null;
  habitRows: HabitAggRow[];
  waterAvg: number | null;
  nutrition: {
    loggedDays: number;
    avg: { kcal: number; protein: number; carbs: number; fat: number } | null;
    bestDay: { date: string; kcal: number } | null;
    worstDay: { date: string; kcal: number } | null;
  };
  workout: { sessions: number; totalSets: number; byRoutine: RoutineAggRow[] };
  cardio: { minutes: number; km: number; kcal: number; sessions: number };
  weight: {
    /** kg per date of the range; null = not weighed that day. */
    series: (number | null)[];
    count: number;
    first: { date: string; kg: number } | null;
    last: { date: string; kg: number } | null;
    min: number | null;
    max: number | null;
  };
  journalDays: number;
  gratitudeTotal: number;
  moodAm: (number | null)[];
  moodPm: (number | null)[];
  rating: (number | null)[];
}

export function enumerateRange(range: StatsRange): string[] {
  const dates: string[] = [];
  let date = range.startDate;
  // Hard ceiling mirrors the metrics cap; protects against reversed input.
  for (let i = 0; i < 400 && date <= range.endDate; i += 1) {
    dates.push(date);
    date = daysAfter(date, 1);
  }
  return dates;
}

/** The equal-length range immediately before (period-over-period deltas). */
export function previousRange(range: StatsRange): StatsRange {
  const length = enumerateRange(range).length;
  return {
    startDate: daysBefore(range.startDate, length),
    endDate: daysBefore(range.startDate, 1),
  };
}

const round1 = (v: number): number => Math.round(v * 10) / 10;

export function aggregatePlanMetrics(
  metrics: DayMetrics[],
  settings: DailyPlanSettings,
  range: StatsRange,
  todayStr: string,
  /**
   * Per-date real-task counts, joined from the todos store. Without it the
   * score would count only quick items and disagree with the plan ring and
   * the Weekly Review, which both include real tasks.
   */
  taskCountFor?: (date: string) => { done: number; total: number },
): PlanAggregates {
  const dates = enumerateRange(range);
  const byDate = new Map(metrics.map((m) => [m.date, m]));
  const scoreSettings = {
    habitIds: settings.habits.map((h) => h.id),
    waterGoal: settings.targets.water,
    nonnegCount: settings.nonnegLabels.length,
    hidden: settings.hidden,
  };

  const scoreByDate = dates.map((date) => {
    const m = byDate.get(date);
    return m ? planScoreFromMetrics(m, scoreSettings, taskCountFor?.(date)) : null;
  });
  const scored = scoreByDate.filter((s): s is number => s !== null);

  // Habits — done/counted over the range + streaks (current streak anchors
  // at today when the range includes it, else at the range end).
  const streakAnchor =
    todayStr >= range.startDate && todayStr <= range.endDate ? todayStr : range.endDate;
  const markFor =
    (habitId: string) =>
    (date: string): HabitMark | undefined =>
      byDate.get(date)?.habits[habitId];
  let habitDone = 0;
  let habitCounted = 0;
  const habitRows: HabitAggRow[] = settings.habits.map((habit) => {
    let done = 0;
    let counted = 0;
    let run = 0;
    let longestRun = 0;
    for (const date of dates) {
      const mark = byDate.get(date)?.habits[habit.id];
      if (mark === 'skip') continue;
      if (mark !== undefined) counted += 1;
      if (mark === true) {
        done += 1;
        run += 1;
        longestRun = Math.max(longestRun, run);
      } else if (mark === false) {
        run = 0;
      }
      // undefined (no entry) neither counts nor breaks a run inside the
      // period readout — matches skip semantics for sparse historical data.
    }
    habitDone += done;
    habitCounted += counted;
    return {
      id: habit.id,
      label: habit.label,
      done,
      counted,
      pct: counted > 0 ? Math.round((done / counted) * 100) : null,
      currentStreak: habitStreak(markFor(habit.id), streakAnchor),
      longestRun,
    };
  });

  // Water (avg over days with data).
  const daysWith = metrics.filter((m) => dates[0] !== undefined && m.date >= dates[0]);
  const waterDays = metrics.length;
  const waterSum = metrics.reduce((sum, m) => sum + m.water, 0);

  // Nutrition over LOGGED days only.
  const logged = metrics.filter((m) => m.mealCount > 0);
  const target = settings.targets.kcal;
  let bestDay: { date: string; kcal: number } | null = null;
  let worstDay: { date: string; kcal: number } | null = null;
  for (const m of logged) {
    if (bestDay === null || Math.abs(m.kcal - target) < Math.abs(bestDay.kcal - target)) {
      bestDay = { date: m.date, kcal: m.kcal };
    }
    if (worstDay === null || Math.abs(m.kcal - target) > Math.abs(worstDay.kcal - target)) {
      worstDay = { date: m.date, kcal: m.kcal };
    }
  }

  // Weight — weigh-ins are sparse by nature; first/last logged bound the
  // period trend, min/max frame the chart's zoomed baseline.
  const weightSeries = dates.map((d) => byDate.get(d)?.weight ?? null);
  const weighIns = dates.flatMap((date) => {
    const kg = byDate.get(date)?.weight;
    return kg != null ? [{ date, kg }] : [];
  });
  const weightValues = weighIns.map((w) => w.kg);

  // Workout.
  const sessions = metrics.filter((m) => m.workoutSets > 0);
  const byRoutine = new Map<string, { sessions: number; sets: number }>();
  for (const m of sessions) {
    for (const [key, sets] of Object.entries(m.workoutByRoutine)) {
      const row = byRoutine.get(key) ?? { sessions: 0, sets: 0 };
      row.sessions += 1;
      row.sets += sets;
      byRoutine.set(key, row);
    }
  }

  return {
    dates,
    daysWithData: daysWith.length,
    byDate,
    scoreByDate,
    scoreAvg:
      scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
    habitPct: habitCounted > 0 ? Math.round((habitDone / habitCounted) * 100) : null,
    habitRows,
    waterAvg: waterDays > 0 ? round1(waterSum / waterDays) : null,
    nutrition: {
      loggedDays: logged.length,
      avg:
        logged.length > 0
          ? {
              kcal: Math.round(logged.reduce((a, m) => a + m.kcal, 0) / logged.length),
              protein: Math.round(logged.reduce((a, m) => a + m.protein, 0) / logged.length),
              carbs: Math.round(logged.reduce((a, m) => a + m.carbs, 0) / logged.length),
              fat: Math.round(logged.reduce((a, m) => a + m.fat, 0) / logged.length),
            }
          : null,
      bestDay,
      worstDay,
    },
    workout: {
      sessions: sessions.length,
      totalSets: metrics.reduce((a, m) => a + m.workoutSets, 0),
      byRoutine: [...byRoutine.entries()]
        .map(([key, row]) => ({
          key,
          label: settings.gym.routines[key]?.name ?? key,
          ...row,
        }))
        .sort((a, b) => b.sessions - a.sessions),
    },
    cardio: {
      minutes: metrics.reduce((a, m) => a + m.cardioMinutes, 0),
      km: round1(metrics.reduce((a, m) => a + m.cardioKm, 0)),
      kcal: metrics.reduce((a, m) => a + m.cardioKcal, 0),
      sessions: metrics.filter((m) => m.cardioMinutes > 0).length,
    },
    weight: {
      series: weightSeries,
      count: weighIns.length,
      first: weighIns[0] ?? null,
      last: weighIns[weighIns.length - 1] ?? null,
      min: weightValues.length > 0 ? Math.min(...weightValues) : null,
      max: weightValues.length > 0 ? Math.max(...weightValues) : null,
    },
    journalDays: metrics.filter((m) => m.journal).length,
    gratitudeTotal: metrics.reduce((a, m) => a + m.gratitudeCount, 0),
    moodAm: dates.map((d) => byDate.get(d)?.moodAm ?? null),
    moodPm: dates.map((d) => byDate.get(d)?.moodPm ?? null),
    rating: dates.map((d) => byDate.get(d)?.rating ?? null),
  };
}

/** "+4" / "−3" / undefined vs a previous-period value (null-safe). */
export function formatDelta(
  current: number | null,
  previous: number | null,
  suffix = '',
): { text: string; tone: 'good' | 'bad' | 'neutral' } | undefined {
  if (current === null || previous === null) return undefined;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { text: `±0${suffix}`, tone: 'neutral' };
  return {
    text: `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}${suffix}`,
    tone: diff > 0 ? 'good' : 'bad',
  };
}
