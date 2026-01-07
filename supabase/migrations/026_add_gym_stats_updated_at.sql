-- Add gym_stats_updated_at field to players table
-- This field tracks when gym stats were last updated for weekly metrics tracking

ALTER TABLE players
ADD COLUMN IF NOT EXISTS gym_stats_updated_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient weekly queries
CREATE INDEX IF NOT EXISTS idx_players_gym_stats_updated_at ON players(gym_stats_updated_at);

-- Update existing records to set gym_stats_updated_at to updated_at if gym_stats exists
UPDATE players
SET gym_stats_updated_at = updated_at
WHERE gym_stats IS NOT NULL 
  AND gym_stats != '{}'::jsonb
  AND gym_stats_updated_at IS NULL;

COMMENT ON COLUMN players.gym_stats_updated_at IS 'Timestamp when gym stats were last updated. Used for weekly best metrics tracking.';

