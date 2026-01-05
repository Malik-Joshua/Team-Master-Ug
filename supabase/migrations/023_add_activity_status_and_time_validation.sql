-- Migration: Add activity status fields and time-based validation
-- This migration adds status tracking and automatic marking of activities when scheduled time passes

-- ============================================
-- 1. Add status column to training_sessions
-- ============================================
ALTER TABLE training_sessions 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled' 
CHECK (status IN ('scheduled', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_training_sessions_status ON training_sessions(status);

-- ============================================
-- 2. Add status column to gym_schedules
-- ============================================
ALTER TABLE gym_schedules 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled' 
CHECK (status IN ('scheduled', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_gym_schedules_status ON gym_schedules(status);

-- ============================================
-- 3. Add status column to matches
-- ============================================
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled' 
CHECK (status IN ('scheduled', 'played', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- ============================================
-- 4. Function to check if a date/time has passed
-- ============================================
CREATE OR REPLACE FUNCTION is_activity_past(
  activity_date DATE,
  activity_time TIME DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  activity_timestamp TIMESTAMP WITH TIME ZONE;
  now_timestamp TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get current timestamp
  now_timestamp := NOW();
  
  -- Combine date and time if time is provided, otherwise use end of day
  IF activity_time IS NOT NULL THEN
    activity_timestamp := (activity_date || ' ' || activity_time)::TIMESTAMP WITH TIME ZONE;
  ELSE
    -- If no time specified, consider it past if date is before today
    -- Or if date is today, consider it past at end of day (23:59:59)
    activity_timestamp := (activity_date || ' 23:59:59')::TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Check if activity time has passed
  RETURN activity_timestamp < now_timestamp;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 5. Function to automatically update training session status
-- ============================================
CREATE OR REPLACE FUNCTION update_training_session_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If session is scheduled and time has passed, mark as completed
  IF NEW.status = 'scheduled' AND is_activity_past(NEW.session_date, NEW.session_time) THEN
    NEW.status := 'completed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update training session status on insert/update
DROP TRIGGER IF EXISTS trigger_update_training_session_status ON training_sessions;
CREATE TRIGGER trigger_update_training_session_status
  BEFORE INSERT OR UPDATE ON training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_training_session_status();

-- ============================================
-- 6. Function to automatically update gym schedule status
-- ============================================
CREATE OR REPLACE FUNCTION update_gym_schedule_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If schedule is scheduled and time has passed, mark as completed
  IF NEW.status = 'scheduled' AND is_activity_past(NEW.schedule_date, NEW.schedule_time) THEN
    NEW.status := 'completed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update gym schedule status on insert/update
DROP TRIGGER IF EXISTS trigger_update_gym_schedule_status ON gym_schedules;
CREATE TRIGGER trigger_update_gym_schedule_status
  BEFORE INSERT OR UPDATE ON gym_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_gym_schedule_status();

-- ============================================
-- 7. Function to automatically update match status
-- ============================================
CREATE OR REPLACE FUNCTION update_match_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If match is scheduled and date has passed, mark as played
  -- Note: matches typically don't have a time, so we check if date is before today
  IF NEW.status = 'scheduled' AND is_activity_past(NEW.match_date, NULL) THEN
    NEW.status := 'played';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update match status on insert/update
DROP TRIGGER IF EXISTS trigger_update_match_status ON matches;
CREATE TRIGGER trigger_update_match_status
  BEFORE INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_match_status();

-- ============================================
-- 8. Function to batch update all past activities
-- This can be called periodically or on-demand
-- ============================================
CREATE OR REPLACE FUNCTION update_all_past_activities()
RETURNS TABLE (
  table_name TEXT,
  updated_count INTEGER
) AS $$
DECLARE
  training_count INTEGER;
  gym_count INTEGER;
  match_count INTEGER;
BEGIN
  -- Update past training sessions
  UPDATE training_sessions
  SET status = 'completed'
  WHERE status = 'scheduled' 
    AND is_activity_past(session_date, session_time);
  
  GET DIAGNOSTICS training_count = ROW_COUNT;
  
  -- Update past gym schedules
  UPDATE gym_schedules
  SET status = 'completed'
  WHERE status = 'scheduled' 
    AND is_activity_past(schedule_date, schedule_time);
  
  GET DIAGNOSTICS gym_count = ROW_COUNT;
  
  -- Update past matches
  UPDATE matches
  SET status = 'played'
  WHERE status = 'scheduled' 
    AND is_activity_past(match_date, NULL);
  
  GET DIAGNOSTICS match_count = ROW_COUNT;
  
  -- Return results
  RETURN QUERY SELECT 'training_sessions'::TEXT, training_count;
  RETURN QUERY SELECT 'gym_schedules'::TEXT, gym_count;
  RETURN QUERY SELECT 'matches'::TEXT, match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. Update existing records to set appropriate status
-- ============================================
-- Mark past training sessions as completed
UPDATE training_sessions
SET status = 'completed'
WHERE status = 'scheduled' 
  AND is_activity_past(session_date, session_time);

-- Mark past gym schedules as completed
UPDATE gym_schedules
SET status = 'completed'
WHERE status = 'scheduled' 
  AND is_activity_past(schedule_date, schedule_time);

-- Mark past matches as played (if they have stats, they're already played)
UPDATE matches
SET status = 'played'
WHERE status = 'scheduled' 
  AND (
    is_activity_past(match_date, NULL)
    OR EXISTS (SELECT 1 FROM match_stats WHERE match_stats.match_id = matches.id)
  );

