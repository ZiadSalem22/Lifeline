import { describe, expect, it } from 'vitest';
import { fromLengthDisplay, fromWeightDisplay, toLengthDisplay, toWeightDisplay } from './units';

/**
 * Storage is canonical (kg / cm); these convert only at the UI edge. The
 * round-trip must be stable so toggling units never drifts a stored value.
 */

describe('weight units', () => {
  it('kg is identity; lb converts and rounds to 0.1', () => {
    expect(toWeightDisplay(80, 'kg')).toBe(80);
    expect(toWeightDisplay(80, 'lb')).toBe(176.4);
    expect(fromWeightDisplay(80, 'kg')).toBe(80);
    expect(fromWeightDisplay(176.4, 'lb')).toBeCloseTo(80, 1);
  });
});

describe('length units', () => {
  it('cm is identity; in converts and rounds to 0.1', () => {
    expect(toLengthDisplay(180, 'cm')).toBe(180);
    expect(toLengthDisplay(180, 'in')).toBe(70.9);
    expect(fromLengthDisplay(180, 'cm')).toBe(180);
    expect(fromLengthDisplay(70.9, 'in')).toBeCloseTo(180, 0);
  });
});
