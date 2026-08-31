-- ============================================================================
-- 050 — Assistant Coach role
-- ============================================================================
-- Adds 'asst_coach' as a real, first-class role alongside 'coach'. The
-- Assistant Coach shares the Head Coach's dashboard and permissions (team
-- selection, match-day attendance, stats entry). Whenever either one
-- records a team selection or match-day attendance, the OTHER gets
-- notified (see lib/notify-coaches.ts) so the two never make conflicting
-- entries for the same fixture.
--
-- This migration only needs to widen the CHECK constraint on
-- user_profiles.role — every application-level permission check, dashboard
-- route, and RLS-adjacent API gate was already updated in the app code to
-- treat 'coach' and 'asst_coach' as equivalent.
-- ============================================================================

ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('player', 'coach', 'asst_coach', 'data_admin', 'finance_admin', 'admin', 'physio', 'club_captain'));
