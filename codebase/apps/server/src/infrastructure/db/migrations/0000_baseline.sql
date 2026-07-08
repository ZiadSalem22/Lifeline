-- 0000_baseline — Lifeline schema baseline (hand-authored, NOT drizzle-kit generated).
--
-- Reconstructs the live production schema exactly (see
-- docs/issues/clean-rebuild/discovery/audit-db-schema.md): the two TypeORM
-- migrations + the manual pg_trgm migration 008, folded into one file.
--
-- Adoption strategy: every CREATE uses IF NOT EXISTS, so this file is safe to
-- run against BOTH a fresh database and the existing VPS database. CHECK/FK
-- constraints are declared inline in CREATE TABLE — Postgres has no
-- "ADD CONSTRAINT IF NOT EXISTS", but inline is sufficient because when the
-- table already exists the whole CREATE TABLE is skipped, and the live DB
-- already carries these exact constraints (they were created by the old
-- initial migration with the same names). New databases get them from this
-- file. The old TypeORM "migrations" ledger table is left behind as an inert
-- artifact; drizzle keeps its own ledger in drizzle.__drizzle_migrations.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "auth0_sub" text NOT NULL,
  "email" text,
  "name" text,
  "picture" text,
  "role" text NOT NULL DEFAULT 'free',
  "subscription_status" text NOT NULL DEFAULT 'none',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chk_users_id_not_blank" CHECK (char_length(trim("id")) > 0),
  CONSTRAINT "chk_users_auth0_sub_not_blank" CHECK (char_length(trim("auth0_sub")) > 0),
  CONSTRAINT "chk_users_email_not_blank" CHECK ("email" IS NULL OR char_length(trim("email")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_users_auth0_sub" ON "users" ("auth0_sub");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_users_email_not_null" ON "users" (lower("email")) WHERE "email" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_users_role" ON "users" ("role");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_users_subscription_status" ON "users" ("subscription_status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_profiles" (
  "user_id" text PRIMARY KEY NOT NULL,
  "first_name" text,
  "last_name" text,
  "phone" text,
  "country" text,
  "city" text,
  "timezone" text,
  "avatar_url" text,
  "onboarding_completed" boolean NOT NULL DEFAULT false,
  "start_day_of_week" text NOT NULL DEFAULT 'Monday',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_user_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chk_user_profiles_start_day_of_week" CHECK ("start_day_of_week" IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_user_profiles_onboarding_completed" ON "user_profiles" ("onboarding_completed");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_user_profiles_start_day" ON "user_profiles" ("start_day_of_week");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_settings" (
  "user_id" text PRIMARY KEY NOT NULL,
  "theme" text NOT NULL DEFAULT 'system',
  "locale" text NOT NULL DEFAULT 'en',
  "layout" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_user_settings_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chk_user_settings_theme_not_blank" CHECK (char_length(trim("theme")) > 0),
  CONSTRAINT "chk_user_settings_locale_not_blank" CHECK (char_length(trim("locale")) > 0),
  CONSTRAINT "chk_user_settings_layout_object" CHECK (jsonb_typeof("layout") = 'object')
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "todos" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "task_number" integer NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "due_date" timestamptz,
  "due_time" text,
  "is_completed" boolean NOT NULL DEFAULT false,
  "is_flagged" boolean NOT NULL DEFAULT false,
  "duration" integer NOT NULL DEFAULT 0,
  "priority" text NOT NULL DEFAULT 'medium',
  "subtasks" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "order" integer NOT NULL DEFAULT 0,
  "recurrence" jsonb,
  "next_recurrence_due" timestamptz,
  "original_id" text,
  "archived" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_todos_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_todos_original" FOREIGN KEY ("original_id") REFERENCES "todos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "chk_todos_id_not_blank" CHECK (char_length(trim("id")) > 0),
  CONSTRAINT "chk_todos_title_not_blank" CHECK (char_length(trim("title")) > 0),
  CONSTRAINT "chk_todos_task_number_positive" CHECK ("task_number" > 0),
  CONSTRAINT "chk_todos_duration_non_negative" CHECK ("duration" >= 0),
  CONSTRAINT "chk_todos_priority" CHECK ("priority" IN ('low','medium','high')),
  CONSTRAINT "chk_todos_subtasks_array" CHECK (jsonb_typeof("subtasks") = 'array'),
  CONSTRAINT "chk_todos_recurrence_object" CHECK ("recurrence" IS NULL OR jsonb_typeof("recurrence") = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_todos_user_task_number" ON "todos" ("user_id", "task_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_todos_user_archived_completed" ON "todos" ("user_id", "archived", "is_completed");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_todos_user_due_date" ON "todos" ("user_id", "due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_todos_user_flagged" ON "todos" ("user_id", "is_flagged");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_todos_next_recurrence_due" ON "todos" ("user_id", "next_recurrence_due") WHERE "next_recurrence_due" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_todos_original_id" ON "todos" ("original_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_todos_subtasks_gin" ON "todos" USING gin ("subtasks");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_todos_recurrence_gin" ON "todos" USING gin ("recurrence");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_todos_title_trgm" ON "todos" USING gist ("title" gist_trgm_ops);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tags" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL,
  "user_id" text,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_tags_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chk_tags_name_not_blank" CHECK (char_length(trim("name")) > 0),
  CONSTRAINT "chk_tags_color_not_blank" CHECK (char_length(trim("color")) > 0),
  CONSTRAINT "chk_tags_default_ownership" CHECK (("is_default" = true AND "user_id" IS NULL) OR ("is_default" = false AND "user_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_tags_default_name" ON "tags" (lower("name")) WHERE "is_default" = true AND "user_id" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_tags_custom_name_per_user" ON "tags" ("user_id", lower("name")) WHERE "is_default" = false AND "user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_tags_default_user" ON "tags" ("is_default", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_tags_user_id" ON "tags" ("user_id") WHERE "user_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_tags_defaults_only" ON "tags" ("is_default") WHERE "is_default" = true;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "todo_tags" (
  "todo_id" text NOT NULL,
  "tag_id" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "todo_tags_todo_id_tag_id_pk" PRIMARY KEY ("todo_id", "tag_id"),
  CONSTRAINT "fk_todo_tags_todo" FOREIGN KEY ("todo_id") REFERENCES "todos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "fk_todo_tags_tag" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_todo_tags_tag_id" ON "todo_tags" ("tag_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "mcp_api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "key_prefix" text NOT NULL,
  "key_hash" text NOT NULL,
  "scopes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'active',
  "expires_at" timestamptz,
  "last_used_at" timestamptz,
  "last_used_ip" text,
  "last_used_user_agent" text,
  "revocation_reason" text,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_mcp_api_keys_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chk_mcp_api_keys_id_not_blank" CHECK (char_length(trim("id")) > 0),
  CONSTRAINT "chk_mcp_api_keys_name_not_blank" CHECK (char_length(trim("name")) > 0),
  CONSTRAINT "chk_mcp_api_keys_prefix_not_blank" CHECK (char_length(trim("key_prefix")) > 0),
  CONSTRAINT "chk_mcp_api_keys_hash_not_blank" CHECK (char_length(trim("key_hash")) > 0),
  CONSTRAINT "chk_mcp_api_keys_scopes_array" CHECK (jsonb_typeof("scopes") = 'array'),
  CONSTRAINT "chk_mcp_api_keys_status" CHECK ("status" IN ('active','revoked','expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_mcp_api_keys_prefix" ON "mcp_api_keys" ("key_prefix");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_mcp_api_keys_user_status" ON "mcp_api_keys" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_mcp_api_keys_expires_at" ON "mcp_api_keys" ("expires_at") WHERE "expires_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_mcp_api_keys_last_used_at" ON "mcp_api_keys" ("last_used_at") WHERE "last_used_at" IS NOT NULL;
--> statement-breakpoint

-- Idempotent seed of the 10 global default tags (ids/colors mirror
-- @lifeline/shared DEFAULT_TAGS; user_id NULL, is_default true, immutable).
INSERT INTO "tags" ("id", "name", "color", "user_id", "is_default")
VALUES
  ('default-work', 'Work', '#3B82F6', NULL, true),
  ('default-personal', 'Personal', '#10B981', NULL, true),
  ('default-health', 'Health', '#EF4444', NULL, true),
  ('default-finance', 'Finance', '#F59E0B', NULL, true),
  ('default-study', 'Study', '#6366F1', NULL, true),
  ('default-family', 'Family', '#EC4899', NULL, true),
  ('default-errands', 'Errands', '#6B7280', NULL, true),
  ('default-ideas', 'Ideas', '#8B5CF6', NULL, true),
  ('default-important', 'Important', '#DC2626', NULL, true),
  ('default-misc', 'Misc', '#9CA3AF', NULL, true)
ON CONFLICT DO NOTHING;
