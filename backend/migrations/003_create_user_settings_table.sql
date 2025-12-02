-- Migration: create user_settings table for persistent user settings
-- MSSQL syntax
IF OBJECT_ID('dbo.user_settings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_settings (
        id VARCHAR(50) PRIMARY KEY,
        user_id VARCHAR(50) NOT NULL,
        theme VARCHAR(50) NULL,
        locale VARCHAR(20) NULL,
        layout NVARCHAR(MAX) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_user_settings_user_id ON dbo.user_settings (user_id);
END
