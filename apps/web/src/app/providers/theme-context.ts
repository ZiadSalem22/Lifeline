import { createContext, useContext } from 'react';

/**
 * The nine theme ids from the old client (base.css / ThemeProvider.themes)
 * plus 'paper' — the black-and-white print look from the Daily Plan design
 * handoff (Playfair masthead, hard 4px corners in the plan view).
 */
export const THEMES = [
  'dark',
  'blue-dark',
  'white',
  'clean-beige',
  'pink',
  'red',
  'blue',
  'midnight',
  'sunset',
  'paper',
] as const;
export type ThemeId = (typeof THEMES)[number];

export const FONTS = [
  'Inter',
  'DM Sans',
  'Space Grotesk',
  'Montserrat',
  'Times New Roman',
] as const;
export type FontName = (typeof FONTS)[number];

export const FONT_STACKS: Record<FontName, string> = {
  Inter: "'Inter', sans-serif",
  'DM Sans': "'DM Sans', sans-serif",
  'Space Grotesk': "'Space Grotesk', sans-serif",
  Montserrat: "'Montserrat', sans-serif",
  'Times New Roman': "'Times New Roman', serif",
};

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 20;
export const FONT_SIZE_DEFAULT = 14;

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

export function isFontName(value: unknown): value is FontName {
  return typeof value === 'string' && (FONTS as readonly string[]).includes(value);
}

export interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  font: FontName;
  setFont: (font: FontName) => void;
  /** Base font size in px (12–20). The old app's broken slider, now functional. */
  fontSize: number;
  setFontSize: (px: number) => void;
  themes: readonly ThemeId[];
  fonts: readonly FontName[];
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
