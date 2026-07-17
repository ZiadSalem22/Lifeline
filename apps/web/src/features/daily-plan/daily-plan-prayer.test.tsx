import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { defaultDailyPlanSettings } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { DailyPlanView } from './DailyPlanView';

/**
 * Prayer times on the five salah rows: with a city set, usePrayerTimes fetches
 * a month from Aladhan (mocked here), caches it, and each prayer habit shows an
 * HH:MM badge for the selected day. With no city, a quiet hint replaces them.
 */

/** A one-day calendarByCity payload covering the render date (2026-07-09). */
const CANNED_MONTH = {
  code: 200,
  data: [
    {
      timings: {
        Fajr: '03:12 (EEST)',
        Sunrise: '05:00 (EEST)',
        Dhuhr: '12:59 (EEST)',
        Asr: '16:38 (EEST)',
        Maghrib: '19:47 (EEST)',
        Isha: '21:26 (EEST)',
      },
      date: { gregorian: { date: '09-07-2026' } },
    },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function seedPrayerCity(city: string, country = 'Egypt') {
  const settings = defaultDailyPlanSettings();
  settings.prayer = { enabled: true, city, country, method: -1 };
  window.localStorage.setItem('daily_plan_settings', JSON.stringify(settings));
}

function renderPlan(dayToken = '2026-07-09') {
  return renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken={dayToken} todos={[]} />
    </ThemeProvider>,
  );
}

describe('prayer times on the habit rows', () => {
  it('shows an HH:MM badge on each salah row and caches the month', async () => {
    const fetchMock = vi.fn((_url: string) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(CANNED_MONTH) } as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    seedPrayerCity('Cairo');

    renderPlan();

    // Fajr and Isha badges (the day's real times, tz suffix stripped).
    expect(await screen.findByText('03:12')).toBeInTheDocument();
    expect(await screen.findByText('21:26')).toBeInTheDocument();
    expect(screen.getByText('12:59')).toBeInTheDocument();
    expect(screen.getByText('16:38')).toBeInTheDocument();
    expect(screen.getByText('19:47')).toBeInTheDocument();

    // The Aladhan call went out with the city (Auto omits method).
    const url = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(url).toContain('calendarByCity/2026/7');
    expect(url).toContain('city=Cairo');
    expect(url).not.toContain('method=');

    // The parsed month is mirrored to localStorage for instant/offline reads.
    await waitFor(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('prayer_times:cairo:'));
      expect(key).toBeTruthy();
    });
  });

  it('shows the add-your-city hint when no city is set (no fetch)', async () => {
    const fetchMock = vi.fn((_url: string) =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(CANNED_MONTH) } as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    // Default settings carry an empty prayer city.

    renderPlan();

    expect(
      await screen.findByText('Add your city in Customize to see prayer times.'),
    ).toBeInTheDocument();
    // No city → the query is disabled, so we never hit the network.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
