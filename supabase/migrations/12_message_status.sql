-- Per-message delivery status: adds a "delivered" timestamp alongside is_read (seen).
-- Message lifecycle for the sender: sending → sent → delivered → seen (and "not sent" on failure).
-- Run this in the Supabase SQL editor.

alter table public.messages
  add column if not exists delivered_at timestamptz;

-- Speeds up unread counts per thread.
create index if not exists idx_messages_thread_unread
  on public.messages (thread_id, is_read);
