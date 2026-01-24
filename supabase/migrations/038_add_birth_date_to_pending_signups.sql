-- Add birth_date field to pending_signups table
ALTER TABLE pending_signups
ADD COLUMN IF NOT EXISTS birth_date DATE;

COMMENT ON COLUMN pending_signups.birth_date IS 'User birth date captured at signup for later profile creation';

CREATE INDEX IF NOT EXISTS idx_pending_signups_birth_date ON pending_signups(birth_date);
