-- Club settings table — stores branding, sport config, and onboarding data
CREATE TABLE IF NOT EXISTS club_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE UNIQUE,
  primary_color TEXT NOT NULL DEFAULT '#2563EB',
  secondary_color TEXT NOT NULL DEFAULT '#DC2626',
  club_nickname TEXT,
  year_founded INTEGER,
  website TEXT,
  badge_url TEXT,
  league TEXT,
  season_start_month TEXT,
  multiple_teams BOOLEAN DEFAULT false,
  teams TEXT[],
  squad_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_settings_admin ON club_settings(admin_user_id);

ALTER TABLE club_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read club settings (all staff need it for theming)
CREATE POLICY "Authenticated users can read club settings"
  ON club_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only the admin who created the settings can update them
CREATE POLICY "Admin can update own club settings"
  ON club_settings FOR ALL
  USING (auth.uid() = (SELECT user_id FROM user_profiles WHERE user_id = admin_user_id LIMIT 1));
