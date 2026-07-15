import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { DailyPlanView } from './DailyPlanView';

/**
 * Jump navigation (guest mode): the floating pill opens the section sheet,
 * tiles jump to their card and close the sheet, statuses read live day data,
 * and reordering from the sheet persists through plan settings.
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

function openSheet(user: ReturnType<typeof userEvent.setup>) {
  return user
    .click(screen.getByRole('button', { name: 'Navigate sections' }))
    .then(() => screen.getByRole('dialog', { name: 'Jump to section' }));
}

describe('Daily Plan jump navigation', () => {
  it('pill opens the sheet listing every visible section with live statuses', async () => {
    const user = userEvent.setup();
    renderPlan();
    await screen.findByText('Schedule');

    // Closed by default — the dialog is out of the accessibility tree.
    expect(screen.queryByRole('dialog', { name: 'Jump to section' })).not.toBeInTheDocument();

    const sheet = await openSheet(user);
    const tiles = within(sheet).getAllByRole('button');
    const labels = tiles.map((tile) => tile.textContent);
    for (const expected of ['Schedule', 'Workout', 'Water Tracker', 'Meals & Nutrition']) {
      expect(labels.some((text) => text?.includes(expected))).toBe(true);
    }
    // Live status: default water target is 8, nothing logged yet.
    const water = within(sheet).getByRole('button', { name: /Water Tracker/ });
    expect(water.textContent).toContain('0 / 8');
  });

  it('tapping a tile scrolls to the card and closes the sheet', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const user = userEvent.setup();
    renderPlan();
    await screen.findByText('Schedule');

    const sheet = await openSheet(user);
    await user.click(within(sheet).getByRole('button', { name: /Water Tracker/ }));

    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: 'start' }));
    expect(screen.queryByRole('dialog', { name: 'Jump to section' })).not.toBeInTheDocument();
  });

  it('hidden cards stay out of the sheet', async () => {
    const user = userEvent.setup();
    renderPlan();
    await user.click(await screen.findByRole('button', { name: 'Hide Water Tracker' }));

    const sheet = await openSheet(user);
    expect(within(sheet).queryByRole('button', { name: /Water Tracker/ })).not.toBeInTheDocument();
  });

  it('arrow keys on a tile reorder the plan and persist through secOrder', async () => {
    const user = userEvent.setup();
    renderPlan();
    await screen.findByText('Schedule');

    const sheet = await openSheet(user);
    const schedule = within(sheet).getByRole('button', { name: /^Schedule/ });
    schedule.focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(
      () => {
        const raw = window.localStorage.getItem('daily_plan_settings');
        expect(raw).not.toBeNull();
        const order = JSON.parse(raw as string).secOrder as string[];
        expect(order.indexOf('focus')).toBe(0);
        expect(order.indexOf('schedule')).toBe(1);
      },
      { timeout: 3000 },
    );
  });

  it('reordering from the sheet keeps hidden cards parked in their slot', async () => {
    const user = userEvent.setup();
    renderPlan();
    // Hide the second card (Focus Zone), then move Schedule one slot later —
    // it must hop over the hidden card's parked slot.
    await user.click(await screen.findByRole('button', { name: 'Hide Focus Zone' }));

    const sheet = await openSheet(user);
    const schedule = within(sheet).getByRole('button', { name: /^Schedule/ });
    schedule.focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(
      () => {
        const raw = window.localStorage.getItem('daily_plan_settings');
        expect(raw).not.toBeNull();
        const order = JSON.parse(raw as string).secOrder as string[];
        // focus keeps its hidden slot; gratitude and schedule swapped.
        expect(order.slice(0, 3)).toEqual(['gratitude', 'focus', 'schedule']);
      },
      { timeout: 3000 },
    );
  });
});
