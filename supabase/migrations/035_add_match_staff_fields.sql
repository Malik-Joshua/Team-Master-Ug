-- Add staff assignment fields to matches table
-- Allows data managers to assign physio, team manager, and coach for each game day

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS physio_id UUID REFERENCES user_profiles(user_id),
ADD COLUMN IF NOT EXISTS team_manager_id UUID REFERENCES user_profiles(user_id),
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES user_profiles(user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_matches_physio_id ON matches(physio_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_manager_id ON matches(team_manager_id);
CREATE INDEX IF NOT EXISTS idx_matches_coach_id ON matches(coach_id);

-- Add comments
COMMENT ON COLUMN matches.physio_id IS 'Physiotherapist assigned to this match/game day';
COMMENT ON COLUMN matches.team_manager_id IS 'Team Manager (Data Admin) assigned to this match/game day';
COMMENT ON COLUMN matches.coach_id IS 'Coach assigned to this match/game day';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
