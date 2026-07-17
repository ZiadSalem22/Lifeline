import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Todo } from '@lifeline/shared';
import { ThemeProvider } from '../../app/providers/theme-provider';
import { newQueryClient, renderWithProviders } from '../../test/harness';
import { makeTodo, seedGuestTodos } from '../../test/test-utils';
import { useUpdateTodo } from '../todos/data/hooks';
import { todosQueryKey } from '../todos/data/keys';
import { DailyPlanView } from './DailyPlanView';

/**
 * Task ↔ habit sync, end to end in guest mode: completing a task linked to a
 * habit checks that habit for the task's day; the check is EARNED BY RULE
 * (any-done), so multiple tasks feeding one habit stay coherent; moving a
 * completed task re-credits the right day.
 */

const DAY = '2026-07-09';

beforeEach(() => {
  window.localStorage.clear();
});

function renderPlan(todos: Todo[]) {
  seedGuestTodos(todos);
  return renderWithProviders(
    <ThemeProvider>
      <DailyPlanView dayToken={DAY} todos={todos} />
    </ThemeProvider>,
  );
}

function storedHabits(date = DAY): Record<string, unknown> {
  const raw = window.localStorage.getItem(`daily_plan:${date}`);
  if (!raw) return {};
  return (JSON.parse(raw) as { habits?: Record<string, unknown> }).habits ?? {};
}

describe('task → habit sync', () => {
  it('completing a linked task checks its habit for that day; unchecking clears it', async () => {
    const task = makeTodo({ title: 'Watch course', habitId: 'udemy', dueDate: DAY });
    renderPlan([task]);
    const user = userEvent.setup();

    const check = await screen.findByRole('button', { name: `Toggle task ${task.taskNumber}` });
    await user.click(check);
    await waitFor(() => expect(storedHabits()['udemy']).toBe(true));

    // Undo → the ✓ was earned by the task, so it un-earns.
    await user.click(screen.getByRole('button', { name: `Toggle task ${task.taskNumber}` }));
    await waitFor(() => expect(storedHabits()['udemy']).toBeUndefined());
  });

  it('two tasks, one habit: ANY-done semantics, order-independent', async () => {
    const a = makeTodo({ title: 'Udemy module 1', habitId: 'udemy', dueDate: DAY });
    const b = makeTodo({ title: 'Udemy module 2', habitId: 'udemy', dueDate: DAY });
    renderPlan([a, b]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: `Toggle task ${a.taskNumber}` }));
    await waitFor(() => expect(storedHabits()['udemy']).toBe(true));
    await user.click(screen.getByRole('button', { name: `Toggle task ${b.taskNumber}` }));
    await waitFor(() => expect(storedHabits()['udemy']).toBe(true));

    // Uncheck the FIRST — the second still earns the ✓.
    await user.click(screen.getByRole('button', { name: `Toggle task ${a.taskNumber}` }));
    // (give the sync a beat, then assert it stayed)
    await waitFor(() => expect(storedHabits()['udemy']).toBe(true));

    // Uncheck the last — now nothing earns it.
    await user.click(screen.getByRole('button', { name: `Toggle task ${b.taskNumber}` }));
    await waitFor(() => expect(storedHabits()['udemy']).toBeUndefined());
  });

  it('moving a completed linked task re-credits the new day and clears the old one', async () => {
    // Completed rows deliberately have no preview in the plan, so the move
    // goes through the same mutation the Tasks editor uses — a probe button.
    const task = makeTodo({
      title: 'Watch course',
      habitId: 'udemy',
      dueDate: DAY,
      isCompleted: true,
    });
    const NEXT = '2026-07-10';
    function MoveProbe({ to }: { to: string }) {
      const update = useUpdateTodo();
      return (
        <button
          type="button"
          onClick={() => update.mutate({ id: task.id, patch: { dueDate: to } })}
        >
          probe-move-{to}
        </button>
      );
    }
    seedGuestTodos([task]);
    // Prime the list cache (in the app, useAllTodos always populates it before
    // any task UI renders) — the update path reads the pre-move row from it.
    const queryClient = newQueryClient();
    queryClient.setQueryData(todosQueryKey(true), [task]);
    renderWithProviders(
      <ThemeProvider>
        <DailyPlanView dayToken={DAY} todos={[task]} />
        <MoveProbe to={NEXT} />
        <MoveProbe to={DAY} />
      </ThemeProvider>,
      { queryClient },
    );
    const user = userEvent.setup();

    // Move the COMPLETED task to tomorrow → tomorrow earns the ✓, today never
    // had a stored one. Then move it back → tomorrow's ✓ clears, today earns.
    await user.click(await screen.findByRole('button', { name: `probe-move-${NEXT}` }));
    await waitFor(() => expect(storedHabits(NEXT)['udemy']).toBe(true));
    expect(storedHabits(DAY)['udemy']).toBeUndefined();

    await user.click(screen.getByRole('button', { name: `probe-move-${DAY}` }));
    await waitFor(() => expect(storedHabits(DAY)['udemy']).toBe(true));
    await waitFor(() => expect(storedHabits(NEXT)['udemy']).toBeUndefined());
  });

  it('the composer creates the task carrying its habit link', async () => {
    renderPlan([]);
    const user = userEvent.setup();

    await user.click(await screen.findByLabelText('Add task at 05:00'));
    const dialog = await screen.findByRole('dialog', { name: 'Add task' });
    await user.type(within(dialog).getByLabelText('Task title'), 'Morning course');
    await user.selectOptions(within(dialog).getByLabelText('Counts toward habit'), 'udemy');
    await user.click(within(dialog).getByRole('button', { name: 'Add Task' }));

    await waitFor(() => {
      const raw = window.localStorage.getItem('guest_todos');
      const todos = JSON.parse(raw as string) as { title: string; habitId: string | null }[];
      expect(todos[0]).toMatchObject({ title: 'Morning course', habitId: 'udemy' });
    });
  });

  it('linking an existing task from the preview popup persists the link', async () => {
    const task = makeTodo({ title: 'Read a chapter', dueDate: DAY });
    renderPlan([task]);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Read a chapter' }));
    const dialog = await screen.findByRole('dialog', { name: /Task/ });
    await user.selectOptions(within(dialog).getByLabelText('Counts toward habit'), 'reading');

    await waitFor(() => {
      const raw = window.localStorage.getItem('guest_todos');
      const todos = JSON.parse(raw as string) as { id: string; habitId: string | null }[];
      expect(todos.find((t) => t.id === task.id)?.habitId).toBe('reading');
    });
  });
});
