import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlanHabit } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { DailyPlanView } from './DailyPlanView';

/**
 * On-card habit editing: the pencil flips the tracker into an editor (rename /
 * add / delete / reorder / PRAYER / DIVIDER) — no Customize modal needed.
 * Divider edits freeze the legacy last-prayer fallback into explicit
 * per-habit flags, so unchecking every divider means "no divider".
 */

beforeEach(() => {
  window.localStorage.clear();
});

function renderPlan() {
  return renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken="2026-07-09" todos={[]} />
    </ThemeProvider>,
  );
}

function storedHabits(): PlanHabit[] {
  const raw = window.localStorage.getItem('daily_plan_settings');
  expect(raw).not.toBeNull();
  return (JSON.parse(raw as string) as { habits: PlanHabit[] }).habits;
}

describe('habits on-card editing', () => {
  it('pencil opens the editor; add + rename a habit; DONE returns to the tracker', async () => {
    const user = userEvent.setup();
    renderPlan();

    await user.click(await screen.findByRole('button', { name: 'Edit habits' }));
    await user.click(screen.getByRole('button', { name: '+ Add habit' }));
    const added = screen.getByDisplayValue('New habit');
    await user.clear(added);
    await user.type(added, 'Read Quran');

    await user.click(screen.getByRole('button', { name: 'Done editing habits' }));
    // Back in tracker mode with the new row live.
    expect(await screen.findByText('Read Quran')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read Quran Thu' })).toBeInTheDocument();

    await waitFor(
      () => {
        expect(storedHabits().some((h) => h.label === 'Read Quran')).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it('delete confirms first, then removes; reorder moves rows', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPlan();
    expect(await screen.findByText('Brush Teeth')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit habits' }));
    // Declined confirm = no deletion (misclick protection).
    await user.click(screen.getByRole('button', { name: 'Delete habit Brush Teeth' }));
    expect(screen.getByDisplayValue('Brush Teeth')).toBeInTheDocument();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete habit Brush Teeth' }));
    expect(screen.queryByDisplayValue('Brush Teeth')).not.toBeInTheDocument();

    // Move العشاء (5th) up above المغرب (4th).
    await user.click(screen.getByRole('button', { name: 'Move العشاء up' }));
    await waitFor(
      () => {
        const labels = storedHabits().map((h) => h.label);
        expect(labels).not.toContain('Brush Teeth');
        expect(labels.indexOf('العشاء')).toBeLessThan(labels.indexOf('المغرب'));
      },
      { timeout: 3000 },
    );
  });

  it('divider edits write explicit flags to every habit; unchecking all means none', async () => {
    const user = userEvent.setup();
    renderPlan();
    await user.click(await screen.findByRole('button', { name: 'Edit habits' }));

    // Legacy fallback: the divider sits under the last prayer (العشاء).
    const ishaDivider = screen.getByRole('checkbox', { name: 'Divider below العشاء' });
    expect(ishaDivider).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Divider below الفجر' })).not.toBeChecked();

    // Unchecking it freezes explicit flags on ALL habits — no divider revives.
    await user.click(ishaDivider);
    expect(screen.getByRole('checkbox', { name: 'Divider below العشاء' })).not.toBeChecked();
    await waitFor(
      () => {
        const habits = storedHabits();
        expect(habits.every((h) => h.dividerBelow === false)).toBe(true);
      },
      { timeout: 3000 },
    );

    // Explicit mode: a divider can now live anywhere the user puts it.
    await user.click(screen.getByRole('checkbox', { name: 'Divider below Gym Workout' }));
    await waitFor(
      () => {
        const habits = storedHabits();
        expect(habits.find((h) => h.label === 'Gym Workout')?.dividerBelow).toBe(true);
        expect(habits.filter((h) => h.dividerBelow === true)).toHaveLength(1);
      },
      { timeout: 3000 },
    );
  });
});
