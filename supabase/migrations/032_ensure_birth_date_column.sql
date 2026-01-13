-- Ensure birth_date column exists in user_profiles table
-- This migration ensures the column is present and refreshes the schema cache

-- Use DO block to check and add column (more reliable than IF NOT EXISTS on ALTER TABLE)
DO $$
BEGIN
  -- Check if column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles' 
    AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN birth_date DATE;
    
    RAISE NOTICE 'Added birth_date column to user_profiles table';
  ELSE
    RAISE NOTICE 'birth_date column already exists in user_profiles table';
  END IF;
END $$;

-- Create index for efficient birthday queries (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_user_profiles_birth_date ON user_profiles(birth_date);

-- Add comment to explain the field
COMMENT ON COLUMN user_profiles.birth_date IS 'User birth date for birthday notifications and age calculations';

-- Refresh PostgREST schema cache
-- This ensures the API layer recognizes the new column
NOTIFY pgrst, 'reload schema';
