module.exports = class UpdateTodoSchemaAndAddArchived1660000020000 {
  name = 'UpdateTodoSchemaAndAddArchived1660000020000'

  async up(queryRunner) {
    // Adjust column types/lengths and add archived column
    // 1) Safely widen todos.id to NVARCHAR(64) if needed, handling PK/FK dependencies
    const idCol = await queryRunner.query("SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='todos' AND COLUMN_NAME='id'");
    const dataType = idCol && idCol[0] ? (idCol[0].DATA_TYPE || '').toLowerCase() : null;
    const maxLen = idCol && idCol[0] ? (idCol[0].CHARACTER_MAXIMUM_LENGTH) : null;
    const needsAlter = !(dataType === 'nvarchar' && (maxLen === 64 || maxLen === -1)) && !(dataType === 'varchar' && (maxLen === 64));

    if (needsAlter) {
      // Collect FKs referencing todos(id)
      const fks = await queryRunner.query(`
        SELECT 
          pt.name AS parent_table,
          pc.name AS parent_column,
          fk.name AS fk_name
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        JOIN sys.tables pt ON pt.object_id = fkc.parent_object_id
        JOIN sys.columns pc ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
        JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
        JOIN sys.columns rc ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
        WHERE rt.name = 'todos' AND rc.name = 'id'
      `);

      // Drop FKs
      for (const row of fks) {
        await queryRunner.query(`ALTER TABLE ${row.parent_table} DROP CONSTRAINT ${row.fk_name}`);
      }

      // Drop PK on todos if exists
      const pkRows = await queryRunner.query("SELECT kc.name AS pk_name FROM sys.key_constraints kc JOIN sys.tables t ON kc.parent_object_id = t.object_id WHERE kc.type='PK' AND t.name='todos'");
      if (pkRows && pkRows[0] && pkRows[0].pk_name) {
        await queryRunner.query(`ALTER TABLE todos DROP CONSTRAINT ${pkRows[0].pk_name}`);
      }

      // Alter column
      await queryRunner.query("ALTER TABLE todos ALTER COLUMN id NVARCHAR(64) NOT NULL");

      // Recreate PK if it was dropped
      const hasNewPk = await queryRunner.query("SELECT kc.name AS pk_name FROM sys.key_constraints kc JOIN sys.tables t ON kc.parent_object_id = t.object_id WHERE kc.type='PK' AND t.name='todos'");
      if (!hasNewPk || hasNewPk.length === 0) {
        await queryRunner.query("ALTER TABLE todos ADD CONSTRAINT PK_todos PRIMARY KEY (id)");
      }

      // Ensure parent columns match NVARCHAR(64) then recreate FKs
      for (const row of fks) {
        const fkName = row.fk_name || `FK_${row.parent_table}_todos_id`;
        // widen parent column if necessary
        await queryRunner.query(`ALTER TABLE ${row.parent_table} ALTER COLUMN ${row.parent_column} NVARCHAR(64) NOT NULL`);
        await queryRunner.query(`ALTER TABLE ${row.parent_table} WITH CHECK ADD CONSTRAINT ${fkName} FOREIGN KEY(${row.parent_column}) REFERENCES todos(id)`);
      }
    }

    // Other columns (id already handled above)
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
