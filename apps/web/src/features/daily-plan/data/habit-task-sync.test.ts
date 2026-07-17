import { describe, expect, it } from 'vitest';
import { makeTodo } from '../../../test/test-utils';
import { habitSyncTargets, recomputeHabitMark } from './habit-task-sync';

/**
 * The recompute rule, pinned: a habit's day-✓ is EARNED if any linked task due
 * that day is completed. Order-independent, so multiple tasks feeding one
 * habit can never disagree about the outcome.
 */

const DATE = '2026-07-09';
const linked = (over: Parameters<typeof makeTodo>[0] = {}) =>
  makeTodo({ habitId: 'udemy', dueDate: DATE, ...over });

describe('recomputeHabitMark', () => {
  it('any completed linked task earns the ✓ (second task is a no-op)', () => {
    const one = [linked({ isCompleted: true }), linked({ isCompleted: false })];
    expect(recomputeHabitMark(undefined, one, 'udemy', DATE)).toBe(true);
    // Both done → still just ✓.
    const both = [linked({ isCompleted: true }), linked({ isCompleted: true })];
    expect(recomputeHabitMark(true, both, 'udemy', DATE)).toBe(true);
  });

  it('unchecking one of two keeps the ✓; unchecking the last clears it', () => {
    const oneLeft = [linked({ isCompleted: false }), linked({ isCompleted: true })];
    expect(recomputeHabitMark(true, oneLeft, 'udemy', DATE)).toBe(true);
    const noneLeft = [linked({ isCompleted: false }), linked({ isCompleted: false })];
    expect(recomputeHabitMark(true, noneLeft, 'udemy', DATE)).toBeUndefined();
  });

  it("never clears a manual 'skip' or explicit ✗ — only an earned ✓", () => {
    const none = [linked({ isCompleted: false })];
    expect(recomputeHabitMark('skip', none, 'udemy', DATE)).toBe('skip');
    expect(recomputeHabitMark(false, none, 'udemy', DATE)).toBe(false);
    expect(recomputeHabitMark(undefined, none, 'udemy', DATE)).toBeUndefined();
  });

  it('completing overrides a manual skip/✗ (doing the task IS doing the habit)', () => {
    const done = [linked({ isCompleted: true })];
    expect(recomputeHabitMark('skip', done, 'udemy', DATE)).toBe(true);
    expect(recomputeHabitMark(false, done, 'udemy', DATE)).toBe(true);
  });

  it('ignores other habits, other days, and archived tasks', () => {
    const noise = [
      linked({ isCompleted: true, habitId: 'gym' }),
      linked({ isCompleted: true, dueDate: '2026-07-10' }),
      linked({ isCompleted: true, archived: true }),
    ];
    expect(recomputeHabitMark(true, noise, 'udemy', DATE)).toBeUndefined();
  });
});

describe('habitSyncTargets', () => {
  it('collects (habit, day) pairs from linked+dated todos, deduped', () => {
    const a = linked();
    const b = linked(); // same pair as a
    const moved = linked({ dueDate: '2026-07-10' });
    const unlinked = makeTodo({ dueDate: DATE });
    const dateless = makeTodo({ habitId: 'udemy', dueDate: null });
    expect(habitSyncTargets(a, b, moved, unlinked, dateless, undefined)).toEqual([
      { habitId: 'udemy', date: DATE },
      { habitId: 'udemy', date: '2026-07-10' },
    ]);
  });
});
