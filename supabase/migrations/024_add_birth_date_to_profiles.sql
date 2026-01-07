-- Add birth_date field to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Create index for efficient birthday queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_birth_date ON user_profiles(birth_date);

-- Add comment to explain the field
COMMENT ON COLUMN user_profiles.birth_date IS 'User birth date for birthday notifications and age calculations';

