-- Migration: Add user_id to todos and tags
ALTER TABLE todos ADD COLUMN user_id TEXT;
ALTER TABLE tags ADD COLUMN user_id TEXT;
-- Optionally, add foreign key constraints if SQLite version supports it
-- PRAGMA foreign_keys=off;
-- CREATE TABLE todos_new (..., user_id TEXT REFERENCES users(id));
-- ...
