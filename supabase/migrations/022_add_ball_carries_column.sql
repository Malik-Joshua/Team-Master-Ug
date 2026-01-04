-- Add ball_carries column to match_stats if it doesn't exist
-- This fixes the error: Could not find the 'ball_carries' column of 'match_stats' in the schema cache

DO $$
BEGIN
  -- Check if column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'match_stats' 
    AND column_name = 'ball_carries'
  ) THEN
    ALTER TABLE match_stats 
    ADD COLUMN ball_carries INTEGER DEFAULT 0;
    
    RAISE NOTICE 'Added ball_carries column to match_stats table';
  ELSE
    RAISE NOTICE 'ball_carries column already exists in match_stats table';
  END IF;
END $$;

