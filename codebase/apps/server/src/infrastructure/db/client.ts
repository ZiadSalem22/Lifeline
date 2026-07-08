import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;

/** Minimal logger surface the pool needs — satisfied by the pino Logger. */
export interface PoolErrorLogger {
  error(obj: unknown, msg?: string): void;
}

/**
 * Create the pg pool with an `error` listener attached. node-postgres emits
 * `'error'` on the Pool when an IDLE pooled client fails (e.g. Postgres
 * restarts or a TCP connection drops). With no listener that becomes an
 * uncaught exception and crashes the whole API process; logging it keeps the
 * server alive so in-flight requests survive a backend blip.
 */
export function createPool(databaseUrl: string, logger?: PoolErrorLogger): pg.Pool {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  pool.on('error', (err) => {
    logger?.error({ err }, 'Idle pg client error');
  });
  return pool;
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { schema });
}
