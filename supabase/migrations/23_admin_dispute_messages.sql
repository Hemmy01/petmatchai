-- Admin-mediated dispute resolution inside the buyer/seller chat.
-- Adds a message "kind" so an admin can post instructions and a final decision
-- directly into the disputed conversation, styled distinctly for both parties.
-- Lifecycle of message_type: 'text' (normal) | 'admin_note' (admin instruction)
--                           | 'admin_decision' (final ruling that resolves the dispute)
-- Run this in the Supabase SQL editor.

alter table public.messages
  add column if not exists message_type text not null default 'text';

alter table public.messages
  drop constraint if exists messages_message_type_check;

alter table public.messages
  add constraint messages_message_type_check
  check (message_type in ('text', 'admin_note', 'admin_decision'));

comment on column public.messages.message_type is
  'text = normal party message; admin_note = admin instruction during a dispute; '
  'admin_decision = admin''s final ruling. Admin messages are posted server-side '
  '(admin is not a thread participant) and rendered distinctly for both parties.';
