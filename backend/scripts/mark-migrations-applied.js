require('dotenv').config();
const { AppMigrationsDataSource } = require('../data-source-migrations');

async function main() {
  await AppMigrationsDataSource.initialize();

  // Legacy migrations to mark as applied (must match exact names)
  const legacyMigrations = [
    'ExtendUsersWithRoleAndSubscriptionStatus1660000000000',
    'CreateUserProfilesTable1660000001000',
    'UpdateTodoSchemaAndAddArchived1660000020000',
    'AddUserIdToTodosAndTags1660000030000',
    'AddDefaultTagsSupport1660000040000',
    'CreateUserSettingsTable1690880000000',
  ];

  const queryRunner = AppMigrationsDataSource.createQueryRunner();
  try {
    await queryRunner.startTransaction();

    for (const name of legacyMigrations) {
      // Use current time for timestamp, TypeORM expects bigint
      const ts = Date.now();
      await queryRunner.query(
        'INSERT INTO "migrations" ("timestamp", "name") VALUES (@0, @1)',
        [ts, name]
      );
      console.log(`Marked applied: ${name}`);
      // small delay to make timestamps unique
      await new Promise(r => setTimeout(r, 4));
    }

    await queryRunner.commitTransaction();
    console.log('All legacy migrations marked as applied.');
  } catch (err) {
    console.error('Failed to mark migrations:', err);
    try { await queryRunner.rollbackTransaction(); } catch {}
    process.exit(1);
  } finally {
    try { await queryRunner.release(); } catch {}
    try { await AppMigrationsDataSource.destroy(); } catch {}
  }
}

main();
