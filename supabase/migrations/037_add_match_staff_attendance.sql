-- Track attendance for match staff (coach, physio, team manager)
CREATE TABLE IF NOT EXISTS match_staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  attendance_status TEXT NOT NULL CHECK (attendance_status IN ('P', 'A')),
  recorded_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(match_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_match_staff_attendance_match ON match_staff_attendance(match_id);
CREATE INDEX IF NOT EXISTS idx_match_staff_attendance_staff ON match_staff_attendance(staff_id);

ALTER TABLE match_staff_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own match attendance"
  ON match_staff_attendance FOR SELECT
  USING (staff_id = auth.uid());

CREATE POLICY "Admins and coaches manage match staff attendance"
  ON match_staff_attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'coach', 'data_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'coach', 'data_admin')
    )
  );
