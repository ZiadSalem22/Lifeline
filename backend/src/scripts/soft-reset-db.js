#!/usr/bin/env node
// Soft reset: delete application data while preserving schema and migration history.
// Safety: requires FORCE_DB_RESET=1 environment variable.
const path = require('path');
const envFile = process.env.NODE_ENV === 'development' ? '.env.local' : '.env';
require('dotenv').config({ path: path.join(process.cwd(), envFile) });

const { AppDataSource } = require('../infra/db/data-source');

async function main() {
  if (process.env.FORCE_DB_RESET !== '1') {
    console.error('Refusing to run soft reset: set FORCE_DB_RESET=1 to confirm');
    process.exit(2);
  }

  try {
    console.log('[soft-reset-db] Initializing TypeORM DataSource...');
    await AppDataSource.initialize();
    console.log('[soft-reset-db] DataSource initialized. Beginning soft wipe...');

    // Run deletes in a transaction in FK-safe order
    await AppDataSource.manager.transaction(async (manager) => {
      console.log('[soft-reset-db] Truncating app tables...');
      await manager.query('TRUNCATE TABLE todo_tags, todos, user_profiles, user_settings, users RESTART IDENTITY CASCADE');
      console.log('[soft-reset-db] Removing custom tags while preserving seeded defaults...');
      await manager.query('DELETE FROM tags WHERE is_default = false');
    });

    console.log('[soft-reset-db] Soft wipe complete. Application data removed.');
  } catch (err) {
    console.error('[soft-reset-db] Failed:', err && err.stack ? err.stack : err);
    process.exit(1);
  } finally {
    try { await AppDataSource.destroy(); } catch (_) {}
  }

  process.exit(0);
}

main();
