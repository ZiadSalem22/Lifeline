import { describe, expect, it } from 'vitest';
import { computeKeyboardInset } from './keyboard-inset';

/** Keyboard-overlap math for lifting bottom sheets above the iOS keyboard. */

describe('computeKeyboardInset', () => {
  it('is 0 when the visual viewport fills the layout viewport (no keyboard)', () => {
    expect(computeKeyboardInset(844, { height: 844, offsetTop: 0 })).toBe(0);
  });

  it('ignores small gaps (URL-bar jitter, not a keyboard)', () => {
    expect(computeKeyboardInset(844, { height: 800, offsetTop: 0 })).toBe(0);
  });

  it('reports the keyboard height when the viewport shrinks', () => {
    // 844 layout, keyboard ~336px → visible 508.
    expect(computeKeyboardInset(844, { height: 508, offsetTop: 0 })).toBe(336);
  });

  it('accounts for visual-viewport scroll offset', () => {
    expect(computeKeyboardInset(844, { height: 500, offsetTop: 44 })).toBe(300);
  });

  it('never returns a negative inset', () => {
    expect(computeKeyboardInset(844, { height: 900, offsetTop: 0 })).toBe(0);
  });
});
