-- Migration 054: make storage_path nullable so a file record is always written
-- even when the Supabase Storage upload is not yet configured.
ALTER TABLE gym_metric_files ALTER COLUMN storage_path DROP NOT NULL;
