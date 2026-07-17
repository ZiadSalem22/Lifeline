/*
 * Generate apps/web/public/cities15000.json from the `all-the-cities` dataset
 * (GeoNames-derived, MIT). We keep cities with population >= 15,000, group them
 * by ISO-3166 country code, sort each country's list by population (biggest
 * first), and emit compact tuples:
 *
 *   { "EG": [["Cairo", 30.0626, 31.2497, "11"], ...], "US": [...] }
 *   tuple = [name, latitude, longitude, adminCode]
 *
 * adminCode (e.g. US state "IL") lets the picker disambiguate same-name cities
 * (Springfield, IL vs Springfield, MA). Coordinates are what the app sends to
 * Aladhan's coordinate endpoint, so location is exact — no name geocoding.
 *
 * Run: `npm run build:cities` (then commit the JSON). CI never regenerates it.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const cities = require('all-the-cities');

const MIN_POPULATION = 15_000;
const round = (n) => Math.round(n * 10_000) / 10_000; // ~11 m precision

const byCountry = {};
let kept = 0;
for (const c of cities) {
  if (c.population < MIN_POPULATION) continue;
  const [lon, lat] = c.loc.coordinates; // GeoJSON order is [lon, lat]
  (byCountry[c.country] ??= []).push([
    c.name,
    round(lat),
    round(lon),
    c.adminCode ?? '',
    c.population,
  ]);
  kept += 1;
}

// Sort each country's cities by population (desc), then drop the population
// field from the emitted tuple (only needed for ordering).
for (const code of Object.keys(byCountry)) {
  byCountry[code].sort((a, b) => b[4] - a[4]);
  byCountry[code] = byCountry[code].map(([name, lat, lon, admin]) => [name, lat, lon, admin]);
}

// Stable, alphabetical country-key order for a clean diff.
const out = {};
for (const code of Object.keys(byCountry).sort()) out[code] = byCountry[code];

const outPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'web',
  'public',
  'cities15000.json',
);
writeFileSync(outPath, JSON.stringify(out));
console.log(`Wrote ${kept} cities across ${Object.keys(out).length} countries → ${outPath}`);
