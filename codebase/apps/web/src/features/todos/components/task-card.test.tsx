import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Todo } from '@lifeline/shared';
import { makeTag, makeTodo } from '../../../test/test-utils';
import { TaskCard } from './TaskCard';
import type { TaskCardProps } from './TaskCard';

function renderCard(todo: Todo, overrides: Partial<TaskCardProps> = {}) {
  const props: TaskCardProps = {
    todo,
    allTags: [],
    isEditing: false,
    isExpanded: false,
    onToggle: vi.fn(),
    onFlag: vi.fn(),
    onDelete: vi.fn(),
    onStartEdit: vi.fn(),
    onSaveEdit: vi.fn(),
    onCancelEdit: vi.fn(),
    onUpdatePriority: vi.fn(),
    onUpdateSubtasks: vi.fn(),
    onToggleExpand: vi.fn(),
    ...overrides,
  };
  render(<TaskCard {...props} />);
  return props;
}

describe('TaskCard display mode', () => {
  it('toggles completion from the checkbox', async () => {
    const user = userEvent.setup();
    const todo = makeTodo({ title: 'Water plants' });
    const props = renderCard(todo);
    await user.click(screen.getByRole('button', { name: 'Mark as completed' }));
    expect(props.onToggle).toHaveBeenCalledWith(todo.id);
  });

  it('double-click on the card toggles completion', async () => {
    const user = userEvent.setup();
    const todo = makeTodo();
    const props = renderCard(todo);
    await user.dblClick(screen.getByTestId(`task-card-${todo.id}`));
    expect(props.onToggle).toHaveBeenCalledWith(todo.id);
  });

  it('delete button calls onDelete (server-side this is archive)', async () => {
    const user = userEvent.setup();
    const todo = makeTodo();
    const props = renderCard(todo);
    await user.click(screen.getByRole('button', { name: 'Delete task' }));
    expect(props.onDelete).toHaveBeenCalledWith(todo.id);
  });

  it('clicking the title starts inline edit — unless completed', async () => {
    const user = userEvent.setup();
    const active = makeTodo({ title: 'Editable' });
    const props = renderCard(active);
    await user.click(screen.getByText('Editable'));
    expect(props.onStartEdit).toHaveBeenCalledWith(active);
  });

  it('never starts edit for completed todos', async () => {
    const user = userEvent.setup();
    const completed = makeTodo({ title: 'Done deal', isCompleted: true });
    const props = renderCard(completed);
    await user.click(screen.getByText('Done deal'));
    expect(props.onStartEdit).not.toHaveBeenCalled();
  });

  it('subtask checkbox sends the whole array with the flipped item (stable subtaskId)', async () => {
    const user = userEvent.setup();
    const todo = makeTodo({
      subtasks: [
        { subtaskId: 's-1', title: 'First', isCompleted: false, position: 1 },
        { subtaskId: 's-2', title: 'Second', isCompleted: false, position: 2 },
      ],
    });
    const props = renderCard(todo);
    await user.click(screen.getByRole('checkbox', { name: 'Toggle subtask First' }));
    expect(props.onUpdateSubtasks).toHaveBeenCalledWith(todo.id, [
      { subtaskId: 's-1', title: 'First', isCompleted: true, position: 1 },
      { subtaskId: 's-2', title: 'Second', isCompleted: false, position: 2 },
    ]);
  });
});

describe('TaskCard inline edit mode', () => {
  it('saves the full edit payload (title/description/tags/priority/duration/subtasks)', async () => {
    const user = userEvent.setup();
    const tag = makeTag({ name: 'Deep Work' });
    const todo = makeTodo({
      title: 'Old title',
      description: 'old notes',
      duration: 60,
      subtasks: [{ subtaskId: 's-1', title: 'Keep me', isCompleted: true, position: 1 }],
    });
    const props = renderCard(todo, { isEditing: true, allTags: [tag] });

    const titleInput = screen.getByLabelText('Edit title');
    await user.clear(titleInput);
    await user.type(titleInput, '  New title  ');
    await user.selectOptions(screen.getByLabelText('Edit priority'), 'high');
    await user.click(screen.getByRole('button', { name: 'Deep Work' }));

    const newSubtask = screen.getByLabelText('New subtask');
    await user.type(newSubtask, 'Fresh subtask{Enter}');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(props.onSaveEdit).toHaveBeenCalledWith(todo.id, {
      title: 'New title',
      description: 'old notes',
      tags: [tag.id],
      priority: 'high',
      duration: 60,
      subtasks: [
        { subtaskId: 's-1', title: 'Keep me', isCompleted: true },
        { title: 'Fresh subtask', isCompleted: false },
      ],
    });
  });

  it('Enter in the title saves, Escape cancels', async () => {
    const user = userEvent.setup();
    const todo = makeTodo({ title: 'Keyboard' });
    const props = renderCard(todo, { isEditing: true });

    await user.type(screen.getByLabelText('Edit title'), '{Escape}');
    expect(props.onCancelEdit).toHaveBeenCalled();

    await user.type(screen.getByLabelText('Edit title'), '{Enter}');
    expect(props.onSaveEdit).toHaveBeenCalled();
  });

  it('shows a server save error in the open editor instead of failing silently', () => {
    const todo = makeTodo({ title: 'Has error' });
    renderCard(todo, { isEditing: true, editError: 'Title must be at most 200 characters.' });

    // Regression: a rejected save used to leave the editor open with no feedback.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Title must be at most 200 characters.');
    // Editor stays open (Save/Cancel still present).
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('caps the title and description inputs at the shared limits', () => {
    const todo = makeTodo({ title: 'Bounded' });
    renderCard(todo, { isEditing: true });
    expect(screen.getByLabelText('Edit title')).toHaveAttribute('maxlength', '200');
    expect(screen.getByLabelText('Edit description')).toHaveAttribute('maxlength', '2000');
  });
});
