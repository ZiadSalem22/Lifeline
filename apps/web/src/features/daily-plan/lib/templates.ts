import { emptyDailyPlanData } from '@lifeline/shared';
import type {
  CheckItem,
  DailyPlanData,
  DailyPlanSettings,
  DayTemplate,
  QuickItem,
} from '@lifeline/shared';
import { templateKeyOf } from './plan-model';

/**
 * Day continuity — the ritual loop:
 * - a brand-new day (no stored row) wakes up prefilled from the weekday's
 *   template (fallback 'all');
 * - yesterday's unfinished priorities, legacy quick items, AND tomorrow-plan
 *   notes are offered by the carry-over bar, which turns them into REAL
 *   tasks (deduped) and stamps `carryHandled` so the offer never repeats.
 * Materialization is display-only until the first edit persists the blob.
 * `template.quick` / `day.quick` are legacy-only now — quick to-dos became
 * real tasks, so templates neither snapshot nor seed them.
 */

export function templateFor(settings: DailyPlanSettings, dateStr: string): DayTemplate | null {
  return settings.templates[templateKeyOf(dateStr)] ?? settings.templates['all'] ?? null;
}

const nonEmpty = (t: string): boolean => t.trim().length > 0;

/** Build the effective "empty" day from the weekday template skeleton. */
export function materializeNewDay(settings: DailyPlanSettings, dateStr: string): DailyPlanData {
  const day = emptyDailyPlanData();
  const template = templateFor(settings, dateStr);

  if (template) {
    day.schedule = { ...template.schedule };
    const texts = template.priorities.filter(nonEmpty);
    // Grow beyond the default 3 slots when the template carries more.
    const slots = Math.max(day.priorities.length, texts.length);
    day.priorities = Array.from({ length: slots }, (_, i) => ({
      t: texts[i] ?? '',
      done: false,
    }));
  }

  return day;
}

export interface CarryOver {
  priorities: CheckItem[];
  quick: QuickItem[];
  /** Yesterday's unfinished "Tomorrow Plan" notes — otherwise orphaned. */
  tomorrow: CheckItem[];
  count: number;
}

/** All carried texts, in offer order. */
export function carryTitles(carry: CarryOver): string[] {
  return [...carry.priorities, ...carry.quick, ...carry.tomorrow].map((item) => item.t);
}

/**
 * Yesterday's unfinished, non-empty priorities + quick items + tomorrow
 * notes, deduped case-insensitively across the three pools (count is exact).
 */
export function carryOverFrom(yesterday: DailyPlanData | null): CarryOver {
  const seen = new Set<string>();
  const take = <T extends { t: string; done: boolean }>(items: readonly T[] | undefined): T[] =>
    (items ?? []).filter((item) => {
      if (item.done || !nonEmpty(item.t)) return false;
      const key = item.t.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const priorities = take(yesterday?.priorities);
  const quick = take(yesterday?.quick);
  const tomorrow = take(yesterday?.tomorrow);
  return {
    priorities,
    quick,
    tomorrow,
    count: priorities.length + quick.length + tomorrow.length,
  };
}

/** Snapshot the current day as a reusable template (texts only, no state). */
export function templateFromDay(day: DailyPlanData): DayTemplate {
  return {
    schedule: Object.fromEntries(Object.entries(day.schedule).filter(([, text]) => nonEmpty(text))),
    priorities: day.priorities.map((p) => p.t).filter(nonEmpty),
    // Deprecated — quick to-dos are real tasks now (field kept for old blobs).
    quick: [],
  };
}
