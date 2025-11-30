import React from 'react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import OnboardingPage from '../../src/pages/OnboardingPage.jsx';
// Mock useAuth to ensure isAuthenticated=true in onboarding tests
import { vi } from 'vitest';
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, loginWithRedirect: () => {}, logout: () => {} })
}));
import DashboardPage from '../../src/pages/DashboardPage.jsx';
import TopBar from '../../src/components/layout/TopBar.jsx';
import Sidebar from '../../src/components/layout/Sidebar.jsx';

// Minimal wrappers to satisfy component props without full app complexity
function renderWrapper({ initialEntries, user, guestMode }) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/onboarding" element={<OnboardingPage currentUser={user} guestMode={guestMode} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Onboarding redirects', () => {
  it('shows onboarding form when not completed (no timezone field)', () => {
    const user = { profile: { onboarding_completed: false } };
    renderWrapper({ initialEntries:['/onboarding'], user, guestMode:false });
    expect(screen.getByRole('button', { name: /Continue/i })).toBeDefined();
    expect(screen.queryByText(/Timezone/i)).toBeNull();
  });

  it('redirects guest away from /onboarding', () => {
    const user = null;
    renderWrapper({ initialEntries:['/onboarding'], user, guestMode:true });
    const homes = screen.queryAllByText('home');
    expect(homes.length).toBeGreaterThan(0);
  });

  it('user with completed onboarding does not show form (Navigate)', () => {
    const user = { profile: { onboarding_completed: true } };
    renderWrapper({ initialEntries:['/onboarding'], user, guestMode:false });
    const homes = screen.queryAllByText('home');
    expect(homes.length).toBeGreaterThan(0);
  });
});
