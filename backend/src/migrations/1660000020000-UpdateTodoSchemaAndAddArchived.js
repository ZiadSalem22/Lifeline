module.exports = class UpdateTodoSchemaAndAddArchived1660000020000 {
  name = 'UpdateTodoSchemaAndAddArchived1660000020000'

  async up(queryRunner) {
    // Adjust column types/lengths and add archived column
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN id VARCHAR(64) NOT NULL");
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN title NVARCHAR(200) NOT NULL");
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN description NVARCHAR(2000) NULL");
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN due_date DATETIME NULL");
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN priority NVARCHAR(16) NULL");
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN due_time NVARCHAR(16) NULL");
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN subtasks NVARCHAR(MAX) NULL");
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN recurrence NVARCHAR(MAX) NULL");
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN next_recurrence_due DATETIME NULL");
    await queryRunner.query("ALTER TABLE todos ALTER COLUMN original_id NVARCHAR(64) NULL");

    const columns = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='todos' AND COLUMN_NAME='archived'");
    if (!Array.isArray(columns) || columns.length === 0) {
      await queryRunner.query("ALTER TABLE todos ADD archived INT NOT NULL DEFAULT 0");
    }
  }

  async down(queryRunner) {
    // Revert archived column (keep safer approach for other columns)
    const columns = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='todos' AND COLUMN_NAME='archived'");
    if (Array.isArray(columns) && columns.length > 0) {
      await queryRunner.query("ALTER TABLE todos DROP COLUMN archived");
    }
    // Note: not reverting the type changes to avoid data loss risk
  }
}
