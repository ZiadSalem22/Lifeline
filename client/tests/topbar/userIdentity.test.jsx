import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import TopBar from '../../src/components/layout/TopBar.jsx';

// Mock useAuth to control isAuthenticated state in tests
vi.mock('../../src/hooks/useAuth', () => {
  return {
    useAuth: () => ({
      isAuthenticated: true,
      loginWithRedirect: () => {},
      logout: () => {},
    }),
  };
});

function renderTopBar(props) {
  return render(<TopBar {...props} searchQuery="" setSearchQuery={()=>{}} onOpenSettings={()=>{}} onOpenSidebar={()=>{}} isMobileSidebarOpen={false} />);
}

describe('TopBar user identity', () => {
  it('shows guest banner when guestMode true', () => {
    const { getByText } = renderTopBar({ guestMode:true, currentUser:null });
    expect(getByText(/Hello, Guest/i)).toBeTruthy();
  });

  it('shows avatar and name when logged in', () => {
    const mockUser = { name:'Alice Example', picture:'https://example.com/a.png', email:'alice@example.com' };
    const { getByText, getByAltText } = renderTopBar({ guestMode:false, currentUser:mockUser });
    expect(getByText(/Alice Example/)).toBeTruthy();
    expect(getByAltText(/Alice Example/)).toBeTruthy();
  });
});
