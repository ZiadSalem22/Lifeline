import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../../app/providers/theme-context';

/**
 * Token completeness tripwire: five themes shipped for months without
 * --color-top-bar-bg/--search-focus and nobody noticed. Every theme block
 * must define the cross-cutting tokens the app relies on.
 */

const css = readFileSync(join(__dirname, 'tokens.css'), 'utf-8');

function themeBlock(theme: string): string {
  // Anchor on the block syntax — the header comment also mentions themes.
  const start = css.indexOf(`[data-theme='${theme}'] {`);
  expect(start, `theme block missing: ${theme}`).toBeGreaterThan(-1);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

const REQUIRED_PER_THEME = [
  '--color-primary',
  '--color-bg',
  '--color-surface',
  '--color-text',
  '--color-text-muted',
  '--color-border',
  '--color-danger',
  '--color-on-primary',
  '--scrim',
  '--color-top-bar-bg',
  '--search-focus',
];

const REQUIRED_ROOT_DEFAULTS = [
  '--chart-ink',
  '--chart-ink-2',
  '--chart-track',
  '--chart-grid',
  '--chart-target',
  '--priority-high',
  '--priority-medium',
  '--priority-low',
  '--color-on-primary',
  '--scrim',
];

describe('tokens.css completeness', () => {
  it.each([...THEMES])('theme %s defines every required token', (theme) => {
    const block = themeBlock(theme);
    for (const token of REQUIRED_PER_THEME) {
      expect(block, `${theme} missing ${token}`).toContain(`${token}:`);
    }
  });

  it(':root provides chart/priority defaults for all themes', () => {
    const rootEnd = css.indexOf("[data-theme='dark'] {");
    const root = css.slice(0, rootEnd);
    for (const token of REQUIRED_ROOT_DEFAULTS) {
      expect(root, `:root missing ${token}`).toContain(`${token}:`);
    }
  });
});
