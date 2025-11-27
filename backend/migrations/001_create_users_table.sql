-- Migration: Create users table for multi-tenancy
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  auth0_sub TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
