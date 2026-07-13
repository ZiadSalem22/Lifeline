import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/harness';
import { makeTodo } from '../../../test/test-utils';
import { Composer } from './Composer';

/**
 * The composer's type-ahead "reuse a previous task" flow + the Fresh-copy vs
 * Keep-progress choice. Suggestions are a pure client-side filter over the
 * passed allTodos list. Queries for the suggestion buttons are scoped to the
 * listbox with within(), because the #number Load bar exposes identically
 * labelled "Fresh copy"/"Keep progress" buttons too.
 */

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderComposer(allTodos: ReturnType<typeof makeTodo>[]) {
  renderWithProviders(
    <Composer
      open
      allTags={[]}
      allTodos={allTodos}
      effectiveDate="2026-07-06"
      onRequestClose={vi.fn()}
    />,
  );
}

const weeklyWithDoneSubtask = makeTodo({
  taskNumber: 12,
  title: 'Weekly report review',
  description: 'summarize wins',
  duration: 45,
  priority: 'high',
  subtasks: [{ subtaskId: 's-1', title: 'Collect data', isCompleted: true, position: 1 }],
});

describe('Composer type-ahead suggestions', () => {
  it('completed-subtask task: the row copies fresh (subtasks unchecked); Keep progress is offered', async () => {
    const user = userEvent.setup();
    renderComposer([weeklyWithDoneSubtask, makeTodo({ taskNumber: 13, title: 'Buy groceries' })]);

    await user.type(screen.getByLabelText('Task title'), 'Weekly');

    // Only the title-matching task appears.
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Weekly report review')).toBeInTheDocument();
    expect(within(listbox).queryByText('Buy groceries')).not.toBeInTheDocument();

    // Progress case keeps a secondary "Keep progress" button; the row itself
    // makes a fresh copy, so there is no separate "Fresh copy"/"Copy" button.
    expect(within(listbox).getByRole('button', { name: 'Keep progress' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('button', { name: 'Fresh copy' })).not.toBeInTheDocument();

    // Clicking the whole row copies fresh — the subtask carries over unchecked.
    await user.click(within(listbox).getByRole('option'));

    expect(screen.getByLabelText('Task title')).toHaveValue('Weekly report review');
    expect(screen.getByLabelText('Task description')).toHaveValue('summarize wins');
    expect(screen.getByLabelText('Toggle subtask Collect data')).not.toBeChecked();
    expect(screen.queryByText('Reuse a previous task')).not.toBeInTheDocument();
  });

  it('Keep progress carries the subtask completion over', async () => {
    const user = userEvent.setup();
    renderComposer([weeklyWithDoneSubtask]);

    await user.type(screen.getByLabelText('Task title'), 'Weekly');
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByRole('button', { name: 'Keep progress' }));

    expect(screen.getByLabelText('Task title')).toHaveValue('Weekly report review');
    expect(screen.getByLabelText('Toggle subtask Collect data')).toBeChecked();
  });

  it('no-progress task: no action buttons — clicking the whole row copies it', async () => {
    const user = userEvent.setup();
    renderComposer([makeTodo({ taskNumber: 20, title: 'Buy groceries' })]);

    await user.type(screen.getByLabelText('Task title'), 'Buy');
    const listbox = await screen.findByRole('listbox');
    // The row is the click target — no Copy / Fresh / Keep buttons at all.
    expect(within(listbox).queryByRole('button')).not.toBeInTheDocument();

    await user.click(within(listbox).getByRole('option'));
    expect(screen.getByLabelText('Task title')).toHaveValue('Buy groceries');
    expect(screen.queryByText('Reuse a previous task')).not.toBeInTheDocument();
  });
});
