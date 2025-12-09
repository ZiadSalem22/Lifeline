module.exports = class FixNullTaskNumber1670000000000 {
  name = 'FixNullTaskNumber1670000000000'

  async up(queryRunner) {
    // Find users with NULL task_number rows
    const users = await queryRunner.query("SELECT DISTINCT user_id FROM todos WHERE user_id IS NOT NULL AND task_number IS NULL");
    for (const u of users) {
      const userId = u.user_id || u.USER_ID || Object.values(u)[0];
      if (!userId) continue;

      // Get current max task_number for user (if any)
      let maxRows = [];
      try { maxRows = await queryRunner.query('SELECT MAX(task_number) as maxNum FROM todos WHERE user_id = @0', [userId]); }
      catch (e) { try { maxRows = await queryRunner.query(`SELECT MAX(task_number) as maxNum FROM todos WHERE user_id = '${userId}'`); } catch (_) { maxRows = []; } }
      let max = 0;
      if (Array.isArray(maxRows) && maxRows.length > 0) {
        max = maxRows[0].maxNum || 0;
        if (max === null) max = 0;
      }

      // Determine ordering column availability
      const createdCol = await queryRunner.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='todos' AND COLUMN_NAME='created_at'");
      const hasCreated = Array.isArray(createdCol) && createdCol.length > 0;
      const orderBy = hasCreated ? 'ORDER BY created_at ASC, COALESCE(due_date, id) ASC' : 'ORDER BY COALESCE(due_date, id) ASC';

      // Select todo ids for this user that have NULL task_number
      let rows = [];
      try {
        rows = await queryRunner.query(`SELECT id FROM todos WHERE user_id = @0 AND task_number IS NULL ${orderBy}`, [userId]);
      } catch (e) {
        try { rows = await queryRunner.query(`SELECT id FROM todos WHERE user_id = '${userId}' AND task_number IS NULL ${orderBy}`); } catch (_) { rows = []; }
      }

      let idx = (parseInt(max, 10) || 0) + 1;
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
  }

  async down(queryRunner) {
    // Intentionally no-op: reverting null-fill is destructive; keep down as no-op
  }
}
