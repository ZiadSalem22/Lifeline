import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { DailyPlanView } from './DailyPlanView';

/**
 * Daily Plan view (guest mode → localStorage adapter): masthead + cards
 * render, and interactions persist to the per-day plan row after the
 * debounced save.
 */

beforeEach(() => {
  window.localStorage.clear();
});

function renderPlan(dayToken = '2026-07-09') {
  return renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken={dayToken} todos={[]} />
    </ThemeProvider>,
  );
}

describe('DailyPlanView', () => {
  it('renders the masthead, default cards, and non-negotiables', async () => {
    renderPlan();
    expect(screen.getByText('DAILY PLAN')).toBeInTheDocument();
    expect(await screen.findByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Daily Habits Tracker')).toBeInTheDocument();
    expect(screen.getByText('Top 3 Priorities')).toBeInTheDocument();
    expect(screen.getByText('Meals & Nutrition')).toBeInTheDocument();
    expect(screen.getByText('Non-Negotiables')).toBeInTheDocument();
    // The five prayers lead the habit rows.
    expect(screen.getByText('الفجر')).toBeInTheDocument();
    expect(screen.getByText('العشاء')).toBeInTheDocument();
    expect(screen.getByText('No excuses. Just execution.')).toBeInTheDocument();
  });

  it('habit toggle writes the clicked day row and persists to localStorage', async () => {
    const user = userEvent.setup();
    renderPlan('2026-07-09'); // Thursday → selected column T (index 3)

    const fajrThursday = await screen.findByRole('button', { name: 'الفجر Thu' });
    expect(fajrThursday).toHaveAttribute('aria-pressed', 'false');
    await user.click(fajrThursday);
    expect(screen.getByRole('button', { name: 'الفجر Thu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await waitFor(
      () => {
        const raw = window.localStorage.getItem('daily_plan:2026-07-09');
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw as string).habits.fajr).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it('water cups set the count (tap n = n cups, tap last = decrement)', async () => {
    const user = userEvent.setup();
    renderPlan();
    const cup3 = await screen.findByRole('button', { name: 'Cup 3' });
    await user.click(cup3);
    expect(screen.getByRole('button', { name: 'Cup 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('3 / 8 cups')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cup 3' }));
    expect(screen.getByText('2 / 8 cups')).toBeInTheDocument();
  });

  it('masthead week chips navigate to that weekday (buttons only with onSelectDay)', async () => {
    const onSelectDay = vi.fn();
    renderWithProviders(
      <ThemeProvider>
        <DailyPlanView dayToken="2026-07-09" todos={[]} onSelectDay={onSelectDay} />
      </ThemeProvider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Go to Mon 2026-07-06' }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-06');
    // The selected day's own chip is a no-op (no useless navigation).
    await user.click(screen.getByRole('button', { name: 'Go to Thu 2026-07-09' }));
    expect(onSelectDay).toHaveBeenCalledTimes(1);
  });

  it("today's schedule bands the current hour; other days don't", async () => {
    renderPlan('today');
    await screen.findByText('Schedule');
    const hour = new Date().getHours();
    const nowRow = document.querySelector('[data-now]');
    if (hour >= 4 || hour === 0) {
      // Default day runs 04:00 → 00:00 (24 renders as the 00:00 row).
      expect(nowRow).not.toBeNull();
      expect(nowRow?.textContent).toContain(`${hour < 10 ? '0' : ''}${hour}:00`);
    } else {
      // 01:00–03:00 sit outside the default hours — nothing to band.
      expect(nowRow).toBeNull();
    }
  });

  it('a past day never shows the now band', async () => {
    renderPlan('2026-07-09');
    await screen.findByText('Schedule');
    expect(document.querySelector('[data-now]')).toBeNull();
  });

  it('hiding a card moves it to the restore bar; Show all brings it back', async () => {
    const user = userEvent.setup();
    renderPlan();
    await user.click(await screen.findByRole('button', { name: 'Hide Water Tracker' }));
    expect(screen.queryByText('3 / 8 cups')).not.toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Water Tracker' }));
    expect(screen.getByText('Water Tracker')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
