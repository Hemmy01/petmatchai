-- Allow users to archive message threads (soft-hide per user)
ALTER TABLE message_threads
  ADD COLUMN IF NOT EXISTS archived_by UUID[] DEFAULT '{}';
