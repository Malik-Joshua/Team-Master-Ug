-- Add action_url field to notifications table for linking to specific items
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS action_url TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_action_url ON notifications(action_url);

