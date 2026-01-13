-- Ensure birth_date column exists in user_profiles table
-- This migration ensures the column is present and refreshes the schema cache

-- Add birth_date column if it doesn't exist
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Create index for efficient birthday queries (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_user_profiles_birth_date ON user_profiles(birth_date);

-- Add comment to explain the field
COMMENT ON COLUMN user_profiles.birth_date IS 'User birth date for birthday notifications and age calculations';

-- Refresh PostgREST schema cache
-- This ensures the API layer recognizes the new column
NOTIFY pgrst, 'reload schema';
