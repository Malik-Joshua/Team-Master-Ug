-- Migration 057: add `rows` column to gym_metric_files so the raw scanned
-- CSV/Excel content can be stored in the DB and viewed cross-account, matching
-- what migration 056 did for training_attendance_files.

ALTER TABLE gym_metric_files
  ADD COLUMN IF NOT EXISTS rows jsonb;
