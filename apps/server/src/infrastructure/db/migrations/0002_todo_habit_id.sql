-- 0002_todo_habit_id — task ↔ habit link (hand-authored, additive only).
--
-- Nullable Daily Plan habit id on todos: completing a task checks its linked
-- habit for the task's due date (recomputed client-side; the column is plain
-- storage). IF NOT EXISTS keeps the file idempotent, matching convention;
-- existing rows read as NULL (no link).

ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "habit_id" text;
