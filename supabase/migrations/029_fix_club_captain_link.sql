-- Migration: Fix Club Captain Link for AMOS MALIK
-- This script helps identify and fix missing links between club captain and player accounts

-- Step 1: Find all club captain accounts and their links
SELECT 
  cc.user_id as club_captain_user_id,
  cc.name as club_captain_name,
  cc.email as club_captain_email,
  cc.role,
  cc.linked_player_id,
  p.user_id as player_user_id,
  p.name as player_name,
  p.email as player_email,
  p.role as player_role
FROM user_profiles cc
LEFT JOIN user_profiles p ON p.user_id = cc.linked_player_id
WHERE cc.role = 'club_captain'
ORDER BY cc.created_at DESC;

-- Step 2: Find club captain accounts without links (NULL linked_player_id)
SELECT 
  user_id,
  name,
  email,
  linked_player_id,
  created_at
FROM user_profiles
WHERE role = 'club_captain'
  AND linked_player_id IS NULL;

-- Step 3: Find player accounts that should have club captain links
-- (Look for players named AMOS MALIK or similar)
SELECT 
  user_id,
  name,
  email,
  role,
  created_at
FROM user_profiles
WHERE role = 'player'
  AND (name ILIKE '%AMOS%' OR name ILIKE '%MALIK%')
ORDER BY created_at DESC;

-- Step 4: Manual fix - Update club captain account to link to player
-- REPLACE THE VALUES BELOW WITH ACTUAL IDs FROM STEPS 1-3
-- 
-- To fix the link, run:
-- UPDATE user_profiles
-- SET linked_player_id = '<player_user_id>'  -- e.g., 'db704f7e-e891-4a25-a651-e078f01112b0'
-- WHERE user_id = '<club_captain_user_id>'   -- The club captain account user_id
--   AND role = 'club_captain';

-- Example (DO NOT RUN WITHOUT REPLACING VALUES):
-- UPDATE user_profiles
-- SET linked_player_id = 'db704f7e-e891-4a25-a651-e078f01112b0'
-- WHERE user_id = 'some-club-captain-uuid-here'
--   AND role = 'club_captain';

-- Step 5: Verify the fix
SELECT 
  cc.name as club_captain_name,
  cc.user_id as club_captain_id,
  cc.linked_player_id,
  p.name as player_name,
  p.user_id as player_id,
  CASE 
    WHEN cc.linked_player_id = p.user_id THEN '✅ Linked correctly'
    ELSE '❌ Link mismatch'
  END as link_status
FROM user_profiles cc
LEFT JOIN user_profiles p ON p.user_id = cc.linked_player_id
WHERE cc.role = 'club_captain'
  AND (cc.name ILIKE '%AMOS%' OR cc.name ILIKE '%MALIK%' 
       OR p.name ILIKE '%AMOS%' OR p.name ILIKE '%MALIK%');
