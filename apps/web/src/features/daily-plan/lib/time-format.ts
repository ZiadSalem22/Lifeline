import type { DailyPlanSettings } from '@lifeline/shared';

/**
 * Clock display for the Daily Plan. All times are STORED 24-hour (schedule
 * keys `HH:00`, task `dueTime` `HH:mm`, prayer times `HH:MM`); this only
 * changes how they're shown. 24h mode passes the string through unchanged;
 * 12h mode renders AM/PM, dropping `:00` so whole hours read compactly
 * (`5 AM`, `12 PM`) while off-hours keep minutes (`1:30 PM`).
 *
 * Pure and defensive: anything that isn't a valid `H:MM`/`HH:MM` is returned
 * verbatim, so a malformed value can never blank out or crash a row.
 */

export type TimeFormat = DailyPlanSettings['timeFormat'];

const HHMM = /^(\d{1,2}):(\d{2})$/;

export function formatClock(raw: string, format: TimeFormat): string {
  if (format === '24h') return raw;
  const match = HHMM.exec(raw.trim());
  if (!match) return raw;
  const rawHour = Number(match[1]);
  const minute = match[2] as string;
  if (rawHour > 24 || Number(minute) > 59) return raw;
  const hour = rawHour % 24; // schedule can hand us hour 24 (midnight)
  const period = hour < 12 ? 'AM' : 'PM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12; // 0/12/24 → 12
  return minute === '00' ? `${hour12} ${period}` : `${hour12}:${minute} ${period}`;
}
