-- Migration 056: enforce one shared training attendance file per session and
-- retain a cross-account preview of the parsed CSV/Excel content.

ALTER TABLE training_attendance_files
  ADD COLUMN IF NOT EXISTS rows jsonb;

-- Keep the newest record for sessions that were uploaded more than once before
-- the uniqueness rule was introduced.
WITH ranked_files AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY session_id
      ORDER BY uploaded_at DESC, id DESC
    ) AS row_number
  FROM training_attendance_files
  WHERE session_id IS NOT NULL
)
DELETE FROM training_attendance_files AS file
USING ranked_files AS ranked
WHERE file.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS training_attendance_files_session_unique
  ON training_attendance_files(session_id)
  WHERE session_id IS NOT NULL;
