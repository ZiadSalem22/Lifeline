import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeUserAuth, renderWithProviders } from '../../test/harness';
import {
  bodyOf,
  emptyPage,
  jsonResponse,
  makeMe,
  makeTodo,
  seedGuestTodos,
} from '../../test/test-utils';
import { AdvancedSearch } from './AdvancedSearch';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderSearch(options: Parameters<typeof renderWithProviders>[1] = {}) {
  return renderWithProviders(<AdvancedSearch />, {
    path: '/search',
    routes: [
      { path: '/search', element: <AdvancedSearch /> },
      { path: '/day/:day', element: <div>DAY PAGE</div> },
    ],
    ...options,
  });
}

describe('AdvancedSearch (guest mode: pure client filtering)', () => {
  it('filters guest todos client-side and supports click + shift-range selection and batch Done', async () => {
    const user = userEvent.setup();
    const todos = [
      makeTodo({ id: 'g1', title: 'Alpha report', dueDate: '2026-01-01' }),
      makeTodo({ id: 'g2', title: 'Beta report', dueDate: '2026-01-02' }),
      makeTodo({ id: 'g3', title: 'Gamma report', dueDate: '2026-01-03' }),
      makeTodo({ id: 'g4', title: 'Unrelated', dueDate: '2026-01-04' }),
    ];
    seedGuestTodos(todos);
    renderSearch();

    // All four todos render initially (browse mode).
    expect(await screen.findByText(/Alpha report/)).toBeInTheDocument();

    // Free-text filter narrows to the three "report" rows.
    await user.type(screen.getByLabelText('Search text'), 'report');
    await waitFor(() => expect(screen.queryByText(/Unrelated/)).not.toBeInTheDocument());

    // Click first row, then shift-click the last: range of 3 selected.
    const rows = screen.getAllByTestId(/search-row-/);
    await user.click(rows[0]!);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.keyboard('{Shift>}');
    await user.click(rows[2]!);
    await user.keyboard('{/Shift}');
    expect(screen.getByText('3 selected')).toBeInTheDocument();

    // Batch "Mark as Done" completes them in guest storage.
    await user.click(screen.getByRole('button', { name: 'Mark as Done' }));
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('guest_todos') ?? '[]') as {
        id: string;
        isCompleted: boolean;
      }[];
      const done = stored.filter((todo) => todo.isCompleted).map((todo) => todo.id);
      expect(done.sort()).toEqual(['g1', 'g2', 'g3']);
    });
  });

  it('Escape clears the selection', async () => {
    const user = userEvent.setup();
    seedGuestTodos([makeTodo({ title: 'Selectable', dueDate: '2026-01-01' })]);
    renderSearch();
    await user.click(await screen.findByText(/Selectable/));
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });

  it('double-click on a row navigates to its day', async () => {
    const user = userEvent.setup();
    seedGuestTodos([makeTodo({ title: 'Jump target', dueDate: '2020-05-05' })]);
    renderSearch();
    await user.dblClick(await screen.findByText(/Jump target/));
    expect(await screen.findByText('DAY PAGE')).toBeInTheDocument();
  });
});

describe('AdvancedSearch (server mode: preview vs live + archived restore)', () => {
  it('shows the month-cache Preview first, then switches to Live server results', async () => {
    const monthTodo = makeTodo({ title: 'quarterly month cache row', dueDate: '2026-07-02' });
    const liveTodo = makeTodo({ title: 'quarterly LIVE row', dueDate: '2026-07-03' });
    // The query string matters here, so stub fetch directly.
    const fetchMock = vi.fn((input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const parsed = new URL(url, 'http://localhost');
      if (parsed.pathname === '/api/v1/tags') return Promise.resolve(jsonResponse([]));
      if (parsed.pathname === '/api/v1/todos') {
        if (parsed.searchParams.get('q') === 'quarterly') {
          return Promise.resolve(
            jsonResponse({
              items: [liveTodo],
              page: 1,
              pageSize: 10,
              totalItems: 1,
              totalPages: 1,
            }),
          );
        }
        return Promise.resolve(
          jsonResponse({
            items: [monthTodo],
            page: 1,
            pageSize: 100,
            totalItems: 1,
            totalPages: 1,
          }),
        );
      }
      return Promise.resolve(jsonResponse(emptyPage()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderSearch({ auth: makeUserAuth(makeMe()) });

    // Month cache loads into browse mode.
    expect(await screen.findByText(/month cache row/)).toBeInTheDocument();

    // Typing q >= 2 chars: preview over the month cache appears first…
    await user.type(screen.getByLabelText('Search text'), 'quarterly');
    await waitFor(() => expect(screen.getByText('Preview')).toBeInTheDocument());
    expect(screen.getByText(/month cache row/)).toBeInTheDocument();

    // …then the debounced live server search takes over.
    await waitFor(() => expect(screen.getByText(/LIVE row/)).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.queryByText(/month cache row/)).not.toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('include-archived shows archived rows and batch Restore posts action=restore', async () => {
    const active = makeTodo({ title: 'Active row', dueDate: '2026-07-01' });
    const archived = makeTodo({ title: 'Archived row', dueDate: '2026-06-01', archived: true });
    const batchCalls: unknown[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const parsed = new URL(url, 'http://localhost');
      if (parsed.pathname === '/api/v1/tags') return Promise.resolve(jsonResponse([]));
      if (parsed.pathname === '/api/v1/todos' && (init?.method ?? 'GET') === 'GET') {
        const items = parsed.searchParams.get('includeArchived') ? [active, archived] : [active];
        return Promise.resolve(
          jsonResponse({ items, page: 1, pageSize: 10, totalItems: items.length, totalPages: 1 }),
        );
      }
      if (parsed.pathname === '/api/v1/todos/batch') {
        batchCalls.push(bodyOf(init));
        return Promise.resolve(jsonResponse({ action: 'restore', results: [] }));
      }
      return Promise.resolve(jsonResponse(emptyPage()));
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderSearch({ auth: makeUserAuth(makeMe()) });

    expect(await screen.findByText(/Active row/)).toBeInTheDocument();
    expect(screen.queryByText(/Archived row/)).not.toBeInTheDocument();

    // Toggle include-archived: live mode now returns the archived row too.
    await user.click(screen.getByRole('checkbox', { name: /Include archived/i }));
    const archivedRow = await screen.findByText(/Archived row/, undefined, { timeout: 3000 });
    const rowElement = archivedRow.closest('[data-testid^="search-row-"]') as HTMLElement;
    expect(within(rowElement).getByText('Archived')).toBeInTheDocument(); // badge

    // Select it → Restore appears (only with the archived view on).
    await user.click(archivedRow);
    const restore = await screen.findByRole('button', { name: 'Restore' });
    await user.click(restore);

    await waitFor(() => expect(batchCalls.length).toBe(1));
    const call = batchCalls[0] as { action: string; ids: string[] };
    expect(call.action).toBe('restore');
    expect(call.ids).toEqual([archived.id]);
  });
});
