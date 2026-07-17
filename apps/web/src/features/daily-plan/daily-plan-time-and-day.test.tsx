import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, format } from 'date-fns';
import { defaultDailyPlanSettings, type Todo } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { makeTodo, seedGuestTodos } from '../../test/test-utils';
import { DailyPlanView } from './DailyPlanView';

/**
 * Two Daily Plan preferences: a 24h↔12h clock toggle that reformats every
 * time display (times stay stored 24h), and a clear "you're not on today"
 * indicator with a jump-back action when viewing another day.
 */

beforeEach(() => {
  window.localStorage.clear();
});

function seedTimeFormat(fmt: '24h' | '12h') {
  const settings = defaultDailyPlanSettings();
  settings.timeFormat = fmt;
  window.localStorage.setItem('daily_plan_settings', JSON.stringify(settings));
}

function renderPlan(dayToken: string, todos: Todo[] = [], onSelectDay = vi.fn()) {
  seedGuestTodos(todos);
  const view = renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken={dayToken} todos={todos} onSelectDay={onSelectDay} />
    </ThemeProvider>,
  );
  return { ...view, onSelectDay };
}

describe('time format', () => {
  it('12h reformats schedule hours and off-hour task chips (times stored 24h)', async () => {
    seedTimeFormat('12h');
    const timed = makeTodo({ title: 'Dentist', dueDate: '2026-07-09', dueTime: '13:30' });
    renderPlan('2026-07-09', [timed]);

    // Whole-hour schedule label compacts to "4 AM" (default day start = 04:00).
    expect(await screen.findByText('4 AM')).toBeInTheDocument();
    // The off-hour task chip shows 1:30 PM, not the stored 13:30.
    expect(await screen.findByText('1:30 PM')).toBeInTheDocument();
    expect(screen.queryByText('13:30')).not.toBeInTheDocument();
    expect(screen.queryByText('04:00')).not.toBeInTheDocument();
  });

  it('24h (default) shows the stored strings verbatim', async () => {
    const timed = makeTodo({ title: 'Dentist', dueDate: '2026-07-09', dueTime: '13:30' });
    renderPlan('2026-07-09', [timed]);
    expect(await screen.findByText('04:00')).toBeInTheDocument();
    expect(await screen.findByText('13:30')).toBeInTheDocument();
  });

  it('the Customize toggle switches format and persists', async () => {
    renderPlan('2026-07-09');
    const user = userEvent.setup();
    expect(await screen.findByText('04:00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'CUSTOMIZE' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Time format'), '12h');
    await user.keyboard('{Escape}');

    // Schedule reformats live…
    expect(await screen.findByText('4 AM')).toBeInTheDocument();
    // …and the choice persists to guest settings.
    await waitFor(() => {
      const raw = window.localStorage.getItem('daily_plan_settings');
      expect((JSON.parse(raw as string) as { timeFormat: string }).timeFormat).toBe('12h');
    });
  });
});

describe('not-today indicator', () => {
  const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  it('shows a banner, a real-today chip marker, and a jump-to-today pill', async () => {
    const { onSelectDay } = renderPlan(yesterday);
    const user = userEvent.setup();

    // Banner names the day and offers a jump.
    expect(await screen.findByText(/Yesterday — not today/)).toBeInTheDocument();
    // The week strip marks the REAL today distinctly (aria "(today)").
    expect(screen.getByRole('button', { name: /\(today\)$/ })).toBeInTheDocument();

    // "Go to today" (banner) routes to the actual current date.
    await user.click(screen.getByRole('button', { name: 'Go to today →' }));
    expect(onSelectDay).toHaveBeenCalledWith(todayStr);

    // The bottom pill offers the same jump.
    expect(
      screen.getByRole('button', { name: /Go to today \(viewing Yesterday\)/ }),
    ).toBeInTheDocument();
  });

  it('shows nothing extra when you are on today', async () => {
    renderPlan('today');
    // A stable today-only element proves it rendered, then assert no banner/pill.
    expect(await screen.findByText('DAILY PLAN')).toBeInTheDocument();
    expect(screen.queryByText(/not today/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go to today →' })).not.toBeInTheDocument();
  });
});
