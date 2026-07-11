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
 *   template (fallback 'all') PLUS whatever you wrote in yesterday's
 *   "Tomorrow Plan";
 * - unfinished priorities/quick items from yesterday can be carried over
 *   with one tap.
 * Materialization is display-only until the first edit persists the blob.
 */

export function templateFor(settings: DailyPlanSettings, dateStr: string): DayTemplate | null {
  return settings.templates[templateKeyOf(dateStr)] ?? settings.templates['all'] ?? null;
}

const nonEmpty = (t: string): boolean => t.trim().length > 0;

/** Build the effective "empty" day: template skeleton + yesterday's tomorrow plan. */
export function materializeNewDay(
  settings: DailyPlanSettings,
  dateStr: string,
  yesterday: DailyPlanData | null,
): DailyPlanData {
  const day = emptyDailyPlanData();
  const template = templateFor(settings, dateStr);

  if (template) {
    day.schedule = { ...template.schedule };
    const texts = template.priorities.filter(nonEmpty);
    day.priorities = day.priorities.map((slot, i) => ({
      t: texts[i] ?? slot.t,
      done: false,
    }));
    day.quick = template.quick.filter(nonEmpty).map((t) => ({ t, done: false }));
  }

  const planned = (yesterday?.tomorrow ?? []).filter((item) => nonEmpty(item.t));
  if (planned.length > 0) {
    const existing = new Set(day.quick.map((q) => q.t.trim().toLowerCase()));
    for (const item of planned) {
      if (!existing.has(item.t.trim().toLowerCase())) {
        day.quick.push({ t: item.t, done: false });
      }
    }
  }

  return day;
}

export interface CarryOver {
  priorities: CheckItem[];
  quick: QuickItem[];
  count: number;
}

/** Yesterday's unfinished, non-empty priorities + quick items. */
export function carryOverFrom(yesterday: DailyPlanData | null): CarryOver {
  const priorities = (yesterday?.priorities ?? []).filter((p) => !p.done && nonEmpty(p.t));
  const quick = (yesterday?.quick ?? []).filter((q) => !q.done && nonEmpty(q.t));
  return { priorities, quick, count: priorities.length + quick.length };
}

/** Apply a carry-over: unfinished priorities fill empty slots (overflow → quick). */
export function applyCarryOver(day: DailyPlanData, carry: CarryOver): Partial<DailyPlanData> {
  const priorities = day.priorities.map((slot) => ({ ...slot }));
  const overflow: string[] = [];
  const already = new Set(
    [...priorities.map((p) => p.t), ...day.quick.map((q) => q.t)]
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0),
  );

  for (const item of carry.priorities) {
    const key = item.t.trim().toLowerCase();
    if (already.has(key)) continue;
    const empty = priorities.findIndex((p) => !nonEmpty(p.t));
    if (empty !== -1) priorities[empty] = { t: item.t, done: false };
    else overflow.push(item.t);
    already.add(key);
  }

  const quick = [...day.quick.map((q) => ({ ...q }))];
  for (const t of [...overflow, ...carry.quick.map((q) => q.t)]) {
    const key = t.trim().toLowerCase();
    if (already.has(key)) continue;
    quick.push({ t, done: false });
    already.add(key);
  }

  return { priorities, quick };
}

/** Snapshot the current day as a reusable template (texts only, no state). */
export function templateFromDay(day: DailyPlanData): DayTemplate {
  return {
    schedule: Object.fromEntries(Object.entries(day.schedule).filter(([, text]) => nonEmpty(text))),
    priorities: day.priorities.map((p) => p.t).filter(nonEmpty),
    quick: day.quick
      .map((q) => q.t)
      .filter(nonEmpty)
      .slice(0, 16),
  };
}
