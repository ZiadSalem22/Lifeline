module.exports = class AddUserIdToTodosAndTags1660000030000 {
  name = 'AddUserIdToTodosAndTags1660000030000'

  async up(queryRunner) {
    // Add user_id to todos if missing
    const todosUserCol = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='todos' AND COLUMN_NAME='user_id'");
    if (!Array.isArray(todosUserCol) || todosUserCol.length === 0) {
      await queryRunner.query("ALTER TABLE todos ADD user_id NVARCHAR(128) NOT NULL DEFAULT ''");
    }
    // Add user_id & is_default to tags if missing
    const tagsUserCol = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tags' AND COLUMN_NAME='user_id'");
    if (!Array.isArray(tagsUserCol) || tagsUserCol.length === 0) {
      await queryRunner.query("ALTER TABLE tags ADD user_id NVARCHAR(128) NULL");
    }
    const tagsDefaultCol = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tags' AND COLUMN_NAME='is_default'");
    if (!Array.isArray(tagsDefaultCol) || tagsDefaultCol.length === 0) {
      await queryRunner.query("ALTER TABLE tags ADD is_default INT NOT NULL DEFAULT 0");
    }
  }

  async down(queryRunner) {
    // Safe down: drop columns if exist
    const todosUserCol = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='todos' AND COLUMN_NAME='user_id'");
    if (Array.isArray(todosUserCol) && todosUserCol.length > 0) {
      await queryRunner.query("ALTER TABLE todos DROP COLUMN user_id");
    }
    const tagsUserCol = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tags' AND COLUMN_NAME='user_id'");
    if (Array.isArray(tagsUserCol) && tagsUserCol.length > 0) {
      await queryRunner.query("ALTER TABLE tags DROP COLUMN user_id");
    }
    const tagsDefaultCol = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tags' AND COLUMN_NAME='is_default'");
    if (Array.isArray(tagsDefaultCol) && tagsDefaultCol.length > 0) {
      await queryRunner.query("ALTER TABLE tags DROP COLUMN is_default");
    }
  }
}
