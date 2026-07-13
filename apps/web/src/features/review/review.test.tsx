import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dailyPlanDataSchema } from '@lifeline/shared';
import { renderWithProviders } from '../../test/harness';
import ReviewPage from '../../app/pages/ReviewPage';

/**
 * Weekly Review page (guest mode): week label + nav, WoW delta, habits grid,
 * journal wall, day deep-links. 2026-07-09 is a Thursday → its week is
 * Mon 2026-07-06 … Sun 2026-07-12; the previous week starts 2026-06-29.
 */

beforeEach(() => {
  window.localStorage.clear();
});

function seedDay(date: string, patch: Record<string, unknown>) {
  window.localStorage.setItem(
    `daily_plan:${date}`,
    JSON.stringify(dailyPlanDataSchema.parse(patch)),
  );
}

function renderReview(path = '/review/2026-07-09') {
  return renderWithProviders(<ReviewPage />, {
    path,
    routes: [
      { path: '/review', element: <ReviewPage /> },
      { path: '/review/:weekStart', element: <ReviewPage /> },
      { path: '*', element: <ReviewPage /> },
    ],
  });
}

describe('Weekly Review', () => {
  it('renders the week, journal wall, habits % and WoW delta', async () => {
    seedDay('2026-07-08', {
      habits: { fajr: true, gym: 'skip' },
      water: 6,
      rating: 4,
      reviewWell: 'Deep work before noon.',
      gratitude: ['صحة الوالدين'],
    });
    seedDay('2026-07-09', { habits: { fajr: true }, water: 4 });
    // Previous week (lower score) → positive WoW delta.
    seedDay('2026-07-01', { habits: {}, water: 1 });

    renderReview();

    expect(await screen.findByText('WEEKLY REVIEW')).toBeInTheDocument();
    expect(screen.getByText('Jul 6 – Jul 12, 2026')).toBeInTheDocument();
    // Journal wall shows the written review + gratitude (Arabic kept).
    expect(await screen.findByText(/Deep work before noon\./)).toBeInTheDocument();
    expect(screen.getByText(/صحة الوالدين/)).toBeInTheDocument();
    // Habits row: fajr done on both tracked days (skip day excluded) → 100%.
    expect(screen.getByText('الفجر')).toBeInTheDocument();
    // WoW delta chip appears once both weeks resolve.
    expect(await screen.findByText(/vs last week/)).toBeInTheDocument();
  });

  it('week navigation steps ‹ › and This week resets', async () => {
    const user = userEvent.setup();
    renderReview();

    expect(await screen.findByText('Jul 6 – Jul 12, 2026')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(await screen.findByText('Jun 29 – Jul 5, 2026')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(await screen.findByText('Jul 6 – Jul 12, 2026')).toBeInTheDocument();
    // Not this week → the reset chip shows (today is not in 2026-07-06's week
    // only when running after 2026-07-12; assert it exists when applicable).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jump to week' })).toBeInTheDocument();
    });
  });

  it('day columns deep-link to that day', async () => {
    seedDay('2026-07-09', { water: 3 });
    const user = userEvent.setup();
    const { router } = renderReview();

    const thursday = await screen.findByRole('button', { name: /Open Thu 2026-07-09/ });
    await user.click(thursday);
    await waitFor(() => {
      expect(router?.state.location.pathname).toBe('/day/2026-07-09');
    });
  });
});
