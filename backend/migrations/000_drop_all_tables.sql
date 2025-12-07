-- Drop all Lifeline tables safely if they exist (SQL Server)
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.todo_tags','U') IS NOT NULL DROP TABLE dbo.todo_tags;
IF OBJECT_ID('dbo.todos','U') IS NOT NULL DROP TABLE dbo.todos;
IF OBJECT_ID('dbo.tags','U') IS NOT NULL DROP TABLE dbo.tags;
IF OBJECT_ID('dbo.user_settings','U') IS NOT NULL DROP TABLE dbo.user_settings;
IF OBJECT_ID('dbo.user_profiles','U') IS NOT NULL DROP TABLE dbo.user_profiles;
IF OBJECT_ID('dbo.users','U') IS NOT NULL DROP TABLE dbo.users;

COMMIT TRANSACTION;
PRINT 'Dropped tables if they existed.';
