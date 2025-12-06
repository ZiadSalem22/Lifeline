-- Migration to drop unique constraint on email in users table (SQL Server)

-- Find the name of the unique constraint on email (if not known)
-- SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('users');

-- Drop the unique constraint (replace UQ__users__AB6E6164AE2A45F3 with your actual constraint name if different)
ALTER TABLE users DROP CONSTRAINT UQ__users__AB6E6164AE2A45F3;

-- If you want to keep a non-unique index for performance, you can add it back as a non-unique index:
-- CREATE INDEX IX_users_email ON users(email);
