-- Consumer Stripe customer anchor (Pato gate 2026-08-29, Cards wallet).
--
-- The saved-card wallet needs a Stripe customer BEFORE any subscription
-- exists: a free guest can save a card. Until now the only consumer-side
-- anchor was consumer_subscriptions.stripe_customer_id, which only comes
-- into being when someone subscribes, so a free guest had nowhere to hang
-- one. The anchor belongs on the entity, not on one of its purchases.
--
-- Cards themselves are NOT stored here and never will be: Stripe is the
-- only store for card data (no PAN, no brand/last4 cache, no drift). This
-- column is the single opaque pointer the card EFs resolve through
-- _shared/stripe-billing.ts ensureConsumerCustomer().
--
-- RLS: public.consumers is row-level-secured with consumers_select_self, so
-- this id is readable only by the consumer it belongs to. Clients never read
-- it anyway (clients call Edge Functions, never the DB).
--
-- Mock ids (`mock_cus_*`, written by consumer-web-create-subscription when
-- MOCK_SUBSCRIPTION is on) are deliberately EXCLUDED from the backfill:
-- handing one to a live Stripe key 400s, and the shared helper carries the
-- same prefix guard.

alter table public.consumers
  add column if not exists stripe_customer_id text;

comment on column public.consumers.stripe_customer_id is
  'Stripe customer id for this consumer - the single anchor for the saved-card wallet (Cards) and for subscription checkout. Opaque pointer only: card data (PAN, brand, last4, expiry, default) lives in Stripe and is NEVER cached here. Resolved through _shared/stripe-billing.ts ensureConsumerCustomer(); never write it from anywhere else. A `mock_cus_*` value is not a real customer - the helper refuses to reuse one.';

-- Backfill from the subscription rows that already carry a real customer.
-- distinct on picks the newest row per consumer; mock ids are skipped.
update public.consumers c
set stripe_customer_id = s.stripe_customer_id
from (
  select distinct on (consumer_id)
         consumer_id, stripe_customer_id
  from public.consumer_subscriptions
  where stripe_customer_id is not null
    and stripe_customer_id not like 'mock\_%'
  order by consumer_id, created_at desc
) s
where s.consumer_id = c.id
  and c.stripe_customer_id is null;

-- One consumer, one customer. Partial so the overwhelming majority of rows
-- (null, no card saved yet) are not forced unique against each other.
create unique index if not exists consumers_stripe_customer_id_key
  on public.consumers (stripe_customer_id)
  where stripe_customer_id is not null;

-- Post-flight: the column and its index must exist with the right shape, or
-- this apply aborts before the card EFs are built on top of it.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'consumers'
      and column_name = 'stripe_customer_id' and data_type = 'text'
  ) then
    raise exception 'consumers.stripe_customer_id missing or wrong shape after apply';
  end if;
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'consumers'
      and indexname = 'consumers_stripe_customer_id_key'
  ) then
    raise exception 'consumers_stripe_customer_id_key missing after apply';
  end if;
end $$;

notify pgrst, 'reload schema';
