-- Add onboarding_completed flag to user_profiles
-- Default false for new users, existing users default true (they're already in the app)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Mark all existing profiles as already onboarded (don't re-run wizard for them)
UPDATE user_profiles SET onboarding_completed = true WHERE onboarding_completed IS NULL OR onboarding_completed = false;
