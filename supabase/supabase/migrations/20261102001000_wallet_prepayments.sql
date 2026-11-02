-- MESITA-3097 — Wallet (a): prepaid balances (Pato, 2026-11-01: "build again
-- the wallet page to pay. Wallet is for prepayments"; gate: "Yes, Mesita
-- collects").
--
-- A guest prepays money at one place. Mesita takes it on its own Stripe
-- account and owes the place; the two settle off-platform.
--
--   wallet_purchases  one Stripe Checkout per buy (open → paid | expired)
--   wallet_entries    append-only history; a balance is the sum of a guest's
--                     entries at one place. v1 writes only 'prepay'.
--
-- The old Credits schema (credit_lots, credit_ledger) was dropped by
-- MESITA-2091; none of it comes back.

-- ── Purchases ────────────────────────────────────────────────────────────
create table public.wallet_purchases (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid references public.consumers (id) on delete set null,
  place_id uuid not null references public.places (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null default 'open' check (status in ('open', 'paid', 'expired')),
  livemode boolean not null default false,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  check ((status = 'paid') = (paid_at is not null))
);

create index wallet_purchases_open_idx on public.wallet_purchases (consumer_id) where status = 'open';

alter table public.wallet_purchases enable row level security;
revoke all on table public.wallet_purchases from public, anon, authenticated;
grant all on table public.wallet_purchases to service_role;

comment on table public.wallet_purchases is
  'MESITA-3097 Wallet: one Stripe Checkout per prepayment a guest makes at a place. open until Stripe says paid (wallet_credit_purchase) or the session expires. Mesita collects; it owes the place. EF-only.';

-- ── Entries ──────────────────────────────────────────────────────────────
-- Money records outlive what they name: a place is never deleted while a
-- guest holds money there (restrict), a deleted account leaves its rows with
-- no owner (set null), and a row is never edited: a correction is a new entry.
create table public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid references public.consumers (id) on delete set null,
  place_id uuid not null references public.places (id) on delete restrict,
  kind text not null check (kind in ('prepay')),
  amount_cents integer not null check (amount_cents <> 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  purchase_id uuid unique references public.wallet_purchases (id) on delete restrict,
  livemode boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind <> 'prepay' or (amount_cents > 0 and purchase_id is not null))
);

create index wallet_entries_owner_idx on public.wallet_entries (consumer_id, place_id, created_at desc);

alter table public.wallet_entries enable row level security;
revoke all on table public.wallet_entries from public, anon, authenticated;
grant all on table public.wallet_entries to service_role;

comment on table public.wallet_entries is
  'MESITA-3097 Wallet: append-only history of a guest''s money at a place; balance = sum(amount_cents) per (consumer, place, currency, livemode). v1 kinds: prepay (one per paid purchase). Written only by wallet_credit_purchase. EF-only.';

create or replace function public.wallet_entries_append_only()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  -- The one update allowed: a deleted account's foreign key setting
  -- consumer_id to null, nothing else changed.
  if new.consumer_id is null and old.consumer_id is not null
     and (to_jsonb(new) - 'consumer_id') = (to_jsonb(old) - 'consumer_id') then
    return new;
  end if;
  raise exception 'wallet_entries is append-only (MESITA-3097)';
end;
$function$;

create trigger wallet_entries_append_only
  before update on public.wallet_entries
  for each row execute function public.wallet_entries_append_only();

-- ── Crediting a paid purchase ────────────────────────────────────────────
-- supabase-js has no multi-statement transactions, so marking the purchase
-- paid and writing its entry is one function. Calling it twice credits once.
create or replace function public.wallet_credit_purchase(p_purchase_id uuid, p_payment_intent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
begin
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status = 'paid' then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;

  -- An expired purchase that Stripe nevertheless paid is still credited: the
  -- guest's money arrived.
  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode)
  values (v.consumer_id, v.place_id, 'prepay', v.amount_cents, v.currency, v.id, v.livemode);

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;

revoke all on function public.wallet_credit_purchase(uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_credit_purchase(uuid, text) to service_role;

comment on function public.wallet_credit_purchase(uuid, text) is
  'MESITA-3097 Wallet: marks a purchase paid and writes its prepay entry in one step; idempotent (already_paid). Service role only.';
