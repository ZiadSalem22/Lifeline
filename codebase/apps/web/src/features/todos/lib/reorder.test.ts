import { describe, expect, it } from 'vitest';
import { makeTodo } from '../../../test/test-utils';
import { computeOrderPatches, moveById } from './reorder';

describe('moveById', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('moves the source onto the target position', () => {
    expect(moveById(items, 'c', 'a').map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(moveById(items, 'a', 'c').map((item) => item.id)).toEqual(['b', 'c', 'a']);
  });

  it('is a no-op for unknown ids or self-drops', () => {
    expect(moveById(items, 'x', 'a').map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(moveById(items, 'a', 'a').map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('computeOrderPatches', () => {
  it('emits patches ONLY for items whose stored order differs (minimal writes)', () => {
    const a = makeTodo({ id: 'a', order: 0 });
    const b = makeTodo({ id: 'b', order: 1 });
    const c = makeTodo({ id: 'c', order: 2 });
    // Drop c onto b: [a, c, b] — a keeps order 0, so no patch for it.
    const patches = computeOrderPatches(['a', 'c', 'b'], [a, b, c]);
    expect(patches).toEqual([
      { id: 'c', order: 1 },
      { id: 'b', order: 2 },
    ]);
  });

  it('emits nothing when the order already matches', () => {
    const a = makeTodo({ id: 'a', order: 0 });
    const b = makeTodo({ id: 'b', order: 1 });
    expect(computeOrderPatches(['a', 'b'], [a, b])).toEqual([]);
  });

  it('ignores ids missing from the todo set', () => {
    const a = makeTodo({ id: 'a', order: 3 });
    expect(computeOrderPatches(['ghost', 'a'], [a])).toEqual([{ id: 'a', order: 1 }]);
  });
});
