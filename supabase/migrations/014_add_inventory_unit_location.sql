-- Add missing unit and location columns to inventory table
-- This migration fixes the schema cache issue where these columns were missing

-- Add unit column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory' AND column_name = 'unit'
  ) THEN
    ALTER TABLE inventory ADD COLUMN unit TEXT DEFAULT 'pieces';
  END IF;
END $$;

-- Add location column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory' AND column_name = 'location'
  ) THEN
    ALTER TABLE inventory ADD COLUMN location TEXT;
  END IF;
END $$;

