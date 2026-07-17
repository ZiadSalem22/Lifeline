import { describe, expect, it } from 'vitest';
import {
  buildCalendarUrl,
  gregorianToIso,
  monthKeyOf,
  parseMonth,
  timeOnly,
  timesForDay,
} from './prayer-times';

/**
 * Prayer-times parsing is pure and defensive: the Aladhan API returns a whole
 * month of days, each timing string may carry a timezone suffix, and the odd
 * entry can be malformed. These tests pin URL assembly (incl. Auto) and the
 * tolerant parse against a canned month response.
 */

describe('buildCalendarUrl', () => {
  it('assembles calendarByCity with city + country', () => {
    const url = buildCalendarUrl('Cairo', 'Egypt', -1, 2026, 7);
    expect(url).toContain('/calendarByCity/2026/7?');
    expect(url).toContain('city=Cairo');
    expect(url).toContain('country=Egypt');
  });

  it('omits method for Auto (-1) and includes it for an explicit method', () => {
    expect(buildCalendarUrl('Cairo', 'Egypt', -1, 2026, 7)).not.toContain('method=');
    expect(buildCalendarUrl('Cairo', 'Egypt', 5, 2026, 7)).toContain('method=5');
    // 0 is a real Aladhan method (Shia Ithna-Ashari), not "Auto".
    expect(buildCalendarUrl('Karbala', 'Iraq', 0, 2026, 7)).toContain('method=0');
  });

  it('url-encodes and trims multi-word city/country', () => {
    const url = buildCalendarUrl('  New York ', ' United States ', -1, 2026, 7);
    expect(url).toContain('city=New+York');
    expect(url).toContain('country=United+States');
  });
});

describe('timeOnly', () => {
  it('strips a timezone suffix down to HH:MM', () => {
    expect(timeOnly('05:12 (EEST)')).toBe('05:12');
    expect(timeOnly('19:47 (+03)')).toBe('19:47');
  });

  it('zero-pads a single-digit hour', () => {
    expect(timeOnly('5:12')).toBe('05:12');
  });

  it('rejects out-of-range and non-string input', () => {
    expect(timeOnly('25:00')).toBeNull();
    expect(timeOnly('12:75')).toBeNull();
    expect(timeOnly('not a time')).toBeNull();
    expect(timeOnly(undefined)).toBeNull();
    expect(timeOnly(1234)).toBeNull();
  });
});

describe('gregorianToIso', () => {
  it('converts DD-MM-YYYY to YYYY-MM-DD', () => {
    expect(gregorianToIso('09-07-2026')).toBe('2026-07-09');
    expect(gregorianToIso('31-12-2026')).toBe('2026-12-31');
  });

  it('returns null for unparseable shapes', () => {
    expect(gregorianToIso('2026-07-09')).toBeNull();
    expect(gregorianToIso('9-7-2026')).toBeNull();
    expect(gregorianToIso(undefined)).toBeNull();
    expect(gregorianToIso(42)).toBeNull();
  });
});

/** A trimmed, realistic calendarByCity payload: one good day (tz suffix), one
 * malformed day (missing Isha) that must be skipped, one entry with no date. */
const cannedMonth = {
  code: 200,
  data: [
    {
      timings: {
        Fajr: '03:12 (EEST)',
        Sunrise: '05:00 (EEST)',
        Dhuhr: '12:59 (EEST)',
        Asr: '16:38 (EEST)',
        Maghrib: '19:47 (EEST)',
        Isha: '21:26 (EEST)',
      },
      date: { gregorian: { date: '09-07-2026' } },
    },
    {
      timings: {
        Fajr: '03:13 (EEST)',
        Dhuhr: '12:59 (EEST)',
        Asr: '16:38 (EEST)',
        Maghrib: '19:47 (EEST)',
        // Isha missing → whole day skipped as incomplete.
      },
      date: { gregorian: { date: '10-07-2026' } },
    },
    {
      timings: { Fajr: '03:14', Dhuhr: '12:59', Asr: '16:38', Maghrib: '19:47', Isha: '21:25' },
      // No date → skipped.
    },
  ],
};

describe('parseMonth', () => {
  it('maps complete days and skips malformed/dateless entries', () => {
    const month = parseMonth(cannedMonth);
    expect(Object.keys(month)).toEqual(['2026-07-09']);
    expect(month['2026-07-09']).toEqual({
      fajr: '03:12',
      dhuhr: '12:59',
      asr: '16:38',
      maghrib: '19:47',
      isha: '21:26',
    });
  });

  it('never throws on bad shapes, returning an empty month', () => {
    expect(parseMonth(null)).toEqual({});
    expect(parseMonth({})).toEqual({});
    expect(parseMonth({ data: 'nope' })).toEqual({});
    expect(parseMonth({ data: [null, 42, { date: {} }] })).toEqual({});
  });
});

describe('timesForDay / monthKeyOf', () => {
  it('returns the day when present, null otherwise', () => {
    const month = parseMonth(cannedMonth);
    expect(timesForDay(month, '2026-07-09')?.fajr).toBe('03:12');
    expect(timesForDay(month, '2026-07-10')).toBeNull();
  });

  it('derives the YYYY-MM month key from a date string', () => {
    expect(monthKeyOf('2026-07-09')).toBe('2026-07');
    expect(monthKeyOf('2026-12-31')).toBe('2026-12');
  });
});
