-- Account status for admin moderation: suspend / permanently disable an account.
-- Run this in the Supabase SQL editor.

alter table public.profiles
  add column if not exists status text not null default 'active';

-- Constrain to known values (drop first so re-running is safe).
alter table public.profiles
  drop constraint if exists profiles_status_check;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('active', 'suspended', 'disabled'));

comment on column public.profiles.status is
  'active | suspended | disabled — set by admins to control account access. '
  'Suspended/disabled accounts are also banned at the Supabase Auth level.';

-- Optional: index for filtering moderated accounts.
create index if not exists idx_profiles_status on public.profiles (status);
