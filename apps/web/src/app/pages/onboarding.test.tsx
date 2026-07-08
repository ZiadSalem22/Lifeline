import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeUserAuth, renderWithProviders } from '../../test/harness';
import { bodyOf, installFetchMock, makeMe, problemResponse } from '../../test/test-utils';
import OnboardingPage from './OnboardingPage';
import { startDayForCountry } from './onboarding-lib';

function renderOnboarding(auth = makeUserAuth(makeMe({ profile: null }))) {
  return renderWithProviders(<OnboardingPage />, {
    auth,
    path: '/onboarding',
    routes: [
      { path: '/onboarding', element: <OnboardingPage /> },
      { path: '/', element: <div>HOME</div> },
    ],
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('startDayForCountry', () => {
  it('US/CA/MX start Sunday, everywhere else Monday', () => {
    expect(startDayForCountry('United States')).toBe('Sunday');
    expect(startDayForCountry('usa')).toBe('Sunday');
    expect(startDayForCountry('Canada')).toBe('Sunday');
    expect(startDayForCountry('Mexico')).toBe('Sunday');
    expect(startDayForCountry('Germany')).toBe('Monday');
    expect(startDayForCountry('')).toBe('Monday');
  });
});

describe('OnboardingPage', () => {
  it('auto-selects the start day from the typed country', async () => {
    installFetchMock(makeMe({ profile: null }));
    const user = userEvent.setup();
    renderOnboarding();

    const startDay = screen.getByLabelText('Start Day Of Week');
    expect(startDay).toHaveValue('Monday');

    await user.type(screen.getByLabelText('Country'), 'United States');
    expect(startDay).toHaveValue('Sunday');

    await user.clear(screen.getByLabelText('Country'));
    await user.type(screen.getByLabelText('Country'), 'Germany');
    expect(startDay).toHaveValue('Monday');
  });

  it('submits the completed profile and navigates home', async () => {
    const fetchMock = installFetchMock(makeMe({ profile: null }));
    const user = userEvent.setup();
    const auth = makeUserAuth(makeMe({ profile: null }));
    renderOnboarding(auth);

    await user.type(screen.getByLabelText('First Name *'), 'Ziyad');
    await user.type(screen.getByLabelText('Last Name *'), 'Salem');
    // Email is prefilled from the identity.
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('HOME')).toBeInTheDocument();
    expect(auth.refreshIdentity).toHaveBeenCalled();

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT');
    const body = bodyOf(putCall?.[1]) as Record<string, unknown>;
    expect(body).toMatchObject({
      firstName: 'Ziyad',
      lastName: 'Salem',
      email: 'ziyad@example.com',
      startDayOfWeek: 'Monday',
      onboardingCompleted: true,
    });
    expect(typeof body.timezone).toBe('string');
  });

  it('recovers from a 409 email conflict via "Use different email"', async () => {
    installFetchMock(makeMe({ profile: null }), (pathname, method) =>
      pathname === '/api/v1/me/profile' && method === 'PUT'
        ? problemResponse(409, 'conflict', 'email already used')
        : null,
    );
    const user = userEvent.setup();
    renderOnboarding();

    await user.type(screen.getByLabelText('First Name *'), 'Z');
    await user.type(screen.getByLabelText('Last Name *'), 'S');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByText('This email is already associated with another account.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use different email' }));
    expect(screen.getByLabelText('Email *')).toHaveValue('');
    expect(
      screen.queryByText('This email is already associated with another account.'),
    ).not.toBeInTheDocument();
    // Still on the onboarding form.
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });
});
