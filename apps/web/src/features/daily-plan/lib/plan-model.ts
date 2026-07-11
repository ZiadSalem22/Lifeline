import { addDays, format } from 'date-fns';
import type { PlanHabit } from '@lifeline/shared';

/**
 * Static registry + date helpers for the Daily Plan view. The section keys
 * are persisted (secOrder/secWide/hidden in plan settings), so they must stay
 * stable. GRID_KEYS live in the masonry grid; meals/nonneg render full-width
 * below it.
 */

export const PLAN_SECTIONS = [
  ['schedule', 'Schedule'],
  ['focus', 'Focus Zone'],
  ['gratitude', 'Gratitude'],
  ['mood', 'Mood & Energy'],
  ['priorities', 'Top 3 Priorities'],
  ['habits', 'Daily Habits Tracker'],
  ['workout', 'Workout'],
  ['review', 'Evening Review'],
  ['todo', 'To-Do List'],
  ['meals', 'Meals & Nutrition'],
  ['water', 'Water Tracker'],
  ['tomorrow', 'Tomorrow Plan'],
  ['nonneg', 'Non-Negotiables'],
] as const;
export type PlanSectionKey = (typeof PLAN_SECTIONS)[number][0];

export const PLAN_GRID_KEYS: PlanSectionKey[] = [
  'schedule',
  'focus',
  'gratitude',
  'mood',
  'priorities',
  'habits',
  'workout',
  'review',
  'todo',
  'water',
  'tomorrow',
];

export function sectionLabel(key: PlanSectionKey): string {
  return PLAN_SECTIONS.find(([k]) => k === key)?.[1] ?? key;
}

/**
 * Hourly schedule rows, personalized: start hour 0–23 → end hour 1–24
 * (24 renders as 00:00). Defaults match the design (04:00 → 00:00).
 */
export function scheduleHours(startHour = 4, endHour = 24): string[] {
  const start = Math.max(0, Math.min(23, startHour));
  const end = Math.max(start + 1, Math.min(24, endHour));
  const hours: string[] = [];
  const seen = new Set<string>();
  for (let h = start; h <= end; h += 1) {
    const hh = h % 24;
    const time = `${hh < 10 ? '0' : ''}${hh}:00`;
    // start=0 + end=24 both land on '00:00' — one row, not two.
    if (seen.has(time)) continue;
    seen.add(time);
    hours.push(time);
  }
  return hours;
}

export const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
export const WEEK_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/** Monday of the ISO week containing dateStr (local time). */
export function weekStartOf(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  const mondayOffset = (date.getDay() + 6) % 7; // 0=Sun → 6, 1=Mon → 0 …
  return format(addDays(date, -mondayOffset), 'yyyy-MM-dd');
}

/** The 7 Monday-first date strings of the week containing dateStr. */
export function weekDatesOf(dateStr: string): string[] {
  const start = parseDateOnly(weekStartOf(dateStr));
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
}

/** Monday-first index (0–6) of dateStr within its week. */
export function weekIndexOf(dateStr: string): number {
  return (parseDateOnly(dateStr).getDay() + 6) % 7;
}

/** The date string n days before dateStr. */
export function daysBefore(dateStr: string, n: number): string {
  return format(addDays(parseDateOnly(dateStr), -n), 'yyyy-MM-dd');
}

/** The date string n days after dateStr. */
export function daysAfter(dateStr: string, n: number): string {
  return daysBefore(dateStr, -n);
}

let habitSeq = 0;

/** Unique habit id — module counter checked against taken ids (both editors). */
export function newHabitId(existing: PlanHabit[]): string {
  const taken = new Set(existing.map((h) => h.id));
  for (;;) {
    habitSeq += 1;
    const id = `h${habitSeq}`;
    if (!taken.has(id)) return id;
  }
}

/**
 * Divider render rule. dividerBelow is tri-state on purpose: once ANY habit
 * carries the key the user owns dividers (explicit only); while NONE do, the
 * legacy fallback draws one under the last prayer row.
 */
export function dividerBelowAt(habits: PlanHabit[], index: number): boolean {
  if (habits.some((h) => h.dividerBelow !== undefined)) {
    return habits[index]?.dividerBelow === true;
  }
  return index === habits.map((h) => h.salah).lastIndexOf(true);
}

/**
 * Divider edit — freezes the current effective dividers as explicit
 * true/false on EVERY habit, then applies the change. Unchecking the last
 * divider therefore means "no divider", not a resurrected prayer fallback.
 */
export function withDividerAt(habits: PlanHabit[], index: number, on: boolean): PlanHabit[] {
  return habits.map((h, i) => ({
    ...h,
    dividerBelow: i === index ? on : dividerBelowAt(habits, i),
  }));
}

const TEMPLATE_WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** Template key ('mon'…'sun') for a date. */
export function templateKeyOf(dateStr: string): (typeof TEMPLATE_WEEKDAYS)[number] {
  return TEMPLATE_WEEKDAYS[weekIndexOf(dateStr)] ?? 'mon';
}
