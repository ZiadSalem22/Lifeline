module.exports = class CreateTodosAndTagsTables1659999999100 {
  name = 'CreateTodosAndTagsTables1659999999100'

  async up(queryRunner) {
    // Create todos table if missing
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.todos', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.todos (
          id NVARCHAR(64) NOT NULL,
          title NVARCHAR(200) NOT NULL,
          description NVARCHAR(2000) NULL,
          due_date DATETIME NULL,
          priority NVARCHAR(16) NULL,
          due_time NVARCHAR(16) NULL,
          subtasks NVARCHAR(MAX) NULL,
          recurrence NVARCHAR(MAX) NULL,
          next_recurrence_due DATETIME NULL,
          original_id NVARCHAR(64) NULL,
          completed BIT NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME NOT NULL DEFAULT GETDATE(),
          CONSTRAINT PK_todos PRIMARY KEY CLUSTERED (id)
        );
      END
    `);

    // Create tags table if missing
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.tags', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.tags (
          id NVARCHAR(64) NOT NULL,
          name NVARCHAR(200) NOT NULL,
          color NVARCHAR(16) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME NOT NULL DEFAULT GETDATE(),
          CONSTRAINT PK_tags PRIMARY KEY CLUSTERED (id)
        );
      END
    `);

    // Create join table if missing
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.todo_tags', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.todo_tags (
          todo_id NVARCHAR(64) NOT NULL,
          tag_id NVARCHAR(64) NOT NULL,
          CONSTRAINT PK_todo_tags PRIMARY KEY CLUSTERED (todo_id, tag_id)
        );
        ALTER TABLE dbo.todo_tags
          WITH CHECK ADD CONSTRAINT FK_todo_tags_todo_id FOREIGN KEY(todo_id) REFERENCES dbo.todos(id) ON DELETE CASCADE;
        ALTER TABLE dbo.todo_tags
          WITH CHECK ADD CONSTRAINT FK_todo_tags_tag_id FOREIGN KEY(tag_id) REFERENCES dbo.tags(id) ON DELETE CASCADE;
      END
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.todo_tags', N'U') IS NOT NULL
      BEGIN
        DROP TABLE dbo.todo_tags;
      END
    `);
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.tags', N'U') IS NOT NULL
      BEGIN
        DROP TABLE dbo.tags;
      END
    `);
    await queryRunner.query(`
      IF OBJECT_ID(N'dbo.todos', N'U') IS NOT NULL
      BEGIN
        DROP TABLE dbo.todos;
      END
    `);
  }
}
