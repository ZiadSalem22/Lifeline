import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CityPicker, type PrayerLocation } from './CityPicker';

/**
 * Country → city picker: selecting a city hands back exact coordinates (so the
 * app queries Aladhan by lat/lon), same-name cities are disambiguated by admin
 * code, and a manual-entry fallback still works with no coordinates.
 */

const DATA = {
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

const EMPTY: PrayerLocation = { city: '', country: '', latitude: null, longitude: null };

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(DATA)) } as Response),
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stateful wrapper so the controlled inputs update; `spy` sees every change. */
function Harness({ spy }: { spy: (v: PrayerLocation) => void }) {
  const [val, setVal] = useState<PrayerLocation>(EMPTY);
  return (
    <CityPicker
      value={val}
      onChange={(v) => {
        spy(v);
        setVal(v);
      }}
    />
  );
}

describe('CityPicker', () => {
  it('country → city selection hands back exact coordinates', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const user = userEvent.setup();

    const country = await screen.findByLabelText('Country');
    // Options load from the dataset.
    await screen.findByRole('option', { name: 'Egypt' });
    await user.selectOptions(country, 'EG');
    expect(spy).toHaveBeenLastCalledWith({
      city: '',
      country: 'Egypt',
      latitude: null,
      longitude: null,
    });

    await user.type(screen.getByLabelText('City'), 'alex');
    await user.click(await screen.findByRole('button', { name: /Alexandria/ }));
    expect(spy).toHaveBeenLastCalledWith({
      city: 'Alexandria',
      country: 'Egypt',
      latitude: 31.2,
      longitude: 29.92,
    });
  });

  it('disambiguates same-name cities by admin code', async () => {
    render(<Harness spy={vi.fn()} />);
    const user = userEvent.setup();

    const country = await screen.findByLabelText('Country');
    await screen.findByRole('option', { name: 'United States' });
    await user.selectOptions(country, 'US');
    await user.type(screen.getByLabelText('City'), 'spring');

    const items = await screen.findAllByRole('button', { name: /Springfield/ });
    expect(items).toHaveLength(2);
    // The state codes appear to tell the two Springfields apart.
    expect(within(items[0] as HTMLElement).getByText(/IL|MA/)).toBeTruthy();
    expect(screen.getByText('IL')).toBeInTheDocument();
    expect(screen.getByText('MA')).toBeInTheDocument();
  });

  it('manual fallback stores the typed city with no coordinates', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const user = userEvent.setup();
    await screen.findByLabelText('Country');

    await user.click(screen.getByRole('button', { name: /Enter manually/ }));
    await user.type(screen.getByLabelText('City'), 'Reykjavik');

    expect(spy).toHaveBeenLastCalledWith(
      expect.objectContaining({ city: 'Reykjavik', latitude: null, longitude: null }),
    );
  });
});
