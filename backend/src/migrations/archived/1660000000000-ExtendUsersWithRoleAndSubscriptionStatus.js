const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class ExtendUsersWithRoleAndSubscriptionStatus1660000000000 {
  name = 'ExtendUsersWithRoleAndSubscriptionStatus1660000000000'

  async up(queryRunner) {
    // Make migration idempotent: only add columns if they do not already exist
    await queryRunner.query(`
      IF COL_LENGTH('dbo.users','role') IS NULL
      BEGIN
        ALTER TABLE dbo.users ADD role NVARCHAR(32) NULL;
      END
    `);
    await queryRunner.query(`
      IF COL_LENGTH('dbo.users','subscription_status') IS NULL
      BEGIN
        ALTER TABLE dbo.users ADD subscription_status NVARCHAR(32) NOT NULL DEFAULT 'none';
      END
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      IF COL_LENGTH('dbo.users','subscription_status') IS NOT NULL
      BEGIN
        ALTER TABLE dbo.users DROP COLUMN subscription_status;
      END
    `);
    await queryRunner.query(`
      IF COL_LENGTH('dbo.users','role') IS NOT NULL
      BEGIN
        ALTER TABLE dbo.users DROP COLUMN role;
      END
    `);
  }
};
