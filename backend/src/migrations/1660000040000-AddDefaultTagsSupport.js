const { v4: uuidv4 } = require('uuid');

/**
 * Migration: Add default tag support + seed global default tags
 * - Ensures user_id (NVARCHAR(128) NULL) & is_default (INT NOT NULL DEFAULT 0) columns exist on tags
 * - Adds composite index on (user_id, is_default) if missing
 * - Seeds 10 global default tags (is_default=1, user_id NULL) if absent by name
 */
module.exports = class AddDefaultTagsSupport1660000040000 {
  name = 'AddDefaultTagsSupport1660000040000'

  async up(queryRunner) {
    // Ensure columns exist
    const columns = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'tags'");
    const hasUserId = columns.some(c => c.COLUMN_NAME === 'user_id');
    const hasIsDefault = columns.some(c => c.COLUMN_NAME === 'is_default');

    if (!hasUserId) {
      await queryRunner.query("ALTER TABLE tags ADD user_id NVARCHAR(128) NULL");
    }
    if (!hasIsDefault) {
      await queryRunner.query("ALTER TABLE tags ADD is_default INT NOT NULL DEFAULT 0");
    }

    // Ensure index exists (skip if already there)
    const indexes = await queryRunner.query("SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('tags')");
    const hasIndex = indexes.some(i => i.name === 'IX_tags_user_default');
    if (!hasIndex) {
      await queryRunner.query("CREATE INDEX IX_tags_user_default ON tags(user_id, is_default)");
    }

    const defaults = [
      { name: 'Work', color: '#3B82F6' },
      { name: 'Personal', color: '#10B981' },
      { name: 'Health', color: '#EF4444' },
      { name: 'Finance', color: '#F59E0B' },
      { name: 'Study', color: '#6366F1' },
      { name: 'Family', color: '#EC4899' },
      { name: 'Errands', color: '#6B7280' },
      { name: 'Ideas', color: '#8B5CF6' },
      { name: 'Important', color: '#DC2626' },
      { name: 'Misc', color: '#9CA3AF' }
    ];

    for (const def of defaults) {
      const existing = await queryRunner.query("SELECT id FROM tags WHERE name = @0 AND is_default = 1", [def.name]);
      if (!existing || existing.length === 0) {
        await queryRunner.query("INSERT INTO tags (id, name, color, is_default, user_id) VALUES (@0, @1, @2, 1, NULL)", [uuidv4(), def.name, def.color]);
      }
    }
  }

  async down(queryRunner) {
    // Down migration: remove seeded default tags (optional) & index (keep columns)
    await queryRunner.query("DELETE FROM tags WHERE is_default = 1");
    await queryRunner.query("DROP INDEX IX_tags_user_default ON tags");
    // Do not drop columns to avoid data loss
  }
}
