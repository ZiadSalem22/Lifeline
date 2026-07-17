import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  codeForCountryName,
  countryName,
  countryOptions,
  filterCities,
  loadCities,
  type CityData,
} from './cities';

/**
 * City dataset helpers: country-name mapping (via Intl), per-country fuzzy
 * filtering, and the lazy loader (network → localStorage mirror).
 */

const DATA: CityData = {
  EG: [
    ['Cairo', 30.06, 31.25, '11'],
    ['Alexandria', 31.2, 29.92, '06'],
  ],
  US: [
    ['New York City', 40.71, -74.01, 'NY'],
    ['Springfield', 39.8, -89.64, 'IL'],
    ['Springfield', 42.1, -72.59, 'MA'],
  ],
};

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('countryName / countryOptions', () => {
  it('maps ISO codes to English names and sorts options by name', () => {
    expect(countryName('EG')).toBe('Egypt');
    expect(countryName('US')).toBe('United States');
    const opts = countryOptions(DATA);
    expect(opts.map((o) => o.name)).toEqual(['Egypt', 'United States']);
  });
});

describe('codeForCountryName', () => {
  it('reverse-maps a stored country name (or raw code) back to a code', () => {
    expect(codeForCountryName(DATA, 'Egypt')).toBe('EG');
    expect(codeForCountryName(DATA, 'united states')).toBe('US');
    expect(codeForCountryName(DATA, 'EG')).toBe('EG');
    expect(codeForCountryName(DATA, 'Atlantis')).toBeNull();
  });
});

describe('filterCities', () => {
  it('returns the country list (population order) when the query is empty', () => {
    expect(filterCities(DATA, 'EG', '').map((c) => c[0])).toEqual(['Cairo', 'Alexandria']);
  });

  it('fuzzy-filters within the chosen country only', () => {
    expect(filterCities(DATA, 'EG', 'alex').map((c) => c[0])).toEqual(['Alexandria']);
    expect(filterCities(DATA, 'US', 'spring')).toHaveLength(2); // both Springfields
    expect(filterCities(DATA, 'EG', 'zzz')).toEqual([]);
  });
});

describe('loadCities', () => {
  it('fetches the dataset then mirrors it to localStorage', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(DATA)) } as Response),
    );
    vi.stubGlobal('fetch', fetchMock);

    const loaded = await loadCities();
    expect(loaded.EG?.[0]?.[0]).toBe('Cairo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Mirrored under cities:v1 for instant/offline reuse.
    expect(window.localStorage.getItem('cities:v1')).not.toBeNull();
  });
});
