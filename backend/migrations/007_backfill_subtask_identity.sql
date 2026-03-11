-- Migration 007: Backfill subtask identity (subtaskId + position)
-- Adds stable UUID subtaskId and 1-based position to each element in the JSONB subtasks array.
-- Idempotent: skips elements that already have a subtaskId.

DO $$
DECLARE
  rec RECORD;
  updated_subtasks jsonb;
  elem jsonb;
  i int;
BEGIN
  FOR rec IN
    SELECT id, subtasks
    FROM todos
    WHERE subtasks IS NOT NULL
      AND jsonb_array_length(subtasks) > 0
  LOOP
    updated_subtasks := '[]'::jsonb;
    i := 0;

    FOR elem IN SELECT value FROM jsonb_array_elements(rec.subtasks)
    LOOP
      i := i + 1;

      -- Add subtaskId if missing
      IF NOT (elem ? 'subtaskId') OR elem->>'subtaskId' IS NULL OR elem->>'subtaskId' = '' THEN
        elem := jsonb_set(elem, '{subtaskId}', to_jsonb(gen_random_uuid()::text));
      END IF;

      -- Set position to current 1-based index
      elem := jsonb_set(elem, '{position}', to_jsonb(i));

      updated_subtasks := updated_subtasks || jsonb_build_array(elem);
    END LOOP;

    UPDATE todos SET subtasks = updated_subtasks WHERE id = rec.id;
  END LOOP;
END $$;
