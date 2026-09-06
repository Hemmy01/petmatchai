-- Escrow-style secure payments (Paystack test mode, with app-level escrow states).
-- The platform NEVER custodies funds; it records the settlement state machine while
-- a licensed gateway (Paystack) handles the money in sandbox/test mode.
-- Lifecycle: pending -> paid_escrow -> released  (or refunded / cancelled)
-- Run this in the Supabase SQL editor.

create table if not exists public.transactions (
  id uuid default uuid_generate_v4() primary key,
  offer_id uuid references public.offers(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  buyer_id uuid references public.profiles(id) on delete cascade,
  seller_id uuid references public.profiles(id) on delete cascade,
  amount numeric not null,
  currency text not null default 'NGN',
  provider text not null default 'demo',                 -- 'paystack' | 'demo'
  reference text unique not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid_escrow', 'released', 'refunded', 'cancelled')),
  paid_at timestamptz,
  released_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_transactions_offer on public.transactions (offer_id);
create index if not exists idx_transactions_parties on public.transactions (buyer_id, seller_id);

alter table public.transactions enable row level security;

-- Buyer and seller can read their own transactions. All writes go through the
-- service-role API routes.
drop policy if exists "transactions participants read" on public.transactions;
create policy "transactions participants read" on public.transactions
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
