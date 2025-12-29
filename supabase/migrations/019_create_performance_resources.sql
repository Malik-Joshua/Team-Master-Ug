-- Create performance_resources table
-- Allows admins and coaches to share diet plans, gym programmes, and play/position information with players

CREATE TABLE IF NOT EXISTS performance_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('diet_plan', 'gym_programme', 'play_info', 'position_info')),
  content TEXT NOT NULL, -- Main content (can be markdown or HTML)
  attachment_url TEXT, -- Optional file attachment URL
  created_by UUID REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_performance_resources_type ON performance_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_performance_resources_active ON performance_resources(is_active);
CREATE INDEX IF NOT EXISTS idx_performance_resources_created_by ON performance_resources(created_by);

-- Enable RLS
ALTER TABLE performance_resources ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Players can view active resources
CREATE POLICY "Players can view active performance resources"
  ON performance_resources FOR SELECT
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'player'
    )
  );

-- Admins and coaches can view all resources
CREATE POLICY "Admins and coaches can view all performance resources"
  ON performance_resources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

-- Only admins and coaches can create resources
CREATE POLICY "Admins and coaches can create performance resources"
  ON performance_resources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

-- Only admins and coaches can update resources
CREATE POLICY "Admins and coaches can update performance resources"
  ON performance_resources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

-- Only admins and coaches can delete resources
CREATE POLICY "Admins and coaches can delete performance resources"
  ON performance_resources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coach')
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_performance_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_performance_resources_updated_at
  BEFORE UPDATE ON performance_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_performance_resources_updated_at();

