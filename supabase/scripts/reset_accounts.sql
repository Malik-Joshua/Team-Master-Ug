-- ============================================================
-- TEAM MASTER — Reset all accounts for a clean onboarding test
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Clear pending signups (no foreign keys, safe to truncate first)
TRUNCATE TABLE pending_signups CASCADE;

-- 2. Clear all user profile data (cascades to players, messages,
--    notifications, injuries, match_stats, training_attendance, etc.)
TRUNCATE TABLE user_profiles CASCADE;

-- 3. Delete all Supabase auth users
--    (ON DELETE CASCADE on user_profiles.user_id handles the profile side)
DELETE FROM auth.users;

-- Confirm
SELECT 
  (SELECT COUNT(*) FROM auth.users)       AS auth_users_remaining,
  (SELECT COUNT(*) FROM user_profiles)    AS profiles_remaining,
  (SELECT COUNT(*) FROM pending_signups)  AS pending_signups_remaining;
