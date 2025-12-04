const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class AddUsersTable1659999999000 {
  name = 'AddUsersTable1659999999000'

  async up(queryRunner) {
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.users', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.users (
          id NVARCHAR(64) NOT NULL,
          email NVARCHAR(255) NOT NULL,
          name NVARCHAR(255) NULL,
          picture NVARCHAR(512) NULL,
          created_at DATETIME NOT NULL CONSTRAINT DF_users_created_at DEFAULT (GETDATE()),
          updated_at DATETIME NOT NULL CONSTRAINT DF_users_updated_at DEFAULT (GETDATE()),
          CONSTRAINT PK_users PRIMARY KEY CLUSTERED (id)
        );
      END
    `);
    await queryRunner.query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes WHERE name = 'UQ_users_email' AND object_id = OBJECT_ID('dbo.users')
      )
      BEGIN
        CREATE UNIQUE INDEX UQ_users_email ON dbo.users(email);
      END
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.users', N'U') IS NOT NULL
      BEGIN
        DROP TABLE dbo.users;
      END
    `);
  }
}
