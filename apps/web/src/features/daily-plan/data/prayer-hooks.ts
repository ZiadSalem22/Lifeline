import { useQuery } from '@tanstack/react-query';
import {
  buildCalendarUrl,
  buildCalendarUrlByCoords,
  monthKeyOf,
  parseMonth,
  timesForDay,
  type DayPrayers,
  type PrayerMonth,
} from '../lib/prayer-times';

/**
 * usePrayerTimes — the five salah times for a given day, by city.
 *
 * We fetch a whole month from Aladhan at once (a month of times is stable),
 * key the query by month so "today" is a local lookup, and mirror the parsed
 * month to localStorage so badges render instantly and survive going offline.
 *
 * The network call is isolated in `fetchPrayerMonth` on purpose: it is the one
 * seam that talks to a third party. If the browser-direct call is ever blocked
 * (CORS / CSP), only this function swaps to a same-origin server proxy — the
 * hook, cache, and callers stay unchanged.
 */

const CACHE_PREFIX = 'prayer_times';

/** localStorage key for one location+method+month of parsed times. `locToken`
 * is the coordinate token (`@lat,lon`) when picked, else `city:country`. */
function cacheKey(locToken: string, method: number, monthKey: string): string {
  return `${CACHE_PREFIX}:${locToken}:${method}:${monthKey}`;
}

function readCache(key: string): PrayerMonth | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    // Shallow shape guard — a corrupt/foreign blob just misses the cache.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as PrayerMonth;
  } catch {
    return null;
  }
}

function writeCache(key: string, month: PrayerMonth): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(month));
  } catch {
    // Quota/serialization failures are non-fatal — the month stays in the
    // in-memory query cache for this session.
  }
}

/**
 * Fetch + parse one month of prayer times from Aladhan (browser-direct). The
 * ONLY function that reaches the network — swap its body for a same-origin
 * proxy fetch if the direct call is ever blocked.
 */
export async function fetchPrayerMonth(
  city: string,
  country: string,
  method: number,
  year: number,
  month: number,
): Promise<PrayerMonth> {
  return fetchAndParse(buildCalendarUrl(city, country, method, year, month));
}

/** Coordinate variant — exact lat/lon, no name geocoding. */
export async function fetchPrayerMonthByCoords(
  latitude: number,
  longitude: number,
  method: number,
  year: number,
  month: number,
): Promise<PrayerMonth> {
  return fetchAndParse(buildCalendarUrlByCoords(latitude, longitude, method, year, month));
}

async function fetchAndParse(url: string): Promise<PrayerMonth> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Aladhan responded ${response.status}`);
  const json: unknown = await response.json();
  return parseMonth(json);
}

export interface PrayerTimesResult {
  /** The five HH:MM times for `dateStr`, or null (no city, still loading, or that day absent). */
  times: DayPrayers | null;
  /** Whether the feature is active (a city is set) — drives the empty-city hint. */
  active: boolean;
  isLoading: boolean;
  isError: boolean;
}

/**
 * The five prayer times for `dateStr` (`YYYY-MM-DD`) at a location. When
 * `latitude`/`longitude` are present (city picked from the list) we query
 * Aladhan by exact coordinates — no name geocoding; otherwise we fall back to
 * the city/country name. `method` -1 is Auto. Returns `{ times: null }` until a
 * location is set or the month resolves.
 */
export function usePrayerTimes(
  city: string,
  country: string,
  method: number,
  dateStr: string,
  latitude?: number | null,
  longitude?: number | null,
): PrayerTimesResult {
  const trimmedCity = city.trim();
  const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
  const active = hasCoords || trimmedCity.length > 0;
  const monthKey = monthKeyOf(dateStr);
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  // Coordinates give a stable, exact location token; the name path keys on
  // city+country. Either way the month + method complete the cache identity.
  const locToken = hasCoords
    ? `@${latitude},${longitude}`
    : `${trimmedCity.toLowerCase()}:${country.trim().toLowerCase()}`;
  const key = cacheKey(locToken, method, monthKey);

  const query = useQuery({
    queryKey: ['prayer-times', locToken, method, monthKey],
    enabled: active && Number.isFinite(year) && Number.isFinite(month),
    // A month of prayer times doesn't change — refetch rarely, keep long.
    // gcTime stays under the 32-bit setTimeout ceiling (~24.8 days); the
    // localStorage mirror below is the real cross-session/offline cache.
    staleTime: 12 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    // Cross-third-party call: one retry is plenty; the cache covers offline.
    retry: 1,
    // Show cached badges immediately (and offline) before the network resolves.
    initialData: () => readCache(key) ?? undefined,
    queryFn: async () => {
      try {
        const fetched =
          hasCoords && latitude != null && longitude != null
            ? await fetchPrayerMonthByCoords(latitude, longitude, method, year, month)
            : await fetchPrayerMonth(trimmedCity, country, method, year, month);
        writeCache(key, fetched);
        return fetched;
      } catch (err) {
        // Offline / API down: fall back to any cached month rather than blank.
        const cached = readCache(key);
        if (cached) return cached;
        throw err;
      }
    },
  });

  return {
    times: query.data ? timesForDay(query.data, dateStr) : null,
    active,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
