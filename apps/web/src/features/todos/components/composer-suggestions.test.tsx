import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/harness';
import { makeTodo } from '../../../test/test-utils';
import { Composer } from './Composer';

/**
 * The composer's type-ahead "reuse a previous task" flow. Suggestions are a
 * pure client-side filter over the passed allTodos list, so this drives the
 * real component with a couple of todos and asserts the dropdown + template load.
 */

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Composer type-ahead suggestions', () => {
  it('suggests matching previous tasks as you type and loads one as a template on click', async () => {
    const user = userEvent.setup();
    const allTodos = [
      makeTodo({
        taskNumber: 12,
        title: 'Weekly report review',
        description: 'summarize wins',
        duration: 45,
        priority: 'high',
        subtasks: [{ subtaskId: 's-1', title: 'Collect data', isCompleted: false, position: 1 }],
      }),
      makeTodo({ taskNumber: 13, title: 'Buy groceries' }),
    ];
    renderWithProviders(
      <Composer
        open
        allTags={[]}
        allTodos={allTodos}
        effectiveDate="2026-07-06"
        onRequestClose={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Task title'), 'Weekly');

    // The dropdown surfaces only the title-matching task, and clicking it loads
    // the FULL task as a template (title, notes, duration, subtasks).
    const option = await screen.findByRole('button', { name: /Weekly report review/ });
    expect(screen.queryByText('Buy groceries')).not.toBeInTheDocument();
    await user.click(option);

    await waitFor(() =>
      expect(screen.getByLabelText('Task title')).toHaveValue('Weekly report review'),
    );
    expect(screen.getByLabelText('Task description')).toHaveValue('summarize wins');
    expect(screen.getByLabelText('Duration minutes')).toHaveValue('45');
    // The dropdown closes once a suggestion is applied.
    expect(screen.queryByText('Reuse a previous task')).not.toBeInTheDocument();
  });
});
