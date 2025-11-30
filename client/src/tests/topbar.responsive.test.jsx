import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TopBar from '../components/layout/TopBar.jsx';

import { MemoryRouter } from 'react-router-dom';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, loginWithRedirect: () => {}, logout: () => {} })
}));

describe('TopBar responsive search', () => {
  it('renders search pill and no standalone settings button', () => {
    render(
      <MemoryRouter>
        <TopBar
          onOpenSettings={() => {}}
          searchQuery=""
          setSearchQuery={() => {}}
          onOpenSidebar={() => {}}
          isMobileSidebarOpen={false}
          currentUser={{ name: 'Alex Example' }}
          guestMode={false}
          onLogout={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText(/search/i)).toBeTruthy();
    const settingsButtons = screen.queryAllByTitle(/settings/i);
    expect(settingsButtons.length).toBe(0);
  });
});
