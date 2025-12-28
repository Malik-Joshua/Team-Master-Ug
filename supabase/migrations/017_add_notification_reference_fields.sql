-- Add reference_id and reference_type fields to notifications table
-- This allows notifications to be linked to specific messages, tasks, etc.
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS reference_id UUID,
ADD COLUMN IF NOT EXISTS reference_type TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_reference_id ON notifications(reference_id);

