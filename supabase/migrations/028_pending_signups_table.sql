-- Migration: Create table to store pending signup data
-- This allows us to store signup information before email confirmation
-- and create the profile when the user confirms their email and logs in

-- Drop table if it exists with foreign key constraint (to recreate without it)
DROP TABLE IF EXISTS pending_signups CASCADE;

CREATE TABLE pending_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL, -- No foreign key constraint to avoid issues when user doesn't exist yet
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('player', 'coach', 'data_admin', 'finance_admin', 'admin', 'physio', 'club_captain')),
  position TEXT, -- For players
  linked_player_email TEXT, -- For club_captain
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days') -- Auto-cleanup after 7 days
);

CREATE INDEX IF NOT EXISTS idx_pending_signups_user_id ON pending_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_signups_email ON pending_signups(email);
CREATE INDEX IF NOT EXISTS idx_pending_signups_expires_at ON pending_signups(expires_at);

-- Enable RLS
ALTER TABLE pending_signups ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own pending signup
CREATE POLICY "Users can view own pending signup"
  ON pending_signups FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert/update/delete (for API routes)
-- Note: This will be handled via service role in API routes, so we don't need INSERT policy for users

-- Function to clean up expired pending signups (can be run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_pending_signups()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM pending_signups
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE pending_signups IS 'Stores signup data for users who have not yet confirmed their email. Profile is created when they first log in after confirmation.';
