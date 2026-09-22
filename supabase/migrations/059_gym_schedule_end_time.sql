-- Migration 059: store a gym session's finish time so its duration can be
-- calculated and displayed, matching training sessions (migration 058).

ALTER TABLE gym_schedules
  ADD COLUMN IF NOT EXISTS schedule_end_time time;

ALTER TABLE gym_schedules
  DROP CONSTRAINT IF EXISTS gym_schedules_end_after_start;

ALTER TABLE gym_schedules
  ADD CONSTRAINT gym_schedules_end_after_start
  CHECK (
    schedule_end_time IS NULL
    OR schedule_time IS NULL
    OR schedule_end_time > schedule_time
  );

NOTIFY pgrst, 'reload schema';
