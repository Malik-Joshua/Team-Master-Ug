-- Migration: Allow users to create their own profiles
-- This removes the requirement for admin approval before account creation

-- Drop existing INSERT policy if it exists (in case it was added elsewhere)
DROP POLICY IF EXISTS "Users can create own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON user_profiles;

-- Allow users to insert their own profile when they sign up
-- This is safe because it only allows users to create their own profile (auth.uid() = user_id)
CREATE POLICY "Users can create own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: Admin profile creation should be done via API routes using service role key
-- to avoid RLS recursion issues. The API route at /api/players already handles this.

-- Update the default status to 'active' instead of 'pending' for new users
-- This allows users to immediately access the system after signup
ALTER TABLE user_profiles 
ALTER COLUMN status SET DEFAULT 'active';

-- Update existing pending users to active so they can access the system
UPDATE user_profiles SET status = 'active' WHERE status = 'pending';

