-- 0001_daily_plans — Daily Plan mode storage (hand-authored, additive only).
--
-- Two jsonb-blob tables validated app-side by @lifeline/shared zod schemas:
-- one row per (user, date) for the day's plan, one row per user for plan
-- settings (card layout, habits list, gym routines, meal presets, targets).
-- IF NOT EXISTS keeps the file idempotent, matching the baseline's adoption
-- strategy; existing data is never touched.

CREATE TABLE IF NOT EXISTS "daily_plans" (
  "user_id" text NOT NULL,
  "plan_date" text NOT NULL,
  "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "daily_plans_user_id_plan_date_pk" PRIMARY KEY ("user_id", "plan_date"),
  CONSTRAINT "fk_daily_plans_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chk_daily_plans_date_format" CHECK ("plan_date" ~ '^\d{4}-\d{2}-\d{2}$'),
  CONSTRAINT "chk_daily_plans_data_object" CHECK (jsonb_typeof("data") = 'object')
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "daily_plan_settings" (
  "user_id" text PRIMARY KEY NOT NULL,
  "data" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "fk_daily_plan_settings_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "chk_daily_plan_settings_data_object" CHECK (jsonb_typeof("data") = 'object')
);
