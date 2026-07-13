import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dailyPlanDataSchema } from '@lifeline/shared';
import { renderWithProviders } from '../../test/harness';
import { StatisticsView } from './StatisticsView';

/**
 * Statistics 2.0 life-metric sections over guest data — the guest adapter
 * maps localStorage days through the same shared extractor as the server.
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

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

describe('Statistics life-metric sections (guest)', () => {
  it('Habits tab shows per-habit completion; Nutrition shows averages vs targets', async () => {
    // Two recent days inside every period window.
    const d1 = new Date();
    d1.setDate(d1.getDate() - 1);
    const d2 = new Date();
    d2.setDate(d2.getDate() - 2);
    seedDay(fmt(d1), {
      habits: { fajr: true, gym: 'skip' },
      meals: { breakfast: [{ n: 'Eggs', cal: 500, p: 40, c: 10, f: 20 }] },
      water: 6,
      moodAm: 4,
    });
    seedDay(fmt(d2), {
      habits: { fajr: false },
      meals: { lunch: [{ n: 'Chicken', cal: 700, p: 60, c: 30, f: 15 }] },
      water: 4,
    });

    const user = userEvent.setup();
    renderWithProviders(<StatisticsView />);

    // Overview tiles show plan data (habit % = 1 done of 2 counted → 50%).
    expect(await screen.findByText('Habits')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Habits' }));
    // Appears twice by design: the completion row + the heatmap picker chip.
    expect((await screen.findAllByText('الفجر')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Nutrition' }));
    // Avg kcal over the two logged days = 600.
    expect(await screen.findByText('600')).toBeInTheDocument();
    expect(screen.getByText(/Days logged/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Journal' }));
    expect(await screen.findByText('Mood (AM vs PM)')).toBeInTheDocument();
  });

  it('sections show a quiet empty state without plan data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StatisticsView />);
    await user.click(await screen.findByRole('tab', { name: 'Workout' }));
    expect(await screen.findByText(/No workouts logged in this period/)).toBeInTheDocument();
  });

  it('Overview shows the weight tile + trend once weigh-ins exist', async () => {
    const d1 = new Date();
    d1.setDate(d1.getDate() - 1);
    const d2 = new Date();
    d2.setDate(d2.getDate() - 3);
    seedDay(fmt(d2), { weight: 83.2 });
    seedDay(fmt(d1), { weight: 82.6 });

    renderWithProviders(<StatisticsView />);

    // Tile: latest weigh-in; delta = last − first, neutral tone by design.
    expect(await screen.findByText('82.6 kg')).toBeInTheDocument();
    expect(screen.getByText('▼ 0.6 kg')).toBeInTheDocument();
    // Trend card with the weigh-in legend.
    expect(screen.getByRole('img', { name: 'Weight trend' })).toBeInTheDocument();
    expect(screen.getByText(/2 weigh-ins/)).toBeInTheDocument();
  });
});
