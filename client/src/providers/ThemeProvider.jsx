import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuthContext } from './AuthProvider.jsx';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const themes = ['dark', 'blue-dark', 'white', 'pink', 'red', 'blue', 'midnight', 'sunset'];
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [font, setFont] = useState(() => localStorage.getItem('font') || '"DM Sans", sans-serif');
  const { fetchWithAuth } = useApi();
  const { guestMode, isAuthenticated, checkedIdentity } = useAuthContext();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-family-base', font);
    localStorage.setItem('font', font);
  }, [font]);

  const changeTheme = useCallback((t) => {
    setTheme(t);
    // Persist for authenticated users
    (async () => {
      try {
        // Only persist when we know user is authenticated
        if (!guestMode && isAuthenticated && checkedIdentity) {
          console.debug('ThemeProvider: persisting theme', { isAuthenticated, checkedIdentity, guestMode, theme: t });
          await fetchWithAuth('/api/settings', { method: 'POST', body: JSON.stringify({ theme: t, layout: { font } }), quiet401: true, debugAuth: true });
        }
      } catch (e) {
        // Non-fatal: keep local theme even if server save fails
        // console.debug('Failed to persist theme', e?.message || e);
      }
    })();
  }, [fetchWithAuth, guestMode, isAuthenticated, checkedIdentity, font]);

  const changeFont = useCallback((f) => {
    setFont(f);
    (async () => {
      try {
        if (!guestMode && isAuthenticated && checkedIdentity) {
          console.debug('ThemeProvider: persisting font', { isAuthenticated, checkedIdentity, guestMode, font: f });
          await fetchWithAuth('/api/settings', { method: 'POST', body: JSON.stringify({ theme, layout: { font: f } }), quiet401: true, debugAuth: true });
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [fetchWithAuth, guestMode, isAuthenticated, checkedIdentity, theme]);

  const value = { theme, font, themes, changeTheme, changeFont };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
