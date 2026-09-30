-- ============================================
-- EXPAND user_profiles.status VALUES
-- ============================================
-- The original constraint only allowed 'pending' | 'active' | 'inactive' |
-- 'injured'. Staff suspend/fire (and now player suspend/fire) therefore had to
-- collapse both actions into 'inactive', losing the distinction between a
-- temporarily suspended member and a permanently fired one after a reload.
--
-- This widens the allowed set so those states persist as themselves. Existing
-- rows are untouched (all current values remain valid members of the new set).

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_status_check;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_status_check
  CHECK (status IN ('pending', 'active', 'inactive', 'injured', 'suspended', 'fired'));
