-- Initial migration: create all tables for Lifeline

CREATE TABLE dbo.users (
    id NVARCHAR(64) NOT NULL PRIMARY KEY,
    email NVARCHAR(255) NULL UNIQUE,
    name NVARCHAR(255) NULL,
    picture NVARCHAR(512) NULL,
    created_at DATETIME NOT NULL DEFAULT (GETDATE()),
    updated_at DATETIME NOT NULL DEFAULT (GETDATE()),
    role NVARCHAR(32) NULL DEFAULT NULL,
    subscription_status NVARCHAR(32) NOT NULL DEFAULT ('none'),
    auth0_sub NVARCHAR(128) NOT NULL UNIQUE
);

CREATE TABLE dbo.user_profiles (
    id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id NVARCHAR(64) NOT NULL,
    first_name NVARCHAR(100) NULL,
    last_name NVARCHAR(100) NULL,
    phone NVARCHAR(32) NULL,
    country NVARCHAR(64) NULL,
    city NVARCHAR(64) NULL,
    timezone NVARCHAR(64) NULL,
    avatar_url NVARCHAR(255) NULL,
    onboarding_completed BIT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (GETDATE()),
    updated_at DATETIME NOT NULL DEFAULT (GETDATE()),
    CONSTRAINT FK_user_profiles_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
);

CREATE TABLE dbo.todos (
    id NVARCHAR(64) NOT NULL PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(2000) NULL,
    due_date DATETIME NULL,
    is_completed INT NOT NULL DEFAULT 0,
    is_flagged INT NOT NULL DEFAULT 0,
    duration INT NOT NULL DEFAULT 0,
    priority NVARCHAR(16) NOT NULL DEFAULT 'medium',
    due_time NVARCHAR(16) NULL,
    subtasks NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    [order] INT NOT NULL DEFAULT 0,
    recurrence NVARCHAR(MAX) NULL,
    next_recurrence_due DATETIME NULL,
    original_id NVARCHAR(64) NULL,
    archived INT NOT NULL DEFAULT 0,
    user_id NVARCHAR(128) NOT NULL
);

CREATE TABLE dbo.tags (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    color NVARCHAR(255) NOT NULL,
    user_id NVARCHAR(128) NULL,
    is_default INT NOT NULL DEFAULT 0
);

CREATE TABLE dbo.todo_tags (
    todo_id NVARCHAR(64) NOT NULL,
    tag_id VARCHAR(255) NOT NULL,
    CONSTRAINT PK_todo_tags PRIMARY KEY (todo_id, tag_id),
    CONSTRAINT FK_todo_tags_todo FOREIGN KEY (todo_id) REFERENCES dbo.todos (id),
    CONSTRAINT FK_todo_tags_tag FOREIGN KEY (tag_id) REFERENCES dbo.tags (id)
);
