import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Todo } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { renderWithProviders } from '../../test/harness';
import { makeTodo, seedGuestTodos } from '../../test/test-utils';
import { DailyPlanView } from './DailyPlanView';

/**
 * Tasks ⇄ Daily Plan integration: the Schedule / To-Do / Tomorrow / Priorities
 * cards are different ways to add and see the SAME real tasks. Quick-add and
 * the Add Task popup create guest tasks; timed tasks chip under their schedule
 * hour; tomorrow's tasks live in the Tomorrow card; high-priority tasks
 * surface in Top Priorities; titles deep-link via onOpenTask.
 */

beforeEach(() => {
  window.localStorage.clear();
});

function renderPlan(todos: Todo[], onOpenTask = vi.fn()) {
  seedGuestTodos(todos);
  const view = renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken="2026-07-09" todos={todos} onOpenTask={onOpenTask} />
    </ThemeProvider>,
  );
  return { ...view, onOpenTask };
}

describe('To-Do card', () => {
  it('shows an empty state, and quick-add creates a REAL guest task then clears the draft', async () => {
    const user = userEvent.setup();
    renderPlan([]);

    expect(
      await screen.findByText('No tasks for this day yet — add one below.'),
    ).toBeInTheDocument();

    const input = screen.getByLabelText('Add a quick task');
    await user.type(input, 'Buy milk');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      const raw = window.localStorage.getItem('guest_todos');
      expect(raw).not.toBeNull();
      const todos = JSON.parse(raw as string) as { title: string; dueDate: string | null }[];
      expect(todos).toHaveLength(1);
      expect(todos[0]).toMatchObject({ title: 'Buy milk', dueDate: '2026-07-09' });
    });
    // Draft cleared only after the create succeeded.
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('renders the day tasks; open titles fire onOpenTask, completed titles do not link', async () => {
    const open = makeTodo({ title: 'Ship report', dueDate: '2026-07-09' });
    const done = makeTodo({ title: 'Old chore', dueDate: '2026-07-09', isCompleted: true });
    const { onOpenTask } = renderPlan([open, done]);

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ship report' }));
    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: open.id }), '2026-07-09');
    // Completed task title is plain text (the Tasks editor refuses them).
    expect(screen.queryByRole('button', { name: 'Old chore' })).not.toBeInTheDocument();
    expect(screen.getByText('Old chore')).toBeInTheDocument();
  });
});

describe('Schedule card', () => {
  it('chips a 13:30 task under the 13:00 row with its real minutes, toggleable', async () => {
    const timed = makeTodo({ title: 'Dentist', dueDate: '2026-07-09', dueTime: '13:30' });
    renderPlan([timed]);

    // The chip shows the off-hour time; the row input itself stays free text.
    expect(await screen.findByText('13:30')).toBeInTheDocument();
    // The task renders twice: To-Do card row + schedule chip.
    const checks = screen.getAllByRole('button', { name: `Toggle task ${timed.taskNumber}` });
    expect(checks).toHaveLength(2);

    const user = userEvent.setup();
    await user.click(checks[1] as HTMLElement);
    await waitFor(() => {
      const raw = window.localStorage.getItem('guest_todos');
      const todos = JSON.parse(raw as string) as { id: string; isCompleted: boolean }[];
      expect(todos.find((t) => t.id === timed.id)?.isCompleted).toBe(true);
    });
  });

  it('per-row + opens the composer preset to that hour; submit creates the timed task', async () => {
    const user = userEvent.setup();
    renderPlan([]);

    await user.click(await screen.findByLabelText('Add task at 05:00'));
    const dialog = await screen.findByRole('dialog', { name: 'Add task' });
    expect(within(dialog).getByLabelText('Due date')).toHaveValue('2026-07-09');
    expect(within(dialog).getByLabelText('Due time')).toHaveValue('05:00');

    await user.type(within(dialog).getByLabelText('Task title'), 'Fajr walk');
    await user.click(within(dialog).getByRole('button', { name: 'Add Task' }));

    await waitFor(() => {
      const raw = window.localStorage.getItem('guest_todos');
      expect(raw).not.toBeNull();
      const todos = JSON.parse(raw as string) as {
        title: string;
        dueDate: string | null;
        dueTime: string | null;
      }[];
      expect(todos[0]).toMatchObject({
        title: 'Fajr walk',
        dueDate: '2026-07-09',
        dueTime: '05:00',
      });
    });
  });
});

describe('Tomorrow card', () => {
  it("shows tomorrow's real tasks and presets the Add Task popup to tomorrow", async () => {
    const tomorrowTask = makeTodo({ title: 'Prep slides', dueDate: '2026-07-10' });
    const { onOpenTask } = renderPlan([tomorrowTask]);

    const user = userEvent.setup();
    // The task renders in the Tomorrow card (not the To-Do card: count is 1).
    await user.click(await screen.findByRole('button', { name: 'Prep slides' }));
    expect(onOpenTask).toHaveBeenCalledWith(
      expect.objectContaining({ id: tomorrowTask.id }),
      '2026-07-10',
    );

    await user.click(screen.getByRole('button', { name: 'Add task for tomorrow' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add task' });
    expect(within(dialog).getByLabelText('Due date')).toHaveValue('2026-07-10');
  });
});

describe('Top Priorities card', () => {
  it('surfaces high-priority day tasks above the free slots', async () => {
    const high = makeTodo({ title: 'Fix prod bug', dueDate: '2026-07-09', priority: 'high' });
    const normal = makeTodo({ title: 'Tidy desk', dueDate: '2026-07-09' });
    renderPlan([high, normal]);

    expect(await screen.findByText('High priority')).toBeInTheDocument();
    // High task appears twice (To-Do + Priorities); the normal one only once.
    expect(screen.getAllByRole('button', { name: `Toggle task ${high.taskNumber}` })).toHaveLength(
      2,
    );
    expect(
      screen.getAllByRole('button', { name: `Toggle task ${normal.taskNumber}` }),
    ).toHaveLength(1);
    // Free-text priority slots are still there.
    expect(screen.getByLabelText('Priority 1')).toBeInTheDocument();
  });
});
