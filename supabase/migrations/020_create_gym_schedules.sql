-- Gym Schedules Table
-- Allows coaches to create gym schedules visible to players, data managers, and admins

CREATE TABLE IF NOT EXISTS gym_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_date DATE NOT NULL,
  schedule_time TIME,
  location TEXT,
  description TEXT NOT NULL,
  exercises TEXT, -- JSON or text description of exercises
  created_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gym_schedules_date ON gym_schedules(schedule_date);
CREATE INDEX IF NOT EXISTS idx_gym_schedules_created_by ON gym_schedules(created_by);

-- Enable RLS
ALTER TABLE gym_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can view gym schedules
CREATE POLICY "All users can view gym schedules"
  ON gym_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Only coaches and admins can create gym schedules
CREATE POLICY "Coaches and admins can create gym schedules"
  ON gym_schedules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- Only coaches and admins can update gym schedules
CREATE POLICY "Coaches and admins can update gym schedules"
  ON gym_schedules FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- Only coaches and admins can delete gym schedules
CREATE POLICY "Coaches and admins can delete gym schedules"
  ON gym_schedules FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_gym_schedules_updated_at BEFORE UPDATE ON gym_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
