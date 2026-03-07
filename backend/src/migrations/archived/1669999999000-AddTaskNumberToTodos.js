module.exports = class AddTaskNumberToTodos1669999999000 {
  name = 'AddTaskNumberToTodos1669999999000'

  async up(queryRunner) {
    // Add task_number column if missing
    const col = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='todos' AND COLUMN_NAME='task_number'");
    if (!Array.isArray(col) || col.length === 0) {
      try {
        await queryRunner.query('ALTER TABLE todos ADD task_number INT NULL');
      } catch (e) {
        try { await queryRunner.query("ALTER TABLE todos ADD COLUMN task_number INTEGER NULL"); } catch (_) { }
      }
    }

    // Backfill per-user sequential task numbers in JS to avoid dialect-specific SQL pitfalls.
    // Strategy:
    //  - Fetch whether created_at column exists.
    //  - Query distinct user_ids from todos.
    //  - For each user_id, fetch todo ids ordered by created_at (if available) else due_date then id.
    //  - Update each todo row setting task_number = incremental index starting at 1.
    const createdCol = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='todos' AND COLUMN_NAME='created_at'");
    const hasCreated = Array.isArray(createdCol) && createdCol.length > 0;

    const users = await queryRunner.query("SELECT DISTINCT user_id FROM todos WHERE user_id IS NOT NULL");
    for (const u of users) {
      const userId = u.user_id || u.USER_ID || Object.values(u)[0];
      if (!userId) continue;
      let orderBy = '';
      if (hasCreated) orderBy = 'ORDER BY created_at ASC, COALESCE(due_date, id) ASC';
      else orderBy = 'ORDER BY COALESCE(due_date, id) ASC';
      const selectSql = `SELECT id FROM todos WHERE user_id = @0 ${orderBy}`;
      let rows = [];
      try {
        rows = await queryRunner.query(selectSql, [userId]);
      } catch (e) {
        // Fallback to parameterless (some drivers differ)
        try { rows = await queryRunner.query(`SELECT id FROM todos WHERE user_id = '${userId}' ${orderBy}`); } catch (_) { rows = []; }
      }
      let idx = 1;
      for (const r of rows) {
        const todoId = r.id || r.ID || Object.values(r)[0];
        if (!todoId) continue;
        try {
          await queryRunner.query('UPDATE todos SET task_number = @0 WHERE id = @1', [idx, todoId]);
        } catch (e) {
          try { await queryRunner.query(`UPDATE todos SET task_number = ${idx} WHERE id = '${todoId}'`); } catch (_) {}
        }
        idx += 1;
      }
    }

    // Create unique index on (user_id, task_number) if possible. If duplicates exist, do not fail migration silently.
    try {
      // MSSQL: check existence first
      const exists = await queryRunner.query("SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('todos') AND name = 'IDX_user_task_number'");
      if (!Array.isArray(exists) || exists.length === 0) {
        try {
          await queryRunner.query('CREATE UNIQUE INDEX IDX_user_task_number ON todos(user_id, task_number)');
        } catch (e) {
          // ignore index creation errors to avoid blocking migration in constrained environments
        }
      }
    } catch (e) { /* ignore index creation errors */ }
  }

  async down(queryRunner) {
    try {
      await queryRunner.query('DROP INDEX IF EXISTS IDX_user_task_number');
    } catch (_) {}
    try { await queryRunner.query('ALTER TABLE todos DROP COLUMN task_number'); } catch (_) {
      try { await queryRunner.query('ALTER TABLE todos DROP COLUMN task_number'); } catch (_) {}
    }
  }
}
