import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPool, type PoolErrorLogger } from './client.js';

/**
 * Regression (confirmed-findings-round1 #6): the pool had no `error` listener,
 * so an idle-client error (Postgres restart / dropped TCP connection) became
 * an uncaught exception and crashed the process. createPool now attaches one.
 */
describe('createPool — idle-client error handling', () => {
  const pools: Array<{ end: () => Promise<void> }> = [];

  afterEach(async () => {
    // The pool never actually connects here, so end() resolves immediately.
    await Promise.all(pools.splice(0).map((pool) => pool.end().catch(() => undefined)));
  });

  it('logs an emitted idle error instead of throwing', () => {
    const logged: unknown[] = [];
    const logger: PoolErrorLogger = {
      error: (obj) => {
        logged.push(obj);
      },
    };
    // A syntactically valid URL — the pool is lazy, no connection is opened.
    const pool = createPool('postgres://user:pass@127.0.0.1:1/db', logger);
    pools.push(pool);

    const boom = new Error('idle client exploded');
    // With a listener present, emit returns true and does NOT throw.
    expect(() => pool.emit('error', boom)).not.toThrow();
    expect(pool.emit('error', boom)).toBe(true);

    expect(logged).toContainEqual({ err: boom });
  });

  it('does not throw when constructed without a logger', () => {
    const pool = createPool('postgres://user:pass@127.0.0.1:1/db');
    pools.push(pool);
    expect(() => pool.emit('error', new Error('no logger'))).not.toThrow();
  });

  it('passes structured error context to logger.error', () => {
    const error = vi.fn();
    const pool = createPool('postgres://user:pass@127.0.0.1:1/db', { error });
    pools.push(pool);
    const boom = new Error('blip');
    pool.emit('error', boom);
    expect(error).toHaveBeenCalledWith({ err: boom }, 'Idle pg client error');
  });
});
