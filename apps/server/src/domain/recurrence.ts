/**
 * Recurrence expansion engine, ported from the old `CreateTodo.execute`
 * pre-generation semantics (audit-domain-logic.md §2) with one deliberate fix:
 * ALL date math is UTC-anchored. Date-only strings are parsed as
 * `<date>T00:00:00Z`; the old code mixed UTC and server-local time.
 *
 * Recurrence remains "pre-generate at creation": each returned date becomes
 * one todo row. Spawn-on-complete was dead code in the old app and is not
 * ported.
 *
 * Supported shapes (stored as-is on every generated row):
 * - Modern: `{ mode: 'daily' | 'dateRange' | 'specificDays', startDate?, endDate?, selectedDays? }`
 *   - daily        → one occurrence per day, `startDate||dueDate` .. `endDate||dueDate` inclusive.
 *   - dateRange    → a single occurrence at `startDate||dueDate` (the span lives in the rule).
 *   - specificDays → days in the daily range whose UTC weekday name is in `selectedDays`.
 * - Legacy: `{ type: 'daily' | 'weekly' | 'monthly' | 'custom', interval?, endDate? }`
 *   - daily/custom → step `interval` days; weekly → `7*interval` days;
 *     monthly → `setUTCMonth(+interval)` (JS month-end rollover semantics apply).
 *   - Steps start at `dueDate` while `<= endDate`; without an endDate → single occurrence.
 * - Unknown/null shape → a single occurrence at the base due date.
 *
 * Safety: expansion is capped at {@link MAX_OCCURRENCES} (366) total dates.
 * Degenerate ranges that would produce zero occurrences fall back to a single
 * occurrence so a create always yields at least one todo (the old code could
 * silently create zero rows — a bug, not parity worth keeping).
 */

/** Hard cap on generated occurrences (one leap year of daily tasks). */
export const MAX_OCCURRENCES = 366;

/**
 * Hard cap on cursor steps while scanning a range, independent of how many
 * dates actually match. Without this a `specificDays` rule whose selectedDays
 * never match (or is empty) would walk EVERY day of an arbitrarily wide range
 * (a Date allocation + setUTCDate each), blocking the event loop for seconds.
 * A leap year is 366 candidate days, so 366 steps always suffice to cover any
 * legitimately useful weekly pattern before the occurrence cap kicks in.
 */
const MAX_RANGE_STEPS = 366;

const UTC_DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** UTC weekday name for a date ('Monday', ...). */
export function utcDayName(date: Date): string {
  return UTC_DAY_NAMES[date.getUTCDay()] as string;
}

const DATE_ONLY_PREFIX = /^\d{4}-\d{2}-\d{2}/;

/**
 * Parse a value as a UTC-anchored date. Date-only strings (and the date part
 * of ISO datetimes) become `T00:00:00Z`. Returns null when unparsable.
 */
export function parseUtcDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const match = DATE_ONLY_PREFIX.exec(trimmed);
  const date = match ? new Date(`${match[0]}T00:00:00Z`) : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function coerceInterval(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  const floored = Math.floor(parsed);
  return floored >= 1 ? floored : 1;
}

type Occurrences = Array<string | null>;

function expandRange(start: Date, end: Date, include: (date: Date) => boolean): string[] {
  const dates: string[] = [];
  let steps = 0;
  for (
    let cursor = start;
    cursor.getTime() <= end.getTime() && dates.length < MAX_OCCURRENCES && steps < MAX_RANGE_STEPS;
    cursor = addUtcDays(cursor, 1), steps += 1
  ) {
    if (include(cursor)) dates.push(formatDateOnly(cursor));
  }
  return dates;
}

function expandLegacy(
  rec: Record<string, unknown>,
  base: Date | null,
  fallback: Occurrences,
): Occurrences {
  const type = rec.type;
  if (type !== 'daily' && type !== 'weekly' && type !== 'monthly' && type !== 'custom') {
    return fallback;
  }
  if (base === null) return fallback;
  const end = parseUtcDate(rec.endDate);
  if (end === null) return [formatDateOnly(base)];

  const interval = coerceInterval(rec.interval);
  const step = (cursor: Date): Date => {
    if (type === 'weekly') return addUtcDays(cursor, 7 * interval);
    if (type === 'monthly') return addUtcMonths(cursor, interval);
    return addUtcDays(cursor, interval); // daily | custom
  };

  const dates: string[] = [];
  for (
    let cursor = base;
    cursor.getTime() <= end.getTime() && dates.length < MAX_OCCURRENCES;
    cursor = step(cursor)
  ) {
    dates.push(formatDateOnly(cursor));
  }
  return dates.length > 0 ? dates : [formatDateOnly(base)];
}

/**
 * Expand a recurrence rule into the list of due dates to create rows for
 * (`YYYY-MM-DD`, UTC). A `null` element means "one row without a due date"
 * (only produced by the unknown/null fallback when no base due date exists).
 */
export function expandRecurrenceDates(
  recurrence: unknown,
  baseDueDate: string | null | undefined,
): Occurrences {
  const base = parseUtcDate(baseDueDate);
  const fallback: Occurrences = [base ? formatDateOnly(base) : null];

  if (recurrence === null || recurrence === undefined || typeof recurrence !== 'object') {
    return fallback;
  }
  const rec = recurrence as Record<string, unknown>;

  if (typeof rec.mode === 'string') {
    const start = parseUtcDate(rec.startDate) ?? base;
    switch (rec.mode) {
      case 'daily': {
        if (start === null) return fallback;
        const end = parseUtcDate(rec.endDate) ?? base ?? start;
        const dates = expandRange(start, end, () => true);
        return dates.length > 0 ? dates : [formatDateOnly(start)];
      }
      case 'dateRange': {
        // A single logical todo spanning the range; the span lives in the rule.
        return start !== null ? [formatDateOnly(start)] : fallback;
      }
      case 'specificDays': {
        if (start === null) return fallback;
        const selected = new Set(
          Array.isArray(rec.selectedDays)
            ? rec.selectedDays.filter((day): day is string => typeof day === 'string')
            : [],
        );
        // No selected weekdays can ever match — bail deterministically to a
        // single occurrence instead of scanning the (possibly enormous) range.
        if (selected.size === 0) return fallback;
        const end = parseUtcDate(rec.endDate) ?? base ?? start;
        const dates = expandRange(start, end, (date) => selected.has(utcDayName(date)));
        return dates.length > 0 ? dates : fallback;
      }
      default:
        return fallback;
    }
  }

  if (typeof rec.type === 'string') {
    return expandLegacy(rec, base, fallback);
  }

  return fallback;
}
