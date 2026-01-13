-- Ensure gym_stats_updated_at column exists in players table
-- This fixes the error: column players.gym_stats_updated_at does not exist

DO $$
BEGIN
  -- Check if column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'players' 
    AND column_name = 'gym_stats_updated_at'
  ) THEN
    ALTER TABLE players 
    ADD COLUMN gym_stats_updated_at TIMESTAMP WITH TIME ZONE;
    
    -- Create index for efficient weekly queries
    CREATE INDEX IF NOT EXISTS idx_players_gym_stats_updated_at ON players(gym_stats_updated_at);
    
    -- Update existing records to set gym_stats_updated_at to updated_at if gym_stats exists
    UPDATE players
    SET gym_stats_updated_at = updated_at
    WHERE gym_stats IS NOT NULL 
      AND gym_stats != '{}'::jsonb
      AND gym_stats_updated_at IS NULL;
    
    -- Add comment
    COMMENT ON COLUMN players.gym_stats_updated_at IS 'Timestamp when gym stats were last updated. Used for weekly best metrics tracking.';
    
    RAISE NOTICE 'Added gym_stats_updated_at column to players table';
  ELSE
    RAISE NOTICE 'gym_stats_updated_at column already exists in players table';
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
