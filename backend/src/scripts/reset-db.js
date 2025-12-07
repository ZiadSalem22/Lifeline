#!/usr/bin/env node
// Reset the database by dropping all tables and re-applying migrations.
// Safety: requires FORCE_DB_RESET=1 in env to run.
const path = require('path');
const envFile = process.env.NODE_ENV === 'development' ? '.env.local' : '.env';
require('dotenv').config({ path: path.join(process.cwd(), envFile) });

const { AppDataSource } = require('../infra/db/data-source');

async function main() {
  if (process.env.FORCE_DB_RESET !== '1') {
    console.error('Refusing to reset DB: set FORCE_DB_RESET=1 to confirm');
    process.exit(2);
  }

  try {
    console.log('[reset-db] Initializing TypeORM DataSource...');
    await AppDataSource.initialize();
    console.log('[reset-db] DataSource initialized. Dropping database...');

    // Drop the database (drops all tables). This removes ALL data.
    await AppDataSource.dropDatabase();
    console.log('[reset-db] Database dropped. Running migrations...');

    // Recreate schema from migrations
    await AppDataSource.runMigrations();
    console.log('[reset-db] Migrations applied. DB reset complete.');
  } catch (err) {
    console.error('[reset-db] Failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  } finally {
    try { await AppDataSource.destroy(); } catch (_) {}
  }
  process.exit(0);
}

main();
