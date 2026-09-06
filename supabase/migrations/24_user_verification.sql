-- User identity verification (replaces per-listing verification_requests)
-- Run in Supabase SQL editor

create table if not exists user_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  id_type text not null check (id_type in ('passport', 'national_id', 'drivers_license', 'cac_certificate')),
  id_image_url text not null,
  selfie_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists user_verif_user_idx on user_verification_requests(user_id);
create index if not exists user_verif_status_idx on user_verification_requests(status);

alter table user_verification_requests enable row level security;
drop policy if exists "Users can manage own request" on user_verification_requests;
drop policy if exists "Admin full access" on user_verification_requests;
create policy "Users can manage own request" on user_verification_requests
  for all using (auth.uid() = user_id);
create policy "Admin full access" on user_verification_requests
  for all using (true);
