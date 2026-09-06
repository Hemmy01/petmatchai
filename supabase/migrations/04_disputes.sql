-- Disputes table for buyer-seller conflict resolution
create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  respondent_id uuid references profiles(id) on delete set null,
  subject text not null,
  description text,
  context text,
  status text not null default 'pending',
  resolution text,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists disputes_reporter_idx on disputes(reporter_id);
create index if not exists disputes_status_idx on disputes(status);

-- Enable RLS but allow admin service role full access
alter table disputes enable row level security;

-- Drop existing policy if re-running
drop policy if exists "Admin full access" on disputes;
create policy "Admin full access" on disputes for all using (true);
