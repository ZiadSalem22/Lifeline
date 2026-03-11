-- Migration 008: Enable pg_trgm and add GiST index for title similarity search
-- pg_trgm provides trigram-based fuzzy text matching via similarity() function.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_todos_title_trgm ON todos USING gist (title gist_trgm_ops);
