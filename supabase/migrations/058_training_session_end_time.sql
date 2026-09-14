-- Migration 058: store a training session's finish time so its duration can be
-- calculated and displayed throughout the training feature.

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS session_end_time time;

ALTER TABLE training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_end_after_start;

ALTER TABLE training_sessions
  ADD CONSTRAINT training_sessions_end_after_start
  CHECK (
    session_end_time IS NULL
    OR session_time IS NULL
    OR session_end_time > session_time
  );
