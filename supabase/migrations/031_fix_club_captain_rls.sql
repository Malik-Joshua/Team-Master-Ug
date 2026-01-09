-- Migration: Fix RLS policy to allow players to view their linked club captain profile
-- Problem: Players can't query club captain profiles even when linked_player_id matches their user_id
-- Solution: Update SELECT policy to allow viewing club captain profiles where linked_player_id = auth.uid()

-- Drop the existing simple SELECT policy
DROP POLICY IF EXISTS "users_select_own" ON user_profiles;
DROP POLICY IF EXISTS "users_view_own_profile" ON user_profiles;

-- Create a new SELECT policy that allows:
-- 1. Users to view their own profile (auth.uid() = user_id)
-- 2. Players to view club captain profiles linked to them (linked_player_id = auth.uid())
CREATE POLICY "users_select_own_or_linked_club_captain"
  ON user_profiles FOR SELECT
  USING (
    auth.uid() = user_id OR  -- Users can always view their own profile
    (role = 'club_captain' AND linked_player_id = auth.uid())  -- Players can view club captain profiles linked to them
  );

-- Add comment for documentation
COMMENT ON POLICY "users_select_own_or_linked_club_captain" ON user_profiles IS 
  'Allows users to view their own profile and players to view club captain profiles linked to their player account';
