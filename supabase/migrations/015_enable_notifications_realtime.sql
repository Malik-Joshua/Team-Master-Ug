-- Enable Realtime for notifications table
-- This allows real-time updates when new notifications are created

-- Enable Realtime publication for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Note: Realtime is enabled by default in Supabase, but this ensures
-- the notifications table is included in the realtime publication

