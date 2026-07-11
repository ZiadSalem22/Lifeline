import { useCallback, useEffect, useState } from 'react';
import { putSettings } from '../../../shared/api/endpoints';
import { useAuth } from '../../../app/providers/auth-context';

/**
 * Home view mode (Tasks ⇄ Daily Plan), persisted like the theme: localStorage
 * for instant sync reads, mirrored to settings.layout.homeViewMode for
 * authenticated users (merging so unrelated layout keys survive).
 */

export type HomeViewMode = 'tasks' | 'plan';
const MODE_KEY = 'homeViewMode';

function isHomeViewMode(value: unknown): value is HomeViewMode {
  return value === 'tasks' || value === 'plan';
}

function readStoredMode(): HomeViewMode {
  try {
    const raw = window.localStorage.getItem(MODE_KEY);
    return isHomeViewMode(raw) ? raw : 'tasks';
  } catch {
    return 'tasks';
  }
}

export function useHomeViewMode(): [HomeViewMode, (mode: HomeViewMode) => void] {
  const { currentUser, guestMode } = useAuth();
  const [mode, setModeState] = useState<HomeViewMode>(readStoredMode);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);

  // Hydrate from server settings once per resolved identity (render-time
  // adjustment guarded by comparison, matching the theme provider).
  if (currentUser?.settings && hydratedUserId !== currentUser.id) {
    setHydratedUserId(currentUser.id);
    const stored = currentUser.settings.layout['homeViewMode'];
    if (isHomeViewMode(stored)) setModeState(stored);
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(MODE_KEY, mode);
    } catch {
      // storage unavailable
    }
  }, [mode]);

  const setMode = useCallback(
    (next: HomeViewMode) => {
      setModeState(next);
      if (!currentUser || guestMode) return;
      const layout = currentUser.settings?.layout ?? {};
      putSettings({ layout: { ...layout, homeViewMode: next } }).catch(() => {
        // fire-and-forget — view mode must never disturb the UI
      });
    },
    [currentUser, guestMode],
  );

  return [mode, setMode];
}
