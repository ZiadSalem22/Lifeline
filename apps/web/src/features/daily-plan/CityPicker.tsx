import { useEffect, useMemo, useState } from 'react';
import {
  codeForCountryName,
  countryName,
  countryOptions,
  filterCities,
  loadCities,
  type CityData,
  type CityTuple,
} from './lib/cities';
import styles from './CityPicker.module.css';

/**
 * Country → city picker for prayer times. The user picks a country, then filters
 * that country's cities and taps one — which hands back exact coordinates so the
 * app queries Aladhan by lat/lon (no name geocoding). A "manual entry" escape
 * hatch keeps the old free-text path (coords null) so nothing is a dead end.
 */

export interface PrayerLocation {
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
}

interface CityPickerProps {
  value: PrayerLocation;
  onChange: (next: PrayerLocation) => void;
  /** Unique id prefix so labels don't collide if two pickers ever mount. */
  idPrefix?: string;
}

export function CityPicker({ value, onChange, idPrefix = 'city' }: CityPickerProps) {
  const [data, setData] = useState<CityData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // The user's explicit country choice; empty until they pick one. The
  // effective country falls back to the one derived from the stored value.
  const [codeOverride, setCodeOverride] = useState('');
  const [query, setQuery] = useState('');
  // Manual mode: reveal plain city/country text inputs (no coordinates).
  const [manual, setManual] = useState(false);

  // Lazy-load the dataset on first mount. A failure drops to manual entry.
  useEffect(() => {
    let alive = true;
    loadCities()
      .then((loaded) => {
        if (!alive) return;
        setData(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!alive) return;
        setStatus('error');
        setManual(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Preselect the country from the stored value (derived, not stored — so it
  // never fires onChange and an existing city is preserved on open).
  const preselected = useMemo(
    () => (data && value.country ? (codeForCountryName(data, value.country) ?? '') : ''),
    [data, value.country],
  );
  const code = codeOverride || preselected;

  const options = useMemo(() => (data ? countryOptions(data) : []), [data]);
  const results = useMemo(
    () => (data && code ? filterCities(data, code, query) : []),
    [data, code, query],
  );
  // Show the admin/state subtitle only when it's actually disambiguating —
  // i.e. the same city name appears more than once in the visible results.
  const ambiguous = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [name] of results) counts.set(name, (counts.get(name) ?? 0) + 1);
    return counts;
  }, [results]);

  const selectCountry = (nextCode: string) => {
    setCodeOverride(nextCode);
    setQuery('');
    // A user country change resets the city (they'll pick a new one) and stores
    // the country name immediately (drives onboarding's start-of-week too).
    onChange({ city: '', country: countryName(nextCode), latitude: null, longitude: null });
  };

  const selectCity = (tuple: CityTuple) => {
    const [name, lat, lon] = tuple;
    onChange({ city: name, country: countryName(code), latitude: lat, longitude: lon });
    setQuery(name);
  };

  if (manual) {
    return (
      <div className={styles.wrap}>
        {status === 'error' && (
          <p className={styles.note}>Couldn&rsquo;t load the city list — enter it manually.</p>
        )}
        <div className={styles.row}>
          <label className={styles.label} htmlFor={`${idPrefix}-manual-city`}>
            City
          </label>
          <input
            id={`${idPrefix}-manual-city`}
            dir="auto"
            className={styles.control}
            maxLength={120}
            placeholder="e.g. Cairo"
            value={value.city}
            onChange={(e) =>
              onChange({ ...value, city: e.target.value, latitude: null, longitude: null })
            }
          />
        </div>
        <div className={styles.row}>
          <label className={styles.label} htmlFor={`${idPrefix}-manual-country`}>
            Country
          </label>
          <input
            id={`${idPrefix}-manual-country`}
            dir="auto"
            className={styles.control}
            maxLength={120}
            placeholder="e.g. Egypt"
            value={value.country}
            onChange={(e) =>
              onChange({ ...value, country: e.target.value, latitude: null, longitude: null })
            }
          />
        </div>
        {status === 'ready' && (
          <button type="button" className={styles.linkBtn} onClick={() => setManual(false)}>
            ← Search from the list instead
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <label className={styles.label} htmlFor={`${idPrefix}-country`}>
          Country
        </label>
        <select
          id={`${idPrefix}-country`}
          className={styles.control}
          value={code}
          disabled={status !== 'ready'}
          onChange={(e) => selectCountry(e.target.value)}
        >
          <option value="">{status === 'loading' ? 'Loading cities…' : 'Select a country'}</option>
          {options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {code && (
        <div className={styles.row}>
          <label className={styles.label} htmlFor={`${idPrefix}-search`}>
            City
          </label>
          <input
            id={`${idPrefix}-search`}
            dir="auto"
            className={styles.control}
            placeholder="Type to search…"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className={styles.results} aria-label="City results">
            {results.length === 0 ? (
              <li className={styles.empty}>No matching city — try another spelling.</li>
            ) : (
              results.map((tuple) => {
                const [name, , , admin] = tuple;
                return (
                  <li key={`${name}-${admin}-${tuple[1]}`}>
                    <button type="button" className={styles.item} onClick={() => selectCity(tuple)}>
                      <span>{name}</span>
                      {admin && (ambiguous.get(name) ?? 0) > 1 && (
                        <span className={styles.itemSub}>{admin}</span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {value.city && (
        <p className={styles.selected}>
          ✓ {value.city}
          {value.country ? `, ${value.country}` : ''}
          {value.latitude == null && ' (approximate — typed)'}
        </p>
      )}

      <button type="button" className={styles.linkBtn} onClick={() => setManual(true)}>
        Can&rsquo;t find your city? Enter manually
      </button>
    </div>
  );
}
