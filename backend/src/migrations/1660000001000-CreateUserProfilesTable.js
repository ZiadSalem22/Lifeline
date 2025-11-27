const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class CreateUserProfilesTable1660000001000 {
  name = 'CreateUserProfilesTable1660000001000'

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE dbo.user_profiles (
        id uniqueidentifier PRIMARY KEY DEFAULT NEWID(),
        user_id nvarchar(64) NOT NULL,
        first_name nvarchar(100) NULL,
        last_name nvarchar(100) NULL,
        phone nvarchar(32) NULL,
        country nvarchar(64) NULL,
        city nvarchar(64) NULL,
        timezone nvarchar(64) NULL,
        avatar_url nvarchar(255) NULL,
        onboarding_completed bit NOT NULL DEFAULT 0,
        created_at datetime NOT NULL DEFAULT GETDATE(),
        updated_at datetime NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_user_profiles_user_id FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
      );
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE dbo.user_profiles;`);
  }
};
