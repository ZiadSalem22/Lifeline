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
      console.log('[soft-reset-db] Deleting todo_tags...');
      await manager.query('DELETE FROM todo_tags');

      console.log('[soft-reset-db] Deleting todos...');
      await manager.query('DELETE FROM todos');

      console.log('[soft-reset-db] Deleting non-default tags...');
      // Keep default tags (is_default=1). Delete user-created tags.
      // Some older rows might use is_default as 0/1 or NULL; handle NULL as non-default.
      await manager.query("DELETE FROM tags WHERE is_default IS NULL OR is_default = 0");

      console.log('[soft-reset-db] Deleting user profiles...');
      await manager.query('DELETE FROM user_profiles');

      console.log('[soft-reset-db] Deleting user settings...');
      await manager.query('DELETE FROM user_settings');

      console.log('[soft-reset-db] Deleting users...');
      await manager.query('DELETE FROM users');

      console.log('[soft-reset-db] Final cleanup of todo_tags (in case of orphaned references)...');
      await manager.query('DELETE FROM todo_tags');
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
