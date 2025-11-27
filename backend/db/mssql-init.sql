/*
Run this script in SSMS, Azure Data Studio, or sqlcmd to provision the MSSQL schema.
After running, set MSSQL_URL=Server=(localdb)\MSSQLLocalDB;Database=LifelineTodos;Trusted_Connection=True; in your .env.
*/

IF DB_ID('LifelineTodos') IS NULL
    CREATE DATABASE LifelineTodos;
GO

USE LifelineTodos;
GO

-- Optional: drop tables for repeatable local setup.
IF OBJECT_ID('dbo.todo_tags', 'U') IS NOT NULL DROP TABLE dbo.todo_tags;
IF OBJECT_ID('dbo.tags', 'U') IS NOT NULL DROP TABLE dbo.tags;
IF OBJECT_ID('dbo.todos', 'U') IS NOT NULL DROP TABLE dbo.todos;
GO

CREATE TABLE dbo.todos (
    id NVARCHAR(255) NOT NULL PRIMARY KEY,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    due_date NVARCHAR(64) NULL,
    is_completed INT NOT NULL DEFAULT (0),
    is_flagged INT NOT NULL DEFAULT (0),
    duration INT NOT NULL DEFAULT (0),
    priority NVARCHAR(32) NOT NULL DEFAULT ('medium'),
    due_time NVARCHAR(32) NULL,
    subtasks NVARCHAR(MAX) NOT NULL DEFAULT ('[]'),
    [order] INT NOT NULL DEFAULT (0),
    recurrence NVARCHAR(MAX) NULL,
    next_recurrence_due NVARCHAR(64) NULL,
    original_id NVARCHAR(255) NULL
);
GO

CREATE TABLE dbo.tags (
    id NVARCHAR(255) NOT NULL PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    color NVARCHAR(255) NOT NULL
);
GO

CREATE TABLE dbo.todo_tags (
    todo_id NVARCHAR(255) NOT NULL,
    tag_id NVARCHAR(255) NOT NULL,
    CONSTRAINT PK_todo_tags PRIMARY KEY (todo_id, tag_id),
    CONSTRAINT FK_todo_tags_todo FOREIGN KEY (todo_id) REFERENCES dbo.todos (id),
    CONSTRAINT FK_todo_tags_tag FOREIGN KEY (tag_id) REFERENCES dbo.tags (id)
);
GO
