-- Fix foreign key constraint for fixture_team_selections.player_id
-- Change from referencing players(user_id) to user_profiles(user_id)
-- This ensures all players (who have user_profiles entries) can be selected

-- Drop the existing foreign key constraint
ALTER TABLE fixture_team_selections
  DROP CONSTRAINT IF EXISTS fixture_team_selections_player_id_fkey;

-- Add new foreign key constraint referencing user_profiles
ALTER TABLE fixture_team_selections
  ADD CONSTRAINT fixture_team_selections_player_id_fkey
  FOREIGN KEY (player_id)
  REFERENCES user_profiles(user_id)
  ON DELETE CASCADE;

