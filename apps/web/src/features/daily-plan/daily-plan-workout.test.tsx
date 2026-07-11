import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { defaultDailyPlanSettings } from '@lifeline/shared';
import { guestApi } from '../../shared/guest/guest-api';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { makeTodo, seedGuestTodos } from '../../test/test-utils';
import { DailyPlanView } from './DailyPlanView';

/**
 * Workout completion sync: finishing every set checks the gym habit for the
 * selected day AND completes the configured real task (settings.gymTaskNumber
 * — never a hardcoded number).
 */

beforeEach(() => {
  window.localStorage.clear();
});

describe('workout completion sync', () => {
  it('completing the last set checks the gym habit and the configured task', async () => {
    const user = userEvent.setup();

    // One-exercise, one-set Push routine everywhere + sync to task #613.
    const settings = defaultDailyPlanSettings();
    settings.gym.routines = {
      push: { name: 'Push', ex: [{ n: 'Bench Press', sets: 1, reps: '8', kg: 60, last: 0 }] },
      rest: { name: 'Rest', ex: [] },
    };
    settings.gym.week = ['push', 'push', 'push', 'push', 'push', 'push', 'push'];
    settings.gymTaskNumber = 613;
    window.localStorage.setItem('daily_plan_settings', JSON.stringify(settings));

    const gymTask = makeTodo({ taskNumber: 613, title: 'Gym — Push day', isCompleted: false });
    seedGuestTodos([gymTask]);

    renderWithProviders(
      <ThemeProvider>
        <DailyPlanView dayToken="2026-07-09" todos={[gymTask]} />
      </ThemeProvider>,
    );

    // findBy: the stored settings (1-set routine) resolve async — defaults
    // render first with the 5-exercise Push routine.
    expect(await screen.findByText('0 / 1 sets done')).toBeInTheDocument();
    expect(screen.getByText('Push Day')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bench Press set 1' }));

    // Immediate UI: confirmation strip + habit checked for Thursday (T).
    expect(await screen.findByText(/Workout complete/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gym Workout Thu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // The real guest task flips to completed.
    await waitFor(
      async () => {
        const todos = await guestApi.fetchTodos();
        expect(todos.find((t) => t.taskNumber === 613)?.isCompleted).toBe(true);
      },
      { timeout: 3000 },
    );

    // Removing the set un-checks the habit again.
    await user.click(screen.getByRole('button', { name: 'Bench Press set 1' }));
    expect(screen.queryByText(/Workout complete/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gym Workout Thu' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
