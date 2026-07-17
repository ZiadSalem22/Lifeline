/**
 * Prayer times for the Daily Plan's five salah habits, from the free Aladhan
 * API (no key). We fetch a whole month at once (calendarByCity) so "today" is
 * a local lookup and the result caches cleanly — a month of times is stable.
 *
 * All parsing here is pure and defensive: the API's time strings can carry a
 * timezone suffix ("05:12 (EEST)") and the odd entry may be malformed, so we
 * extract just HH:MM and skip anything we can't read rather than throw.
 *
 * The five prayer HABITS are identified by fixed ids (fajr/dhuhr/asr/maghrib/
 * isha); PRAYER_HABIT_IDS maps a habit id to its timing so the habit row can
 * show the time. Custom salah habits without a matching id simply get none.
 */

export const PRAYER_HABIT_IDS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYER_HABIT_IDS)[number];

/** habit id → the Aladhan timing key. */
const TIMING_KEY: Record<PrayerKey, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

export type DayPrayers = Record<PrayerKey, string>;
/** 'YYYY-MM-DD' → the five HH:MM times for that day. */
export type PrayerMonth = Record<string, DayPrayers>;

const ALADHAN_BASE = 'https://api.aladhan.com/v1';

/**
 * calendarByCity for one month. method -1 = Auto (omit the param so the API
 * picks the closest authority for the city).
 */
export function buildCalendarUrl(
  city: string,
  country: string,
  method: number,
  year: number,
  month: number,
): string {
  const params = new URLSearchParams({ city: city.trim(), country: country.trim() });
  if (method >= 0) params.set('method', String(method));
  return `${ALADHAN_BASE}/calendarByCity/${year}/${month}?${params.toString()}`;
}

/**
 * calendar for one month by exact coordinates — used when the city picker
 * supplied lat/lon, so there's no name geocoding. method -1 = Auto (omit).
 */
export function buildCalendarUrlByCoords(
  latitude: number,
  longitude: number,
  method: number,
  year: number,
  month: number,
): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  if (method >= 0) params.set('method', String(method));
  return `${ALADHAN_BASE}/calendar/${year}/${month}?${params.toString()}`;
}

/** First HH:MM in a raw timing string ("05:12 (EEST)" → "05:12"); null if none. */
export function timeOnly(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${h < 10 ? '0' : ''}${h}:${match[2]}`;
}

/** Aladhan gregorian "DD-MM-YYYY" → "YYYY-MM-DD"; null if unparseable. */
export function gregorianToIso(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

interface RawEntry {
  timings?: Record<string, unknown>;
  date?: { gregorian?: { date?: unknown } };
}

/**
 * Parse a calendarByCity response into a date-keyed month. Entries missing a
 * date or any of the five prayers are skipped (never throws on bad shapes).
 */
export function parseMonth(json: unknown): PrayerMonth {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return {};
  const out: PrayerMonth = {};
  for (const entry of data as RawEntry[]) {
    const iso = gregorianToIso(entry?.date?.gregorian?.date);
    if (!iso) continue;
    const timings = entry?.timings;
    if (!timings || typeof timings !== 'object') continue;
    const day = {} as DayPrayers;
    let complete = true;
    for (const id of PRAYER_HABIT_IDS) {
      const time = timeOnly(timings[TIMING_KEY[id]]);
      if (time === null) {
        complete = false;
        break;
      }
      day[id] = time;
    }
    if (complete) out[iso] = day;
  }
  return out;
}

/** The five times for one day, or null if that day isn't in the month. */
export function timesForDay(month: PrayerMonth, dateStr: string): DayPrayers | null {
  return month[dateStr] ?? null;
}

/** 'YYYY-MM' key for the month containing dateStr (cache + query granularity). */
export function monthKeyOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}
