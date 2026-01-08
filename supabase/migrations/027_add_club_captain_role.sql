-- Migration: Add club_captain role and linked_player_id field
-- This allows club captains to be linked to their player accounts
-- so they don't lose stats when removed from the role

-- Step 1: Add linked_player_id column to user_profiles
-- This links a club_captain account to their player account
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS linked_player_id UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_linked_player_id ON user_profiles(linked_player_id);

-- Step 2: Update the role CHECK constraint to include 'club_captain'
-- First, drop the existing constraint
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add the new constraint with club_captain included
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('player', 'coach', 'data_admin', 'finance_admin', 'admin', 'physio', 'club_captain'));

-- Step 3: Add constraint to ensure club_captain has linked_player_id
-- This ensures club captains are always linked to a player account
ALTER TABLE user_profiles
ADD CONSTRAINT club_captain_must_have_linked_player 
CHECK (
  role != 'club_captain' OR linked_player_id IS NOT NULL
);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN user_profiles.linked_player_id IS 'For club_captain role: links to the player account user_id to preserve stats when role is removed';

-- Step 5: Update RLS policies to include club_captain where data_admin is included
-- Note: We'll update policies that allow data_admin to also allow club_captain

-- Update policies that check for data_admin to also include club_captain
-- This is done by updating the USING clauses in existing policies

-- For messages table - allow club_captain to view messages like data_admin
-- (This will be handled in application code, but we ensure RLS doesn't block it)

-- For performance_resources - update policies to allow club_captain
DROP POLICY IF EXISTS "Admins and coaches can view all performance resources" ON performance_resources;
CREATE POLICY "Admins coaches and club captains can view all performance resources"
  ON performance_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coach', 'club_captain')
    )
  );

DROP POLICY IF EXISTS "Admins and coaches can create performance resources" ON performance_resources;
CREATE POLICY "Admins coaches and club captains can create performance resources"
  ON performance_resources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coach', 'club_captain')
    )
  );

DROP POLICY IF EXISTS "Admins and coaches can update performance resources" ON performance_resources;
CREATE POLICY "Admins coaches and club captains can update performance resources"
  ON performance_resources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coach', 'club_captain')
    )
  );

DROP POLICY IF EXISTS "Admins and coaches can delete performance resources" ON performance_resources;
CREATE POLICY "Admins coaches and club captains can delete performance resources"
  ON performance_resources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coach', 'club_captain')
    )
  );

-- Note: Additional RLS policies for other tables (matches, players, etc.) 
-- that allow data_admin access will need to be updated in application code
-- since the current RLS setup uses service role for admin operations
