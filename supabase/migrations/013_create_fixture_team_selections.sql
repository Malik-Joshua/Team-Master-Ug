-- Create fixture_team_selections table if it doesn't exist
-- This migration ensures the table exists for team selection functionality

-- Check if the table exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'fixture_team_selections'
  ) THEN
    -- Create the table
    CREATE TABLE fixture_team_selections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
      player_id UUID REFERENCES players(user_id) ON DELETE CASCADE NOT NULL,
      position TEXT, -- Optional: specific position for this fixture
      jersey_number INTEGER, -- Optional: jersey number for this fixture
      is_starting BOOLEAN DEFAULT true, -- Whether player is in starting lineup
      is_substitute BOOLEAN DEFAULT false, -- Whether player is a substitute
      selected_by UUID REFERENCES user_profiles(user_id), -- Coach who selected the team
      notes TEXT, -- Optional notes about the selection
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(match_id, player_id)
    );

    -- Create indexes
    CREATE INDEX idx_fixture_team_selections_match ON fixture_team_selections(match_id);
    CREATE INDEX idx_fixture_team_selections_player ON fixture_team_selections(player_id);
    CREATE INDEX idx_fixture_team_selections_selected_by ON fixture_team_selections(selected_by);

    -- Enable RLS
    ALTER TABLE fixture_team_selections ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Coaches can view team selections" ON fixture_team_selections;
    DROP POLICY IF EXISTS "Coaches can create team selections" ON fixture_team_selections;
    DROP POLICY IF EXISTS "Coaches can update team selections" ON fixture_team_selections;
    DROP POLICY IF EXISTS "Coaches can delete team selections" ON fixture_team_selections;

    -- RLS Policies
    -- Coaches can view all team selections
    CREATE POLICY "Coaches can view team selections"
      ON fixture_team_selections FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid() AND role IN ('coach', 'admin', 'data_admin', 'player', 'physio')
        )
      );

    -- Only coaches and admins can insert team selections
    CREATE POLICY "Coaches can create team selections"
      ON fixture_team_selections FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
        )
      );

    -- Only coaches and admins can update team selections
    CREATE POLICY "Coaches can update team selections"
      ON fixture_team_selections FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
        )
      );

    -- Only coaches and admins can delete team selections
    CREATE POLICY "Coaches can delete team selections"
      ON fixture_team_selections FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
        )
      );

    -- Create trigger function if it doesn't exist
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create trigger to update updated_at
    DROP TRIGGER IF EXISTS update_fixture_team_selections_updated_at ON fixture_team_selections;
    CREATE TRIGGER update_fixture_team_selections_updated_at
      BEFORE UPDATE ON fixture_team_selections
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    RAISE NOTICE 'Table fixture_team_selections created successfully';
  ELSE
    RAISE NOTICE 'Table fixture_team_selections already exists';
  END IF;
END $$;

