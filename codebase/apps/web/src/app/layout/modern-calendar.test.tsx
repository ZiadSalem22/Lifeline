import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ModernCalendar } from './ModernCalendar';
import { resolveWeekStart, weekStartsOnIndex } from './day-utils';
import { makeMe, makeProfile, makeSettings } from '../../test/test-utils';

function headerLetters(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.weekDay')).map((el) => el.textContent ?? '');
}

describe('ModernCalendar week start', () => {
  beforeEach(() => {
    // July 2026: the 1st is a Wednesday.
    vi.useFakeTimers({ now: new Date('2026-07-06T12:00:00') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('puts Monday in the first column when weekStartsOn=1', () => {
    const { container } = render(
      <ModernCalendar selectedDate="today" onSelectDate={() => {}} weekStartsOn={1} />,
    );
    expect(headerLetters(container)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    // Wednesday July 1 → two leading blanks after Monday/Tuesday.
    expect(container.querySelectorAll('.empty')).toHaveLength(2);
  });

  it('puts Sunday in the first column when weekStartsOn=0', () => {
    const { container } = render(
      <ModernCalendar selectedDate="today" onSelectDate={() => {}} weekStartsOn={0} />,
    );
    expect(headerLetters(container)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
    expect(container.querySelectorAll('.empty')).toHaveLength(3);
  });
});

describe('resolveWeekStart', () => {
  it('prefers profile.startDayOfWeek', () => {
    const me = makeMe({
      profile: makeProfile({ startDayOfWeek: 'Saturday' }),
      settings: makeSettings({ layout: { weekStart: 'sunday' } }),
    });
    expect(resolveWeekStart(me)).toBe('Saturday');
    expect(weekStartsOnIndex('Saturday')).toBe(6);
  });

  it('falls back to settings.layout.weekStart (case-insensitive)', () => {
    const me = makeMe({
      profile: null,
      settings: makeSettings({ layout: { weekStart: 'sunday' } }),
    });
    expect(resolveWeekStart(me)).toBe('Sunday');
    expect(weekStartsOnIndex('Sunday')).toBe(0);
  });

  it('defaults to Monday (fix vs the old hardcoded Sunday)', () => {
    expect(resolveWeekStart(null)).toBe('Monday');
    expect(resolveWeekStart(makeMe({ profile: null, settings: null }))).toBe('Monday');
    expect(weekStartsOnIndex('Monday')).toBe(1);
  });
});
