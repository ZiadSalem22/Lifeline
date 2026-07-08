import { describe, expect, it } from 'vitest';
import { listTodosQuerySchema, queryBooleanSchema } from './todo.js';

/**
 * Regression: `flagged`/`includeArchived` used `z.coerce.boolean()`, which is
 * `Boolean(input)` in zod 4 — so the query strings 'false' and '0' coerced to
 * `true` and inverted the filter (confirmed-findings-round1 #2). They now use
 * `queryBooleanSchema`, a strict string-boolean.
 */
describe('queryBooleanSchema (strict query-string boolean)', () => {
  it("'true' and '1' → true", () => {
    expect(queryBooleanSchema.parse('true')).toBe(true);
    expect(queryBooleanSchema.parse('1')).toBe(true);
  });

  it("'false' and '0' → false (NOT true — the fixed defect)", () => {
    expect(queryBooleanSchema.parse('false')).toBe(false);
    expect(queryBooleanSchema.parse('0')).toBe(false);
  });

  it('native booleans pass through (what the web client sends)', () => {
    expect(queryBooleanSchema.parse(true)).toBe(true);
    expect(queryBooleanSchema.parse(false)).toBe(false);
  });

  it('empty string and absent → undefined', () => {
    expect(queryBooleanSchema.parse('')).toBeUndefined();
    expect(queryBooleanSchema.parse(undefined)).toBeUndefined();
  });

  it('anything else is rejected', () => {
    expect(() => queryBooleanSchema.parse('yes')).toThrow();
    expect(() => queryBooleanSchema.parse('nope')).toThrow();
    expect(() => queryBooleanSchema.parse('2')).toThrow();
    expect(() => queryBooleanSchema.parse('TRUE')).toThrow();
  });
});

describe('listTodosQuerySchema — flagged / includeArchived coercion', () => {
  it("flagged='false' parses to false, not true", () => {
    expect(listTodosQuerySchema.parse({ flagged: 'false' }).flagged).toBe(false);
    expect(listTodosQuerySchema.parse({ flagged: '0' }).flagged).toBe(false);
  });

  it("flagged='true'/'1' → true", () => {
    expect(listTodosQuerySchema.parse({ flagged: 'true' }).flagged).toBe(true);
    expect(listTodosQuerySchema.parse({ flagged: '1' }).flagged).toBe(true);
  });

  it("includeArchived='false' → false", () => {
    expect(listTodosQuerySchema.parse({ includeArchived: 'false' }).includeArchived).toBe(false);
    expect(listTodosQuerySchema.parse({ includeArchived: '0' }).includeArchived).toBe(false);
  });

  it('absent flagged/includeArchived stays undefined', () => {
    const parsed = listTodosQuerySchema.parse({});
    expect(parsed.flagged).toBeUndefined();
    expect(parsed.includeArchived).toBeUndefined();
  });

  it('invalid boolean string is a validation error', () => {
    expect(() => listTodosQuerySchema.parse({ flagged: 'maybe' })).toThrow();
  });
});
