import { scoreMeal } from './meal-filter';

/**
 * City dataset loader for the prayer-times picker. The data (~24k cities with
 * population ≥ 15,000, grouped by ISO country code) ships as a static file and
 * is fetched lazily the first time the picker opens — never at app boot. It is
 * memoized in-module and mirrored to localStorage so it loads instantly (and
 * offline) on every later open.
 *
 * Each city is a compact tuple `[name, latitude, longitude, adminCode]`; the
 * adminCode (e.g. US state "IL") disambiguates same-name cities. Coordinates
 * are what we send to Aladhan — the whole point is exact location, no geocoding.
 */

export type CityTuple = [name: string, lat: number, lon: number, admin: string];
export type CityData = Record<string, CityTuple[]>;

const CACHE_KEY = 'cities:v1';
const DATA_URL = '/cities15000.json';

let memo: CityData | null = null;
let inFlight: Promise<CityData> | null = null;

/** Load the dataset (memo → localStorage → network). Safe to call repeatedly. */
export async function loadCities(): Promise<CityData> {
  if (memo) return memo;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CityData;
        memo = parsed;
        return parsed;
      }
    } catch {
      // corrupt/oversized cache — fall through to the network
    }
    const res = await fetch(DATA_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`cities dataset responded ${res.status}`);
    const text = await res.text();
    const parsed = JSON.parse(text) as CityData;
    try {
      window.localStorage.setItem(CACHE_KEY, text);
    } catch {
      // storage full — the in-module memo still serves this session
    }
    memo = parsed;
    return parsed;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

const regionNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

/** ISO country code → English name ("EG" → "Egypt"); falls back to the code. */
export function countryName(code: string): string {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The dataset's countries as {code,name}, sorted by name for the dropdown. */
export function countryOptions(data: CityData): { code: string; name: string }[] {
  return Object.keys(data)
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Reverse-lookup a stored country name back to its code (to preselect). */
export function codeForCountryName(data: CityData, name: string): string | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  for (const code of Object.keys(data)) {
    if (code.toLowerCase() === target) return code; // stored as a code already
    if (countryName(code).toLowerCase() === target) return code;
  }
  return null;
}

/**
 * Cities in `code`, filtered by `query`. Empty query → the top cities by
 * population (the list is pre-sorted). Otherwise fuzzy-ranked (Arabic/diacritic
 * aware) and scoped to that one country, so we never score all 24k at once.
 */
export function filterCities(data: CityData, code: string, query: string, limit = 60): CityTuple[] {
  const list = data[code] ?? [];
  const q = query.trim();
  if (!q) return list.slice(0, limit);
  const scored: { tuple: CityTuple; score: number }[] = [];
  for (const tuple of list) {
    const score = scoreMeal(tuple[0], q);
    if (score > 0) scored.push({ tuple, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.tuple);
}
