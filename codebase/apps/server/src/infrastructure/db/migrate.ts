import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadEnv } from '../../config/env.js';
import { createLogger } from '../../config/logger.js';
import { createDb, createPool } from './client.js';

/**
 * Migration runner (`npm run db:migrate`). Applies `migrations/*.sql` in
 * journal order via drizzle's node-postgres migrator. Safe to run repeatedly:
 * applied entries are tracked in drizzle.__drizzle_migrations, and the
 * baseline itself is IF-NOT-EXISTS idempotent (see 0000_baseline.sql header
 * for the live-DB adoption rationale).
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const pool = createPool(databaseUrl);
  const db = createDb(pool);
  const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const env = loadEnv();
  const logger = createLogger(env);
  runMigrations(env.DATABASE_URL)
    .then(() => {
      logger.info('Database migrations applied');
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, 'Database migration failed');
      process.exitCode = 1;
    });
}
