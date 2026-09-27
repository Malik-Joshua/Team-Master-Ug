-- ============================================
-- TRAINING STAFF ATTENDANCE
-- ============================================
-- Staff attendance at matches has been tracked since migration 037
-- (match_staff_attendance), but training sessions only ever recorded PLAYER
-- attendance. That left every staff-facing "training sessions attended" stat
-- with nothing real to read from, so each dashboard approximated it
-- differently: coaches counted sessions they OWNED (training_sessions.coach_id)
-- and the physio counted ALL sessions in the club. Neither is attendance.
--
-- This table is the training-session analogue of match_staff_attendance, so
-- those stats can be derived from actual recorded presence.

CREATE TABLE IF NOT EXISTS training_staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES user_profiles(user_id) ON DELETE CASCADE NOT NULL,
  attendance_status TEXT NOT NULL CHECK (attendance_status IN ('P', 'A')),
  recorded_by UUID REFERENCES user_profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_training_staff_attendance_session ON training_staff_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_training_staff_attendance_staff ON training_staff_attendance(staff_id);

ALTER TABLE training_staff_attendance ENABLE ROW LEVEL SECURITY;

-- Any staff member can read their own attendance (needed so their own
-- dashboard stat resolves without an elevated API round-trip).
CREATE POLICY "Staff can view own training attendance"
  ON training_staff_attendance FOR SELECT
  USING (staff_id = auth.uid());

-- Everyone who can already see the training attendance sheet can read the
-- staff rows on it too, so the recording form can prefill existing values.
CREATE POLICY "Staff can view training staff attendance"
  ON training_staff_attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'coach', 'asst_coach', 'data_admin', 'physio')
    )
  );

-- Only the roles that record training attendance may write it. Mirrors the
-- role list already enforced by app/api/training/attendance.
CREATE POLICY "Admins and coaches manage training staff attendance"
  ON training_staff_attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'coach', 'asst_coach', 'data_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'coach', 'asst_coach', 'data_admin')
    )
  );
