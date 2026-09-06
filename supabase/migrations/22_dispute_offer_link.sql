-- Link a dispute to the offer it concerns, so admins can refund the related
-- escrow payment directly when resolving the dispute.
-- Run this in the Supabase SQL editor.

alter table public.disputes
  add column if not exists offer_id uuid references public.offers(id) on delete set null;

create index if not exists disputes_offer_idx on public.disputes (offer_id);
