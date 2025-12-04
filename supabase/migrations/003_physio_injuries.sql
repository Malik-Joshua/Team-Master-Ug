-- Physio Role and Injuries Table
-- Run this migration in your Supabase SQL Editor

-- Update user_profiles to include 'physio' role
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('player', 'coach', 'data_admin', 'finance_admin', 'admin', 'physio'));

-- ============================================
-- INJURIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS injuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  injury_date DATE NOT NULL,
  cause TEXT NOT NULL,
  diagnosis TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  further_treatment TEXT,
  medication TEXT,
  return_to_training_date DATE,
  return_to_play_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cleared', 'healed')),
  cleared_at TIMESTAMP WITH TIME ZONE,
  cleared_by UUID REFERENCES user_profiles(user_id),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(user_id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_injuries_player_id ON injuries(player_id);
CREATE INDEX IF NOT EXISTS idx_injuries_status ON injuries(status);
CREATE INDEX IF NOT EXISTS idx_injuries_date ON injuries(injury_date);
CREATE INDEX IF NOT EXISTS idx_injuries_created_by ON injuries(created_by);

-- Calculate healing duration (in days)
-- This is a computed field that can be calculated as: 
-- CASE WHEN return_to_play_date IS NOT NULL THEN return_to_play_date - injury_date ELSE NULL END

-- ============================================
-- RLS POLICIES FOR INJURIES
-- ============================================
ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;

-- Players can view their own injuries
CREATE POLICY "Players can view own injuries"
  ON injuries FOR SELECT
  USING (auth.uid() = player_id);

-- Physios can view all injuries
CREATE POLICY "Physios can view all injuries"
  ON injuries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'physio'
    )
  );

-- Coaches and admins can view all injuries
CREATE POLICY "Coaches and admins can view all injuries"
  ON injuries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coach', 'data_admin')
    )
  );

-- Physios can create injuries
CREATE POLICY "Physios can create injuries"
  ON injuries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'physio'
    )
  );

-- Physios can update injuries
CREATE POLICY "Physios can update injuries"
  ON injuries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'physio'
    )
  );

-- Physios can clear injuries
CREATE POLICY "Physios can clear injuries"
  ON injuries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'physio'
    )
  );

-- Admins can manage all injuries
CREATE POLICY "Admins can manage all injuries"
  ON injuries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_injuries_updated_at BEFORE UPDATE ON injuries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



