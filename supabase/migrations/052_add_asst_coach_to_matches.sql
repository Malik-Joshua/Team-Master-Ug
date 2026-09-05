-- Add assistant coach staff assignment to matches
-- Allows the assistant coach to be assigned to a game day and tracked
-- for attendance alongside the head coach, physio, and team manager.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS asst_coach_id UUID REFERENCES user_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_matches_asst_coach_id ON matches(asst_coach_id);

COMMENT ON COLUMN matches.asst_coach_id IS 'Assistant Coach assigned to this match/game day';

-- Refresh PostgREST schema cache so the new column is immediately queryable.
NOTIFY pgrst, 'reload schema';
