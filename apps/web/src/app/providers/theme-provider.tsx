import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { putSettings } from '../../shared/api/endpoints';
import { useAuth } from './auth-context';
import {
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_STACKS,
  FONTS,
  isFontName,
  isThemeId,
  THEMES,
  ThemeContext,
} from './theme-context';
import type { FontName, ThemeContextValue, ThemeId } from './theme-context';

/**
 * Theme/font state, ported from the old ThemeProvider:
 * - localStorage keys 'theme' / 'font' (defaults: 'dark', 'DM Sans');
 * - applies documentElement[data-theme] and the --font-family-base inline var;
 * - fontSize (12–20, default 14) applies --font-size-base — the old Settings
 *   slider had no onChange, it is functional now;
 * - authed users persist quietly via PUT /me/settings {theme, layout:{font,
 *   fontSize}} (fire-and-forget) and hydrate from settings when identity loads.
 */

const THEME_KEY = 'theme';
const FONT_KEY = 'font';
const FONT_SIZE_KEY = 'fontSize';

function clampFontSize(value: number): number {
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
}

function readStoredTheme(): ThemeId {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isThemeId(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

function readStoredFont(): FontName {
  try {
    const stored = window.localStorage.getItem(FONT_KEY);
    return isFontName(stored) ? stored : 'DM Sans';
  } catch {
    return 'DM Sans';
  }
}

function readStoredFontSize(): number {
  try {
    const stored = Number(window.localStorage.getItem(FONT_SIZE_KEY));
    return Number.isFinite(stored) && stored >= FONT_SIZE_MIN && stored <= FONT_SIZE_MAX
      ? Math.round(stored)
      : FONT_SIZE_DEFAULT;
  } catch {
    return FONT_SIZE_DEFAULT;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { currentUser, guestMode } = useAuth();
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme);
  const [font, setFontState] = useState<FontName>(readStoredFont);
  const [fontSize, setFontSizeState] = useState<number>(readStoredFontSize);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);

  // Hydrate from server settings once per resolved identity (state adjustment
  // during render, guarded by comparison — see react.dev "adjusting state when
  // a prop changes").
  if (currentUser?.settings && hydratedUserId !== currentUser.id) {
    setHydratedUserId(currentUser.id);
    const settings = currentUser.settings;
    if (isThemeId(settings.theme)) setThemeState(settings.theme);
    const layoutFont = settings.layout['font'];
    if (isFontName(layoutFont)) setFontState(layoutFont);
    const layoutFontSize = settings.layout['fontSize'];
    if (typeof layoutFontSize === 'number' && Number.isFinite(layoutFontSize)) {
      setFontSizeState(clampFontSize(layoutFontSize));
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-family-base', FONT_STACKS[font]);
    try {
      window.localStorage.setItem(FONT_KEY, font);
    } catch {
      // storage unavailable
    }
  }, [font]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`);
    try {
      window.localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
    } catch {
      // storage unavailable
    }
  }, [fontSize]);

  const persist = useCallback(
    (next: { theme: ThemeId; font: FontName; fontSize: number }) => {
      if (!currentUser || guestMode) return;
      // Merge into the existing layout so unrelated keys (e.g. weekStart from
      // the statistics page) survive the upsert.
      const layout = currentUser.settings?.layout ?? {};
      putSettings({
        theme: next.theme,
        layout: { ...layout, font: next.font, fontSize: next.fontSize },
      }).catch(() => {
        // fire-and-forget: appearance persistence must never disturb the UI
      });
    },
    [currentUser, guestMode],
  );

  const setTheme = useCallback(
    (next: ThemeId) => {
      setThemeState(next);
      persist({ theme: next, font, fontSize });
    },
    [persist, font, fontSize],
  );

  const setFont = useCallback(
    (next: FontName) => {
      setFontState(next);
      persist({ theme, font: next, fontSize });
    },
    [persist, theme, fontSize],
  );

  const setFontSize = useCallback(
    (px: number) => {
      const next = clampFontSize(px);
      setFontSizeState(next);
      persist({ theme, font, fontSize: next });
    },
    [persist, theme, font],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      font,
      setFont,
      fontSize,
      setFontSize,
      themes: THEMES,
      fonts: FONTS,
    }),
    [theme, setTheme, font, setFont, fontSize, setFontSize],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
