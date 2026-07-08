/**
 * Natural-language due-date resolution, ported from the old backend
 * `internal/mcp/taskDueDate.js` (fix 3c58273d + patch-semantics fix 9633bd3e):
 *
 * - `today` / `tomorrow` / `yesterday` / `in N days` / `next <weekday>` →
 *   `YYYY-MM-DD`, all UTC-anchored.
 * - Create: missing/empty dueDate defaults to today.
 * - Update: an ABSENT dueDate never touches the stored value; an explicit `''`
 *   clears it to null (true patch semantics).
 */

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-${padDatePart(date.getUTCDate())}`;
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export function resolveNaturalLanguageDueDate<T>(value: T, now = new Date()): T | string {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (isDateOnly(trimmed)) return trimmed;

  const normalized = trimmed.toLowerCase();
  if (normalized === 'today') return formatDateOnly(now);

  if (normalized === 'tomorrow') {
    const nextDay = new Date(now);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return formatDateOnly(nextDay);
  }

  if (normalized === 'yesterday') {
    const previousDay = new Date(now);
    previousDay.setUTCDate(previousDay.getUTCDate() - 1);
    return formatDateOnly(previousDay);
  }

  const inDaysMatch = /^in\s+(\d+)\s+days?$/.exec(normalized);
  if (inDaysMatch) {
    const futureDate = new Date(now);
    futureDate.setUTCDate(futureDate.getUTCDate() + Number.parseInt(inDaysMatch[1] ?? '0', 10));
    return formatDateOnly(futureDate);
  }

  const nextDayMatch = /^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.exec(
    normalized,
  );
  if (nextDayMatch) {
    const targetDayIndex = WEEKDAY_NAMES.indexOf(nextDayMatch[1] as (typeof WEEKDAY_NAMES)[number]);
    const nextDate = new Date(now);
    const currentDayIndex = nextDate.getUTCDay();
    const daysAhead = (targetDayIndex - currentDayIndex + 7) % 7 || 7;
    nextDate.setUTCDate(nextDate.getUTCDate() + daysAhead);
    return formatDateOnly(nextDate);
  }

  return trimmed;
}

/** Create semantics: resolve NL; missing/empty dueDate defaults to today. */
export function resolveCreateDueDate(
  dueDate: string | null | undefined,
  now = new Date(),
): string | null {
  const resolved = resolveNaturalLanguageDueDate(dueDate, now);
  if (resolved === undefined || resolved === '') return formatDateOnly(now);
  return resolved;
}

/**
 * Update semantics for a PRESENT dueDate key: resolve NL; `''` clears to null.
 * Callers must not invoke this when the key is absent (absent ≠ overwrite).
 */
export function resolveUpdateDueDate(
  dueDate: string | null | undefined,
  now = new Date(),
): string | null {
  const resolved = resolveNaturalLanguageDueDate(dueDate, now);
  if (resolved === undefined || resolved === '') return null;
  return resolved;
}
