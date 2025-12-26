-- Add INSERT policy for notifications table
-- This allows admins and system to create notifications for users

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Finance admins can create notifications" ON notifications;

-- Allow admins to create notifications for any user
CREATE POLICY "Admins can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'finance_admin', 'data_admin')
    )
  );

-- Allow users to create notifications for themselves (for system-generated notifications)
CREATE POLICY "Users can create own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: Service role operations bypass RLS, so no policy needed for service role

