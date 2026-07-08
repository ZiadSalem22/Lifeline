import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { queryClient } from '../shared/api/query-client';
import { installFetchMock, makeMe } from '../test/test-utils';

describe('App smoke (local auth adapter + mocked /me)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AUTH_DISABLED', '1');
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    queryClient.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders sidebar nav, topbar, and the dashboard shell without errors', async () => {
    const fetchMock = installFetchMock(makeMe());
    render(<App />);

    // Dashboard shell (identity resolved via mocked GET /me).
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();

    // Sidebar quick nav.
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /statistics/i })).toBeInTheDocument();
    expect(screen.getByText('Lifeline')).toBeInTheDocument();

    // TopBar: search input + identity chip with the profile first name.
    expect(screen.getByLabelText('Search tasks and tags')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open profile menu' })).toHaveTextContent('Ziyad');

    // Dashboard body: empty state + composer auto-opened for the empty list.
    expect(await screen.findByText('All clear!')).toBeInTheDocument();
    expect(screen.getByLabelText('Task title')).toBeInTheDocument();
  });

  it('redirects authenticated users without completed onboarding to /onboarding', async () => {
    installFetchMock(makeMe({ profile: null }));
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Welcome Home' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/onboarding');
  });
});
