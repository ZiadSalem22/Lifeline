import { describe, expect, it } from 'vitest';
import { ConflictError, ForbiddenError } from './errors.js';
import {
  ARCHIVED_TASK_MESSAGE,
  assertActiveTodoCapacity,
  assertCustomTagCapacity,
  canMutate,
} from './todo-rules.js';

describe('canMutate', () => {
  it('throws 409 ConflictError with the canonical message for archived todos', () => {
    expect(() => canMutate({ archived: true })).toThrowError(ConflictError);
    try {
      canMutate({ archived: true });
    } catch (error) {
      expect((error as ConflictError).status).toBe(409);
      expect((error as ConflictError).code).toBe('conflict');
      expect((error as ConflictError).detail).toBe(ARCHIVED_TASK_MESSAGE);
    }
  });

  it('allows mutation of active todos', () => {
    expect(() => canMutate({ archived: false })).not.toThrow();
  });
});

describe('assertActiveTodoCapacity', () => {
  it('blocks free users at 200 active todos', () => {
    expect(() => assertActiveTodoCapacity('free', 200)).toThrow(ForbiddenError);
    expect(() => assertActiveTodoCapacity('free', 199)).not.toThrow();
  });

  it('accounts for multi-row recurrence expansion', () => {
    expect(() => assertActiveTodoCapacity('free', 195, 6)).toThrow(ForbiddenError);
    expect(() => assertActiveTodoCapacity('free', 195, 5)).not.toThrow();
  });

  it('never limits paid or admin users', () => {
    expect(() => assertActiveTodoCapacity('paid', 10_000)).not.toThrow();
    expect(() => assertActiveTodoCapacity('admin', 10_000)).not.toThrow();
  });
});

describe('assertCustomTagCapacity', () => {
  it('blocks free users at 50 custom tags', () => {
    expect(() => assertCustomTagCapacity('free', 50)).toThrow(ForbiddenError);
    expect(() => assertCustomTagCapacity('free', 49)).not.toThrow();
  });

  it('never limits paid or admin users', () => {
    expect(() => assertCustomTagCapacity('paid', 500)).not.toThrow();
    expect(() => assertCustomTagCapacity('admin', 500)).not.toThrow();
  });
});
