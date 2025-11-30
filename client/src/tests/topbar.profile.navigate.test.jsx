import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TopBar from '../components/layout/TopBar.jsx';

// Mock useAuth to allow identity chip render
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, loginWithRedirect: vi.fn(), logout: vi.fn() })
}));

// Silence console errors during render
console.error = vi.fn();

describe('TopBar Profile navigation', () => {
  it('calls onOpenProfile when Profile is clicked', async () => {
    const onOpenProfile = vi.fn();
    render(
      <MemoryRouter>
        <TopBar
          onOpenSettings={() => {}}
          searchQuery=""
          setSearchQuery={() => {}}
          onOpenSidebar={() => {}}
          isMobileSidebarOpen={false}
          currentUser={{ name: 'Alex Example', picture: 'https://example.com/a.png' }}
          guestMode={false}
          onLogout={() => {}}
          onOpenProfile={onOpenProfile}
        />
      </MemoryRouter>
    );

    const chevron = await screen.findByRole('button', { name: /open profile menu/i });
    fireEvent.click(chevron);

    const profileBtn = await screen.findByRole('menuitem', { name: /Profile/i });
    fireEvent.click(profileBtn);

    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });
});
