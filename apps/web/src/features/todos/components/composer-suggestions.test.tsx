import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/harness';
import { makeTodo, seedGuestTodos } from '../../../test/test-utils';
import { Composer } from './Composer';

/**
 * The composer's type-ahead "reuse a previous task" flow. Isolated in its own
 * file because it exercises the debounced + async suggestion fetch; running it
 * alongside the synchronous composer tests slowed the shared file past the
 * test-timeout budget (the feature works either way — this keeps CI stable).
 */

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderComposer(effectiveDate = '2026-07-06') {
  return renderWithProviders(
    <Composer open allTags={[]} effectiveDate={effectiveDate} onRequestClose={vi.fn()} />,
  );
}

describe('Composer type-ahead suggestions', () => {
  it('suggests matching previous tasks as you type and loads one as a template on click', async () => {
    const user = userEvent.setup();
    seedGuestTodos([
      makeTodo({
        taskNumber: 12,
        title: 'Weekly report',
        description: 'summarize wins',
        duration: 45,
        priority: 'high',
        subtasks: [{ subtaskId: 's-1', title: 'Collect data', isCompleted: false, position: 1 }],
      }),
      makeTodo({ taskNumber: 13, title: 'Buy groceries' }),
    ]);
    renderComposer('2026-07-06');

    await user.type(screen.getByLabelText('Task title'), 'Weekly');

    // The dropdown surfaces only the title-matching task, and clicking it loads
    // the FULL task as a template (title, notes, duration, subtasks).
    const option = await screen.findByRole('button', { name: /Weekly report/ });
    expect(screen.queryByText('Buy groceries')).not.toBeInTheDocument();
    await user.click(option);

    await waitFor(() => expect(screen.getByLabelText('Task title')).toHaveValue('Weekly report'));
    expect(screen.getByLabelText('Task description')).toHaveValue('summarize wins');
    expect(screen.getByLabelText('Duration minutes')).toHaveValue('45');
    // The dropdown closes once a suggestion is applied.
    expect(screen.queryByText('Reuse a previous task')).not.toBeInTheDocument();
  });
});
