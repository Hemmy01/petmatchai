-- Link a message thread to its dispute state so disputed chats can be moved to a
-- separate "under review" section in the inbox and returned to normal once the
-- admin resolves the conflict.
-- Lifecycle: null (normal) -> 'open' (under review) -> 'resolved'
-- Run this in the Supabase SQL editor.

alter table public.message_threads
  add column if not exists dispute_status text;

create index if not exists message_threads_dispute_idx
  on public.message_threads (dispute_status);
