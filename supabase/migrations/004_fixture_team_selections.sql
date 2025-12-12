-- Fixture Team Selections Migration
-- Allows coaches to select players for fixtures/matches

-- ============================================
-- FIXTURE TEAM SELECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS fixture_team_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(user_id) ON DELETE CASCADE NOT NULL,
  position TEXT, -- Optional: specific position for this fixture
  jersey_number INTEGER, -- Optional: jersey number for this fixture
  is_starting BOOLEAN DEFAULT true, -- Whether player is in starting lineup
  is_substitute BOOLEAN DEFAULT false, -- Whether player is a substitute
  selected_by UUID REFERENCES user_profiles(user_id), -- Coach who selected the team
  notes TEXT, -- Optional notes about the selection
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_fixture_team_selections_match ON fixture_team_selections(match_id);
CREATE INDEX IF NOT EXISTS idx_fixture_team_selections_player ON fixture_team_selections(player_id);
CREATE INDEX IF NOT EXISTS idx_fixture_team_selections_selected_by ON fixture_team_selections(selected_by);

-- Enable RLS
ALTER TABLE fixture_team_selections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Coaches can view all team selections
CREATE POLICY "Coaches can view team selections"
  ON fixture_team_selections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin', 'data_admin', 'player', 'physio')
    )
  );

-- Only coaches and admins can insert team selections
CREATE POLICY "Coaches can create team selections"
  ON fixture_team_selections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- Only coaches and admins can update team selections
CREATE POLICY "Coaches can update team selections"
  ON fixture_team_selections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- Only coaches and admins can delete team selections
CREATE POLICY "Coaches can delete team selections"
  ON fixture_team_selections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_fixture_team_selections_updated_at
  BEFORE UPDATE ON fixture_team_selections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
