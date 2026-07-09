import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { guestApi } from '../../../shared/guest/guest-api';
import { renderWithProviders } from '../../../test/harness';
import { makeTodo, seedGuestTodos } from '../../../test/test-utils';
import { Composer } from './Composer';

/** Guest-mode composer tests: guestApi.createTodo is spied for payload checks. */

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderComposer(effectiveDate = '2026-07-06') {
  const onRequestClose = vi.fn();
  const view = renderWithProviders(
    <Composer
      open
      allTags={[]}
      allTodos={[]}
      effectiveDate={effectiveDate}
      onRequestClose={onRequestClose}
    />,
  );
  return { ...view, onRequestClose };
}

describe('Composer submit payload', () => {
  it('creates with title, duration, flag, priority, time, subtasks, and the selected day', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(guestApi, 'createTodo');
    renderComposer('2026-07-06');

    await user.type(screen.getByLabelText('Task title'), 'Plan sprint');
    await user.type(screen.getByLabelText('Task description'), 'agenda notes');
    await user.selectOptions(screen.getByLabelText('Duration hours'), '1');
    await user.selectOptions(screen.getByLabelText('Duration minutes'), '30');
    await user.click(screen.getByRole('button', { name: 'Flag task' }));
    await user.selectOptions(screen.getByLabelText('Priority'), 'high');
    await user.type(screen.getByLabelText('New subtask'), 'Write agenda{Enter}');
    await user.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith({
      title: 'Plan sprint',
      description: 'agenda notes',
      dueDate: '2026-07-06',
      dueTime: null,
      tags: [],
      isFlagged: true,
      duration: 90,
      priority: 'high',
      subtasks: [{ title: 'Write agenda', isCompleted: false }],
      recurrence: null,
    });
  });

  it("resolves the 'today' view token to a real date so the new task appears on the day it was created", async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(guestApi, 'createTodo');
    renderComposer('today');

    await user.type(screen.getByLabelText('Task title'), 'Visible task');
    await user.click(screen.getByRole('button', { name: 'Add Task' }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    const payload = createSpy.mock.calls[0]![0];
    // Regression: 'today'/'tomorrow' tokens used to fall through to dueDate=null,
    // making freshly created tasks vanish from the default day view.
    expect(payload.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(payload.dueDate).toBe(expected);
  });

  it('includes the applied recurrence in the payload and shows its badge', async () => {
    const user = userEvent.setup();
    const createSpy = vi.spyOn(guestApi, 'createTodo');
    renderComposer('2026-07-06');

    await user.type(screen.getByLabelText('Task title'), 'Standup');
    await user.click(screen.getByRole('button', { name: 'Recurrence' }));
    // Daily is preselected; the start date defaults to the selected day.
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-07-06' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-07-08' } });
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    // Button now shows the recurrence label instead of "Recurrence".
    expect(screen.getByRole('button', { name: 'Daily' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Task' }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy.mock.calls[0]?.[0]?.recurrence).toEqual({
      mode: 'daily',
      type: 'daily',
      startDate: '2026-07-06',
      endDate: '2026-07-08',
    });
    // Guest recurrence pre-expansion: one row per day.
    const stored = await guestApi.fetchTodos();
    expect(stored.map((todo) => todo.dueDate)).toEqual(['2026-07-06', '2026-07-07', '2026-07-08']);
  });
});

describe('Composer template loading', () => {
  it('prefills from #number but RESETS date, time, and recurrence', async () => {
    const user = userEvent.setup();
    seedGuestTodos([
      makeTodo({
        taskNumber: 7,
        title: 'Weekly report',
        description: 'summarize wins',
        dueDate: '2026-01-01',
        dueTime: '09:00',
        duration: 95,
        isFlagged: true,
        priority: 'high',
        recurrence: { mode: 'daily', startDate: '2026-01-01', endDate: '2026-01-05' },
        subtasks: [{ subtaskId: 's-1', title: 'Collect data', isCompleted: true, position: 1 }],
      }),
    ]);
    const createSpy = vi.spyOn(guestApi, 'createTodo');
    renderComposer('2026-07-06');

    await user.type(screen.getByLabelText('Load task by number'), '7');
    await user.click(screen.getByRole('button', { name: 'Load' }));

    await waitFor(() => expect(screen.getByLabelText('Task title')).toHaveValue('Weekly report'));
    expect(screen.getByLabelText('Task description')).toHaveValue('summarize wins');
    expect(screen.getByLabelText('Duration hours')).toHaveValue('1');
    expect(screen.getByLabelText('Duration minutes')).toHaveValue('35');
    // Explicit resets: date, time, recurrence.
    expect(screen.getByLabelText('Due date')).toHaveValue('');
    expect(screen.getByLabelText('Due time')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Recurrence' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Task' }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    const input = createSpy.mock.calls[0]?.[0];
    expect(input?.dueDate).toBe('2026-07-06'); // selected day, not the template's
    expect(input?.dueTime).toBeNull();
    expect(input?.recurrence).toBeNull();
    expect(input?.subtasks).toEqual([{ title: 'Collect data', isCompleted: true }]);
  });

  it('shows an error for unknown task numbers', async () => {
    const user = userEvent.setup();
    seedGuestTodos([]);
    renderComposer();
    await user.type(screen.getByLabelText('Load task by number'), '99');
    await user.click(screen.getByRole('button', { name: 'Load' }));
    expect(await screen.findByText('No task found with that number.')).toBeInTheDocument();
  });
});

describe('Composer dismissal', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onRequestClose } = renderComposer();
    await user.keyboard('{Escape}');
    expect(onRequestClose).toHaveBeenCalled();
  });

  it('closes on outside click', async () => {
    const user = userEvent.setup();
    const { onRequestClose } = renderComposer();
    await user.click(document.body);
    expect(onRequestClose).toHaveBeenCalled();
  });
});
