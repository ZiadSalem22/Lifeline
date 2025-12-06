import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth as useAuth0 } from '../hooks/useAuth';
import { createTokenOptions } from '../hooks/useApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { isAuthenticated, isLoading: authLoading, getAccessTokenSilently, loginWithRedirect, logout } = useAuth0();
  const [guestMode, setGuestMode] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [checkedIdentity, setCheckedIdentity] = useState(false);
  const [error, setError] = useState(null);

  const loadIdentity = useCallback(async () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setGuestMode(true);
      setCurrentUser(null);
      setCheckedIdentity(true);
      return;
    }
    try {
      const token = await getAccessTokenSilently(createTokenOptions());
      // Use new fetchMe utility for user profile
      const { fetchMe } = await import('../utils/api');
      const data = await fetchMe(async (url, options) => {
        return await fetch(url, { ...options, headers: { ...(options?.headers || {}), Authorization: `Bearer ${token}` } });
      });
      setCurrentUser(data);
      if (data.profile && data.profile.onboarding_completed === false) {
        // onboarding redirect handled at route level
      }
      setGuestMode(false);
    } catch (err) {
      console.warn('Failed to load identity; using guest mode.', err?.message || err);
      setError(err?.message || 'Identity load failed');
      setGuestMode(true);
      setCurrentUser(null);
    } finally {
      setCheckedIdentity(true);
    }
  }, [authLoading, isAuthenticated, getAccessTokenSilently]);

  useEffect(() => { loadIdentity(); }, [loadIdentity]);

  // Clear guest data on successful login
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      try {
        localStorage.removeItem('guest_todos');
        localStorage.removeItem('guest_tags');
      } catch (_) {}
    }
  }, [authLoading, isAuthenticated]);

  const value = {
    isAuthenticated,
    authLoading,
    guestMode,
    currentUser,
    checkedIdentity,
    error,
    login: loginWithRedirect,
    logout: (options) => logout(options),
    refreshIdentity: loadIdentity,
    // Expose setter for legacy fallback logic in App.jsx; consider refactoring App to rely solely on provider state.
    setGuestMode
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
