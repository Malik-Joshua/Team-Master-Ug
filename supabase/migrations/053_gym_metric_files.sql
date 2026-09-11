-- Migration 053: gym_metric_files table and storage bucket

-- Table to record each uploaded gym-metric file and its processing summary
CREATE TABLE IF NOT EXISTS gym_metric_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES gym_schedules(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  metrics_captured int NOT NULL DEFAULT 0,
  metrics_total int NOT NULL DEFAULT 0
);

ALTER TABLE gym_metric_files ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "gym_metric_files_select" ON gym_metric_files
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow coaches/admins to insert (they may only insert rows they uploaded)
CREATE POLICY "gym_metric_files_insert" ON gym_metric_files
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Storage bucket for uploaded gym-metric files (CSV / Excel / plain-text)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gym-metric-files',
  'gym-metric-files',
  false,
  10485760,
  ARRAY[
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain'
  ]
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated uploads to gym-metric-files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'gym-metric-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated reads from gym-metric-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gym-metric-files' AND auth.uid() IS NOT NULL);
