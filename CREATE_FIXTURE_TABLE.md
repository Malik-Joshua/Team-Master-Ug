# Fix: Create fixture_team_selections Table

The `fixture_team_selections` table is missing from your Supabase database. Follow these steps to create it:

## Option 1: Run SQL in Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the SQL from `supabase/migrations/013_create_fixture_team_selections.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)

## Option 2: Quick SQL Script

Copy and paste this SQL directly into Supabase SQL Editor:

```sql
-- Create fixture_team_selections table
CREATE TABLE IF NOT EXISTS fixture_team_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(user_id) ON DELETE CASCADE NOT NULL,
  position TEXT,
  jersey_number INTEGER,
  is_starting BOOLEAN DEFAULT true,
  is_substitute BOOLEAN DEFAULT false,
  selected_by UUID REFERENCES user_profiles(user_id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fixture_team_selections_match ON fixture_team_selections(match_id);
CREATE INDEX IF NOT EXISTS idx_fixture_team_selections_player ON fixture_team_selections(player_id);
CREATE INDEX IF NOT EXISTS idx_fixture_team_selections_selected_by ON fixture_team_selections(selected_by);

-- Enable RLS
ALTER TABLE fixture_team_selections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Coaches can view team selections" ON fixture_team_selections;
DROP POLICY IF EXISTS "Coaches can create team selections" ON fixture_team_selections;
DROP POLICY IF EXISTS "Coaches can update team selections" ON fixture_team_selections;
DROP POLICY IF EXISTS "Coaches can delete team selections" ON fixture_team_selections;

-- RLS Policies
CREATE POLICY "Coaches can view team selections"
  ON fixture_team_selections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin', 'data_admin', 'player', 'physio')
    )
  );

CREATE POLICY "Coaches can create team selections"
  ON fixture_team_selections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can update team selections"
  ON fixture_team_selections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('coach', 'admin')
    )
  );

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

-- Create trigger
DROP TRIGGER IF EXISTS update_fixture_team_selections_updated_at ON fixture_team_selections;
CREATE TRIGGER update_fixture_team_selections_updated_at
  BEFORE UPDATE ON fixture_team_selections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Verification

After running the SQL, verify the table was created:

```sql
SELECT * FROM fixture_team_selections LIMIT 1;
```

If this query runs without errors, the table has been created successfully.

## Next Steps

After creating the table, try saving a team selection again. The error should be resolved.

