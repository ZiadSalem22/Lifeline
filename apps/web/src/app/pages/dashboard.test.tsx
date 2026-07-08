import { beforeEach, describe, expect, it } from 'vitest';
import { format, addDays } from 'date-fns';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/harness';
import { makeTodo, seedGuestTodos } from '../../test/test-utils';
import DashboardPage from './DashboardPage';

/** Guest-mode dashboard assembly tests (day filter, deep link, completion). */

const TODAY = format(new Date(), 'yyyy-MM-dd');
const TOMORROW = format(addDays(new Date(), 1), 'yyyy-MM-dd');

function renderDashboard(path = '/') {
  return renderWithProviders(<DashboardPage />, {
    path,
    routes: [
      { path: '/', element: <DashboardPage /> },
      { path: '/day/:day', element: <DashboardPage /> },
    ],
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('DashboardPage day view', () => {
  it("shows today's todos plus dateRange spans, hides other days", async () => {
    seedGuestTodos([
      makeTodo({ title: 'Today task', dueDate: TODAY }),
      makeTodo({ title: 'Tomorrow task', dueDate: TOMORROW }),
      makeTodo({
        title: 'Spanning range',
        dueDate: '2020-01-01',
        recurrence: { mode: 'dateRange', startDate: '2020-01-01', endDate: '2100-01-01' },
      }),
    ]);
    renderDashboard('/');

    expect(await screen.findByText('Today task')).toBeInTheDocument();
    expect(screen.getByText('Spanning range')).toBeInTheDocument();
    expect(screen.queryByText('Tomorrow task')).not.toBeInTheDocument();
    expect(screen.getByText('0 of 2 completed')).toBeInTheDocument();
  });

  it('renders the Sparkles empty state and auto-opens the composer when empty', async () => {
    seedGuestTodos([]);
    renderDashboard('/');
    expect(await screen.findByText('All clear!')).toBeInTheDocument();
    expect(screen.getByText('No tasks for today')).toBeInTheDocument();
    // Composer auto-opened (no "+ Add Task" button while open).
    expect(screen.getByLabelText('Task title')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add Task' })).not.toBeInTheDocument();
  });

  it('?taskId deep-link opens that task in edit mode', async () => {
    const target = makeTodo({ title: 'Deep linked', dueDate: TODAY });
    seedGuestTodos([target]);
    renderDashboard(`/?taskId=${target.id}`);

    const editTitle = await screen.findByLabelText('Edit title');
    expect(editTitle).toHaveValue('Deep linked');
  });

  it('double-click on a card completes it (persisted to guest storage)', async () => {
    const todo = makeTodo({ title: 'Double me', dueDate: TODAY });
    seedGuestTodos([todo]);
    const user = userEvent.setup();
    renderDashboard('/');

    const card = await screen.findByTestId(`task-card-${todo.id}`);
    await user.dblClick(card);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('guest_todos') ?? '[]') as {
        id: string;
        isCompleted: boolean;
      }[];
      expect(stored.find((item) => item.id === todo.id)?.isCompleted).toBe(true);
    });
    await waitFor(() => expect(screen.getByText('1 of 1 completed')).toBeInTheDocument());
  });
});
