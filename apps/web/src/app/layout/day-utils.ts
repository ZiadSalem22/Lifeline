import { addDays } from 'date-fns';
import { DAY_NAMES } from '@lifeline/shared';
import type { DayName, Me } from '@lifeline/shared';

/** date-fns weekStartsOn index (0 = Sunday … 6 = Saturday). */
export type WeekStartIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAY_INDEX: Record<DayName, WeekStartIndex> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Week-start preference: profile.startDayOfWeek ?? settings.layout.weekStart
 * ?? 'Monday'. (Fix vs the old ModernCalendar, which hardcoded Sunday and
 * ignored the preference.)
 */
export function resolveWeekStart(me: Me | null): DayName {
  const fromProfile = me?.profile?.startDayOfWeek;
  if (fromProfile) return fromProfile;

  const raw = me?.settings?.layout['weekStart'];
  if (typeof raw === 'string' && raw.length > 0) {
    const normalized = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    const match = DAY_NAMES.find((day) => day === normalized);
    if (match) return match;
  }
  return 'Monday';
}

export function weekStartsOnIndex(day: DayName): WeekStartIndex {
  return DAY_INDEX[day];
}

/** Selected day segment from the current path: '/day/:day' or 'today' for '/'. */
export function selectedDayFromPath(pathname: string): string {
  const match = /^\/day\/([^/]+)/.exec(pathname);
  return match?.[1] ?? 'today';
}

/** Resolve 'today' | 'tomorrow' | 'YYYY-MM-DD' to a local Date (today fallback). */
export function parseSelectedDay(day: string): Date {
  const today = new Date();
  if (day === 'today') return today;
  if (day === 'tomorrow') return addDays(today, 1);
  if (day.includes('-')) {
    const parsed = new Date(`${day}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return today;
}
