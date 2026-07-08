import { describe, expect, it } from 'vitest';
import { expandRecurrenceDates, MAX_OCCURRENCES, parseUtcDate, utcDayName } from './recurrence.js';

describe('expandRecurrenceDates', () => {
  describe("mode 'daily'", () => {
    it('generates every day from startDate to endDate inclusive', () => {
      const dates = expandRecurrenceDates(
        { mode: 'daily', startDate: '2026-03-01', endDate: '2026-03-04' },
        null,
      );
      expect(dates).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04']);
    });

    it('falls back to the base due date for missing bounds', () => {
      expect(expandRecurrenceDates({ mode: 'daily' }, '2026-05-10')).toEqual(['2026-05-10']);
      expect(expandRecurrenceDates({ mode: 'daily', endDate: '2026-05-12' }, '2026-05-10')).toEqual(
        ['2026-05-10', '2026-05-11', '2026-05-12'],
      );
    });

    it('handles a single-day range', () => {
      expect(
        expandRecurrenceDates(
          { mode: 'daily', startDate: '2026-01-01', endDate: '2026-01-01' },
          null,
        ),
      ).toEqual(['2026-01-01']);
    });

    it('yields the start date when the range is inverted (safety)', () => {
      expect(
        expandRecurrenceDates(
          { mode: 'daily', startDate: '2026-01-10', endDate: '2026-01-01' },
          null,
        ),
      ).toEqual(['2026-01-10']);
    });

    it('caps at 366 occurrences', () => {
      const dates = expandRecurrenceDates(
        { mode: 'daily', startDate: '2020-01-01', endDate: '2024-12-31' },
        null,
      );
      expect(dates).toHaveLength(MAX_OCCURRENCES);
      expect(dates[0]).toBe('2020-01-01');
      expect(dates.at(-1)).toBe('2020-12-31'); // 2020 is a leap year: 366 days
    });
  });

  describe("mode 'dateRange'", () => {
    it('produces a single occurrence at startDate', () => {
      expect(
        expandRecurrenceDates(
          { mode: 'dateRange', startDate: '2026-07-01', endDate: '2026-07-31' },
          '2026-07-15',
        ),
      ).toEqual(['2026-07-01']);
    });

    it('falls back to the due date without a startDate', () => {
      expect(
        expandRecurrenceDates({ mode: 'dateRange', endDate: '2026-07-31' }, '2026-07-15'),
      ).toEqual(['2026-07-15']);
    });
  });

  describe("mode 'specificDays'", () => {
    // 2026-01-05 is a Monday (UTC); the week runs Mon 05 .. Sun 11.
    it('selects matching UTC weekdays across a known week', () => {
      const dates = expandRecurrenceDates(
        {
          mode: 'specificDays',
          startDate: '2026-01-05',
          endDate: '2026-01-11',
          selectedDays: ['Monday', 'Thursday', 'Sunday'],
        },
        null,
      );
      expect(dates).toEqual(['2026-01-05', '2026-01-08', '2026-01-11']);
    });

    it('returns the base-date fallback when no day matches', () => {
      const dates = expandRecurrenceDates(
        {
          mode: 'specificDays',
          startDate: '2026-01-05',
          endDate: '2026-01-06',
          selectedDays: ['Sunday'],
        },
        '2026-01-05',
      );
      expect(dates).toEqual(['2026-01-05']);
    });

    it('treats missing selectedDays as no matches (fallback)', () => {
      expect(
        expandRecurrenceDates(
          { mode: 'specificDays', startDate: '2026-01-05', endDate: '2026-01-07' },
          '2026-01-05',
        ),
      ).toEqual(['2026-01-05']);
    });

    // Regression (confirmed-findings-round1 #5): an empty selectedDays array
    // over a huge range must bail to a single occurrence WITHOUT scanning the
    // range day-by-day (which blocked the event loop for seconds).
    it('empty selectedDays over an enormous range → single base occurrence, fast', () => {
      const startedAt = Date.now();
      const dates = expandRecurrenceDates(
        {
          mode: 'specificDays',
          startDate: '0001-01-01',
          endDate: '9999-12-31',
          selectedDays: [],
        },
        '2026-06-01',
      );
      expect(dates).toEqual(['2026-06-01']);
      // Deterministic bail — nowhere near the millions of iterations the bug did.
      expect(Date.now() - startedAt).toBeLessThan(100);
    });

    it('non-matching selectedDays in a 1-day range → base fallback', () => {
      // 2026-01-05 is a Monday; ask for Sunday only over just that day.
      expect(
        expandRecurrenceDates(
          {
            mode: 'specificDays',
            startDate: '2026-01-05',
            endDate: '2026-01-05',
            selectedDays: ['Sunday'],
          },
          '2026-01-05',
        ),
      ).toEqual(['2026-01-05']);
    });

    it('wide matching range is still capped at 366 occurrences', () => {
      const dates = expandRecurrenceDates(
        {
          mode: 'specificDays',
          startDate: '2020-01-01',
          endDate: '9999-12-31',
          selectedDays: ['Monday', 'Wednesday', 'Friday'],
        },
        null,
      );
      expect(dates.length).toBeLessThanOrEqual(MAX_OCCURRENCES);
      expect(dates.length).toBeGreaterThan(0);
    });
  });

  describe('legacy types', () => {
    it('daily with interval steps N days from dueDate through endDate', () => {
      expect(
        expandRecurrenceDates({ type: 'daily', interval: 3, endDate: '2026-02-10' }, '2026-02-01'),
      ).toEqual(['2026-02-01', '2026-02-04', '2026-02-07', '2026-02-10']);
    });

    it('custom behaves like daily', () => {
      expect(
        expandRecurrenceDates({ type: 'custom', interval: 2, endDate: '2026-02-05' }, '2026-02-01'),
      ).toEqual(['2026-02-01', '2026-02-03', '2026-02-05']);
    });

    it('weekly steps 7*interval days', () => {
      expect(
        expandRecurrenceDates({ type: 'weekly', interval: 2, endDate: '2026-03-31' }, '2026-03-02'),
      ).toEqual(['2026-03-02', '2026-03-16', '2026-03-30']);
    });

    it('monthly steps calendar months in UTC', () => {
      expect(
        expandRecurrenceDates({ type: 'monthly', endDate: '2026-04-15' }, '2026-01-15'),
      ).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
    });

    it('monthly month-end rolls over per JS setUTCMonth semantics', () => {
      // Jan 31 + 1 month → Feb 31 → Mar 3 (2026 is not a leap year).
      expect(
        expandRecurrenceDates({ type: 'monthly', endDate: '2026-04-30' }, '2026-01-31'),
      ).toEqual(['2026-01-31', '2026-03-03', '2026-04-03']);
    });

    it('missing interval defaults to 1 and bad intervals are clamped', () => {
      expect(expandRecurrenceDates({ type: 'daily', endDate: '2026-02-03' }, '2026-02-01')).toEqual(
        ['2026-02-01', '2026-02-02', '2026-02-03'],
      );
      expect(
        expandRecurrenceDates({ type: 'daily', interval: -5, endDate: '2026-02-02' }, '2026-02-01'),
      ).toEqual(['2026-02-01', '2026-02-02']);
    });

    it('no endDate → single occurrence at dueDate', () => {
      expect(expandRecurrenceDates({ type: 'weekly' }, '2026-06-01')).toEqual(['2026-06-01']);
    });

    it('endDate before dueDate → single occurrence at dueDate (safety)', () => {
      expect(expandRecurrenceDates({ type: 'daily', endDate: '2025-01-01' }, '2026-06-01')).toEqual(
        ['2026-06-01'],
      );
    });

    it('caps at 366 occurrences', () => {
      const dates = expandRecurrenceDates(
        { type: 'daily', interval: 1, endDate: '2030-01-01' },
        '2020-01-01',
      );
      expect(dates).toHaveLength(MAX_OCCURRENCES);
    });

    it('unknown legacy type falls back to the base date', () => {
      expect(expandRecurrenceDates({ type: 'yearly' }, '2026-06-01')).toEqual(['2026-06-01']);
    });
  });

  describe('fallbacks', () => {
    it('null/undefined/non-object recurrence → single base occurrence', () => {
      expect(expandRecurrenceDates(null, '2026-06-01')).toEqual(['2026-06-01']);
      expect(expandRecurrenceDates(undefined, '2026-06-01')).toEqual(['2026-06-01']);
      expect(expandRecurrenceDates('daily', '2026-06-01')).toEqual(['2026-06-01']);
    });

    it('unknown object shape → single base occurrence', () => {
      expect(expandRecurrenceDates({ frequency: 'often' }, '2026-06-01')).toEqual(['2026-06-01']);
      expect(expandRecurrenceDates({ mode: 'yearly' }, '2026-06-01')).toEqual(['2026-06-01']);
    });

    it('no recurrence AND no base date → [null] sentinel for the caller', () => {
      expect(expandRecurrenceDates(null, null)).toEqual([null]);
      expect(expandRecurrenceDates({ mode: 'daily' }, null)).toEqual([null]);
    });

    it('normalizes ISO datetime base dates to their UTC date part', () => {
      expect(expandRecurrenceDates(null, '2026-06-01T15:30:00+02:00')).toEqual(['2026-06-01']);
    });
  });
});

describe('parseUtcDate / utcDayName', () => {
  it('anchors date-only strings at UTC midnight', () => {
    const date = parseUtcDate('2026-01-05');
    expect(date?.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    expect(utcDayName(date as Date)).toBe('Monday');
  });

  it('returns null for junk', () => {
    expect(parseUtcDate('')).toBeNull();
    expect(parseUtcDate('not-a-date')).toBeNull();
    expect(parseUtcDate(42)).toBeNull();
    expect(parseUtcDate(null)).toBeNull();
  });
});
