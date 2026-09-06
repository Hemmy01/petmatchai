-- Enable Realtime on messages and notifications tables
-- Run this in the Supabase SQL Editor, then go to:
--   Database → Replication → Tables → enable messages and notifications

ALTER TABLE messages REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
