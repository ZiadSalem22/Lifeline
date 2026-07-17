import { describe, expect, it } from 'vitest';
import { formatClock } from './time-format';

/** 24h passes through; 12h renders AM/PM, compacting whole hours. */
describe('formatClock', () => {
  it('24h mode returns the stored string unchanged', () => {
    expect(formatClock('05:00', '24h')).toBe('05:00');
    expect(formatClock('13:30', '24h')).toBe('13:30');
    expect(formatClock('00:00', '24h')).toBe('00:00');
  });

  it('12h whole hours are compact (no :00)', () => {
    expect(formatClock('05:00', '12h')).toBe('5 AM');
    expect(formatClock('17:00', '12h')).toBe('5 PM');
    expect(formatClock('00:00', '12h')).toBe('12 AM'); // midnight
    expect(formatClock('12:00', '12h')).toBe('12 PM'); // noon
    expect(formatClock('24:00', '12h')).toBe('12 AM'); // schedule uses hour 24 → 00
  });

  it('12h off-hours keep minutes', () => {
    expect(formatClock('13:30', '12h')).toBe('1:30 PM');
    expect(formatClock('09:05', '12h')).toBe('9:05 AM');
    expect(formatClock('00:15', '12h')).toBe('12:15 AM');
    expect(formatClock('23:59', '12h')).toBe('11:59 PM');
  });

  it('returns malformed input verbatim (never blanks a row)', () => {
    expect(formatClock('', '12h')).toBe('');
    expect(formatClock('not a time', '12h')).toBe('not a time');
    expect(formatClock('99:99', '12h')).toBe('99:99');
  });
});
