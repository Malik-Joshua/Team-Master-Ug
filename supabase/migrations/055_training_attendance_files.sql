-- Migration 055: training_attendance_files
-- Tracks every CSV/Excel file uploaded for training attendance.
-- Mirrors gym_metric_files so the "Uploaded attendance files" archive is
-- shared across all accounts (coach, asst_coach, data_admin).

CREATE TABLE IF NOT EXISTS training_attendance_files (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        REFERENCES training_sessions(id) ON DELETE SET NULL,
  file_name    text        NOT NULL,
  storage_path text,                          -- nullable; populated if Storage is configured
  uploaded_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE training_attendance_files ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read (coaches, manager, asst-coach all need this)
CREATE POLICY "training_attendance_files_select"
  ON training_attendance_files FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only the uploader may insert their own record
CREATE POLICY "training_attendance_files_insert"
  ON training_attendance_files FOR INSERT
  WITH CHECK (auth.uid() = uploaded_by);
