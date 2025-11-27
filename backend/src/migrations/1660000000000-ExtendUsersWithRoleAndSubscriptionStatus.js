const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class ExtendUsersWithRoleAndSubscriptionStatus1660000000000 {
  name = 'ExtendUsersWithRoleAndSubscriptionStatus1660000000000'

  async up(queryRunner) {
    await queryRunner.query(`ALTER TABLE dbo.users ADD role NVARCHAR(32) NULL;`);
    await queryRunner.query(`ALTER TABLE dbo.users ADD subscription_status NVARCHAR(32) NOT NULL DEFAULT 'none';`);
  }

  async down(queryRunner) {
    await queryRunner.query(`ALTER TABLE dbo.users DROP COLUMN subscription_status;`);
    await queryRunner.query(`ALTER TABLE dbo.users DROP COLUMN role;`);
  }
};
