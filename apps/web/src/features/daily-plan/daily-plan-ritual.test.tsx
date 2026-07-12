import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { dailyPlanDataSchema } from '@lifeline/shared';
import type { Todo } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { makeTodo, seedGuestTodos } from '../../test/test-utils';
import { DailyPlanView } from './DailyPlanView';

/**
 * Ritual pack: tri-state habit cells (done → skipped → empty), streak chips,
 * the 28-day history strip, the Week Review card, and subtask checklists on
 * plan task rows.
 */

beforeEach(() => {
  window.localStorage.clear();
});

function renderPlan(todos: Todo[] = [], onSelectDay?: (date: string) => void) {
  return renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken="2026-07-09" todos={todos} onSelectDay={onSelectDay} />
    </ThemeProvider>,
  );
}

describe('habit skip days', () => {
  it('cell cycles empty → done → skipped → empty and persists the skip', async () => {
    const user = userEvent.setup();
    renderPlan();

    const cell = await screen.findByRole('button', { name: 'الفجر Thu' });
    await user.click(cell);
    expect(screen.getByRole('button', { name: 'الفجر Thu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'الفجر Thu' }));
    const skipped = screen.getByRole('button', { name: 'الفجر Thu (skipped)' });
    expect(skipped).toHaveAttribute('aria-pressed', 'mixed');
    await waitFor(
      () => {
        const raw = window.localStorage.getItem('daily_plan:2026-07-09');
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw as string).habits.fajr).toBe('skip');
      },
      { timeout: 3000 },
    );

    await user.click(screen.getByRole('button', { name: 'الفجر Thu (skipped)' }));
    expect(screen.getByRole('button', { name: 'الفجر Thu' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('streaks + history', () => {
  it('shows a streak chip from consecutive done days and a 28-day strip on label click', async () => {
    // Two done days before the selected Thursday → ×2 (today not done is neutral).
    for (const date of ['2026-07-07', '2026-07-08']) {
      window.localStorage.setItem(
        `daily_plan:${date}`,
        JSON.stringify(dailyPlanDataSchema.parse({ habits: { fajr: true } })),
      );
    }
    const user = userEvent.setup();
    renderPlan();

    expect(await screen.findByTitle('2-day streak')).toHaveTextContent('×2');

    await user.click(screen.getByRole('button', { name: 'الفجر — show last 28 days' }));
    const strip = await screen.findByRole('img', { name: 'الفجر last 28 days' });
    expect(strip.children).toHaveLength(28);
  });
});

describe('week review card', () => {
  it('renders seven day bars and the aggregates row', async () => {
    window.localStorage.setItem(
      'daily_plan:2026-07-08',
      JSON.stringify(dailyPlanDataSchema.parse({ habits: { fajr: true }, water: 4 })),
    );
    const onSelectDay = vi.fn();
    const user = userEvent.setup();
    renderPlan([], onSelectDay);

    expect(await screen.findByText('Week Review')).toBeInTheDocument();
    // findBy: the stored Wednesday row resolves async before its % shows.
    const wedBar = await screen.findByRole('button', { name: /Wed 2026-07-08 — \d+%/ });
    await user.click(wedBar);
    expect(onSelectDay).toHaveBeenCalledWith('2026-07-08');
    // A day with nothing stored is an empty bar, not a zero.
    expect(screen.getByRole('button', { name: /Sat 2026-07-11 — no entry/ })).toBeInTheDocument();
    expect(screen.getByText('Habits')).toBeInTheDocument();
    expect(screen.getByText('Water')).toBeInTheDocument();
  });
});

describe('subtasks on plan rows', () => {
  it('expands a task row and toggles a subtask from the plan', async () => {
    const task = makeTodo({
      title: 'Pack for trip',
      dueDate: '2026-07-09',
      subtasks: [
        { subtaskId: 's-1', title: 'Passport', isCompleted: false, position: 1 },
        { subtaskId: 's-2', title: 'Chargers', isCompleted: true, position: 2 },
      ],
    });
    seedGuestTodos([task]);
    const user = userEvent.setup();
    renderPlan([task]);

    await user.click(
      await screen.findByRole('button', { name: `Subtasks of task ${task.taskNumber}` }),
    );
    const passport = await screen.findByRole('button', { name: 'Toggle subtask Passport' });
    expect(passport).toHaveAttribute('aria-pressed', 'false');
    await user.click(passport);

    await waitFor(() => {
      const raw = window.localStorage.getItem('guest_todos');
      const todos = JSON.parse(raw as string) as {
        subtasks: { subtaskId: string; isCompleted: boolean }[];
      }[];
      expect(todos[0]?.subtasks.find((s) => s.subtaskId === 's-1')?.isCompleted).toBe(true);
    });
  });
});
