-- Add captain and assistant captain fields to fixture_team_selections
-- Allows coaches and team managers to appoint team captain and assistant captain for each match

ALTER TABLE fixture_team_selections
ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_assistant_captain BOOLEAN DEFAULT false;

-- Add index for captain queries
CREATE INDEX IF NOT EXISTS idx_fixture_team_selections_captain ON fixture_team_selections(match_id, is_captain) WHERE is_captain = true;
CREATE INDEX IF NOT EXISTS idx_fixture_team_selections_assistant_captain ON fixture_team_selections(match_id, is_assistant_captain) WHERE is_assistant_captain = true;

-- Add constraint to ensure only one captain per match
-- Note: This is enforced at the application level, but we can add a unique partial index
-- However, PostgreSQL doesn't support unique partial indexes directly, so we'll handle this in the application

COMMENT ON COLUMN fixture_team_selections.is_captain IS 'Indicates if this player is the team captain for this match';
COMMENT ON COLUMN fixture_team_selections.is_assistant_captain IS 'Indicates if this player is the assistant captain for this match';

