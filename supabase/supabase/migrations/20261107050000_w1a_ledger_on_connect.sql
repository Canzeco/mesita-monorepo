-- MESITA-3302 — W1a: the ledger and catalog on Connect (Pato, 2026-11-06:
-- "connect the Stripe account… make the website functional, not payments
-- yet"; the /autoplan gate of 2026-11-07 approved the money plan).
--
-- Money lands on the place's own Stripe Connect account as direct charges;
-- Mesita's fee is the application fee; the place holds the credit. This
-- migration lays the ledger every later wave writes to. No wave sells yet.
--
--   wallet_purchases        one Checkout per voucher bought (W1b sells); gains
--                           the connected account, the catalog key, the bonus,
--                           the fee, and a stored refund baseline.
--   wallet_entries          append-only history; kinds prepay · voucher ·
--                           bonus · cashback · spend · reversal; Pending until
--                           available_at.
--   wallet_payments         one Mesita payment (W2a credit-only, W2b mixed):
--                           credit part, card part, tip, fee, cashback, refunds.
--   wallet_refund_attempts  every refund Mesita starts, one row per attempt
--                           (its id is the Stripe Idempotency-Key).
--   place_charges           the waiter's charge (W2c): a 4-digit code and a
--                           token, hashed, ten minutes.
--   place_charge_tries      wrong place codes on open, per (place, address).
--   stripe_connect_events   every Connect webhook event the receiver (W2b)
--                           accepted; a duplicate id is a replay. Not
--                           `stripe_events`: that name is in the First Stage
--                           dropped set (schema_invariants, dropped-table-refs).
--
-- The free-amount prepay on Mesita's own account (consumer-web-start-prepay)
-- retires with this PR; its tables held 0 rows on 2026-11-07, so
-- stripe_account_id is NOT NULL from the start. The guard below refuses the
-- apply if a row appeared since. EF-only tables throughout: RLS on, no
-- policies, client roles hold nothing.

-- ── 0. Guard: the old prepay rows are gone ─────────────────────────────────
do $$
begin
  if (select count(*) from public.wallet_purchases) > 0
     or (select count(*) from public.wallet_entries) > 0 then
    raise exception 'wallet_purchases or wallet_entries hold rows; W1a (MESITA-3302) assumed 0 and refuses to delete them';
  end if;
end $$;

-- ── 1. Purchases: on the connected account, from the catalog ───────────────
alter table public.wallet_purchases
  add column stripe_account_id text not null,
  add column application_fee_cents integer not null default 0 check (application_fee_cents >= 0),
  add column voucher text check (voucher is null or voucher in (
    'voucher_200', 'voucher_1000', 'voucher_5000', 'voucher_welcome', 'voucher_story', 'voucher_vip')),
  add column bonus_cents integer not null default 0 check (bonus_cents >= 0),
  add column refunded_cents integer not null default 0 check (refunded_cents >= 0),
  add column uncovered_cents integer not null default 0 check (uncovered_cents >= 0),
  add column request_id uuid,
  add column settle_tries integer not null default 0,
  add column stripe_error text;

alter table public.wallet_purchases add constraint wallet_purchases_refunded_within_amount
  check (refunded_cents <= amount_cents);

-- The status set grows; the paid_at rule follows the statuses that keep a
-- paid moment. The original constraints were unnamed, so they are found by
-- what they say.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.wallet_purchases'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) like '%status%' or pg_get_constraintdef(oid) like '%paid_at%')
  loop
    execute format('alter table public.wallet_purchases drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.wallet_purchases add constraint wallet_purchases_status_chk
  check (status in ('opening', 'open', 'paid', 'failed', 'expired', 'refunded', 'partly_refunded', 'needs_review'));
alter table public.wallet_purchases add constraint wallet_purchases_paid_at_chk
  check ((status in ('paid', 'refunded', 'partly_refunded', 'needs_review')) = (paid_at is not null));

-- A client retry carries the same request_id and finds its row.
create unique index wallet_purchases_request_idx
  on public.wallet_purchases (consumer_id, request_id) where request_id is not null;

-- Welcome is once per guest per place, enforced where two buys can race.
create unique index wallet_purchases_welcome_once_idx
  on public.wallet_purchases (consumer_id, place_id)
  where voucher = 'voucher_welcome' and status not in ('expired', 'failed');

drop index if exists public.wallet_purchases_open_idx;
create index wallet_purchases_open_idx on public.wallet_purchases (consumer_id) where status in ('opening', 'open');
create index wallet_purchases_settle_idx on public.wallet_purchases (created_at) where status in ('opening', 'open');

comment on table public.wallet_purchases is
  'MESITA-3302 Wallet: one Stripe Checkout per voucher a guest buys at a place, on the place''s connected account (stripe_account_id) with Mesita''s fee as the application fee. opening → open → paid | failed | expired; refunds move it to refunded, partly_refunded or needs_review and store the cumulative refunded_cents. EF-only.';

-- ── 2. Payments: a Mesita payment at a place ───────────────────────────────
create table public.wallet_payments (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid references public.consumers (id) on delete set null,
  place_id uuid not null references public.places (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  credit_cents integer not null default 0 check (credit_cents >= 0),
  card_cents integer not null default 0 check (card_cents >= 0),
  tip_cents integer not null default 0 check (tip_cents >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null default 'opening',
  -- Null on a credit-only payment; the connected account on a card part.
  stripe_account_id text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  application_fee_cents integer not null default 0 check (application_fee_cents >= 0),
  cashback_cents integer not null default 0 check (cashback_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  uncovered_cents integer not null default 0 check (uncovered_cents >= 0),
  ticket text,
  request_id uuid,
  livemode boolean not null default false,
  settle_tries integer not null default 0,
  stripe_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint wallet_payments_status_chk
    check (status in ('opening', 'open', 'paid', 'failed', 'expired', 'refunded', 'partly_refunded', 'needs_review')),
  constraint wallet_payments_paid_at_chk
    check ((status in ('paid', 'refunded', 'partly_refunded', 'needs_review')) = (paid_at is not null)),
  constraint wallet_payments_parts_chk check (amount_cents = credit_cents + card_cents),
  constraint wallet_payments_card_needs_account_chk check (card_cents = 0 or stripe_account_id is not null),
  constraint wallet_payments_refunded_within_card_chk check (refunded_cents <= card_cents)
);

create unique index wallet_payments_request_idx
  on public.wallet_payments (consumer_id, request_id) where request_id is not null;
create index wallet_payments_open_idx on public.wallet_payments (consumer_id, place_id) where status in ('opening', 'open');
create index wallet_payments_settle_idx on public.wallet_payments (created_at) where status in ('opening', 'open');
create index wallet_payments_place_idx on public.wallet_payments (place_id, created_at desc);

alter table public.wallet_payments enable row level security;
revoke all on table public.wallet_payments from public, anon, authenticated;
grant all on table public.wallet_payments to service_role;

comment on table public.wallet_payments is
  'MESITA-3302 Wallet: one Mesita payment at a place: credit_cents from the guest''s balance (held while opening/open, spent on paid), card_cents charged on the place''s connected account (direct charge, application_fee_cents to Mesita), tip_cents by card only. Refunds store the cumulative refunded_cents of the card part. EF-only.';

-- ── 3. Entries: six kinds, Pending until available_at ──────────────────────
alter table public.wallet_entries
  add column payment_id uuid references public.wallet_payments (id) on delete restrict,
  add column available_at timestamptz not null default now();

do $$
declare c record;
begin
  for c in
    select conname, contype from pg_constraint
    where conrelid = 'public.wallet_entries'::regclass
      and ((contype = 'u' and pg_get_constraintdef(oid) like '%purchase_id%')
        or (contype = 'c' and (pg_get_constraintdef(oid) like '%kind%' or pg_get_constraintdef(oid) like '%purchase_id%')))
  loop
    execute format('alter table public.wallet_entries drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.wallet_entries add constraint wallet_entries_kind_chk
  check (kind in ('prepay', 'voucher', 'bonus', 'cashback', 'spend', 'reversal'));
-- What each kind must name, and its sign. Spends and reversals take money
-- away; everything else gives it.
alter table public.wallet_entries add constraint wallet_entries_kind_shape_chk check (
  case kind
    when 'prepay' then amount_cents > 0 and purchase_id is not null and payment_id is null
    when 'voucher' then amount_cents > 0 and purchase_id is not null and payment_id is null
    when 'bonus' then amount_cents > 0 and purchase_id is not null and payment_id is null
    when 'cashback' then amount_cents > 0 and payment_id is not null and purchase_id is null
    when 'spend' then amount_cents < 0 and payment_id is not null and purchase_id is null
    when 'reversal' then amount_cents < 0 and (purchase_id is not null or payment_id is not null)
    else false
  end
);

create index wallet_entries_available_idx on public.wallet_entries (consumer_id, place_id, available_at);
create index wallet_entries_purchase_idx on public.wallet_entries (purchase_id) where purchase_id is not null;
create index wallet_entries_payment_idx on public.wallet_entries (payment_id) where payment_id is not null;

comment on table public.wallet_entries is
  'MESITA-3302 Wallet: append-only history of a guest''s credit at a place. Kinds: prepay (legacy), voucher and bonus (a paid purchase), cashback (a paid card part), spend (a payment''s credit part, negative), reversal (a refund, negative). An entry is Pending until available_at. balance = wallet_balance(). Written only by the wallet_* functions. EF-only.';

-- ── 4. Refund attempts ─────────────────────────────────────────────────────
create table public.wallet_refund_attempts (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid references public.wallet_purchases (id) on delete restrict,
  payment_id uuid references public.wallet_payments (id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  stripe_refund_id text unique,
  error_code text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_refund_attempts_one_target_chk
    check ((purchase_id is not null) <> (payment_id is not null))
);

alter table public.wallet_refund_attempts enable row level security;
revoke all on table public.wallet_refund_attempts from public, anon, authenticated;
grant all on table public.wallet_refund_attempts to service_role;

comment on table public.wallet_refund_attempts is
  'MESITA-3302 Wallet: every refund Mesita starts on a connected account, one row per attempt; the row id is the Stripe Idempotency-Key, so a retry after a timeout never refunds twice. EF-only.';

-- ── 5. The waiter''s charge and its tries (W2c writes them) ─────────────────
create table public.place_charges (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  code_hash text not null,
  token_hash text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  expires_at timestamptz not null,
  payment_id uuid references public.wallet_payments (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- A 4-digit code is unique among a place's open charges.
create unique index place_charges_open_code_idx
  on public.place_charges (place_id, code_hash) where paid_at is null;
create index place_charges_expiry_idx on public.place_charges (expires_at) where paid_at is null;

alter table public.place_charges enable row level security;
revoke all on table public.place_charges from public, anon, authenticated;
grant all on table public.place_charges to service_role;

comment on table public.place_charges is
  'MESITA-3302 (written by W2c): the waiter''s charge on visit.mesita.ai: a 4-digit code and a 128-bit token, both stored hashed, an amount, ten minutes. payment_id binds it to the guest''s payment; a paid charge keeps paid_at 24 h, an unpaid expired one is deleted at once. EF-only.';

create table public.place_charge_tries (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places (id) on delete cascade,
  addr_hash text not null,
  tried_at timestamptz not null default now()
);

create index place_charge_tries_idx on public.place_charge_tries (place_id, addr_hash, tried_at desc);

alter table public.place_charge_tries enable row level security;
revoke all on table public.place_charge_tries from public, anon, authenticated;
grant all on table public.place_charge_tries to service_role;

comment on table public.place_charge_tries is
  'MESITA-3302 (written by W2c): a wrong place code typed to open a charge, keyed by place and the hashed client address; six in 10 minutes lock that pair, 50 per place is the second line. Not place_code_tries: that name was dropped by MESITA-3299. EF-only.';

-- ── 6. Stripe Connect events: the replay guard ─────────────────────────────
create table public.stripe_connect_events (
  id text primary key,
  account text,
  type text not null,
  created integer not null,
  received_at timestamptz not null default now()
);

create index stripe_connect_events_account_idx on public.stripe_connect_events (account, created desc);

alter table public.stripe_connect_events enable row level security;
revoke all on table public.stripe_connect_events from public, anon, authenticated;
grant all on table public.stripe_connect_events to service_role;

comment on table public.stripe_connect_events is
  'MESITA-3302 (written by W2b''s receiver): every Connect webhook event accepted, by Stripe''s event id; inserted before processing, so a duplicate id is a replay and is ignored. EF-only.';

alter table public.place_payment_accounts
  add column last_event_created integer;

comment on column public.place_payment_accounts.last_event_created is
  'MESITA-3302: Stripe''s created of the last account.updated applied; an older event is acknowledged and ignored (Stripe does not order delivery).';

-- ── 7. Functions ───────────────────────────────────────────────────────────
-- Every money move on one (guest, place) pair serializes on this lock, so a
-- settle from the receiver, the cron and a wallet read never race.
create or replace function public.wallet_lock(p_consumer_id uuid, p_place_id uuid)
 returns void
 language sql
 set search_path to 'public'
as $function$
  select pg_advisory_xact_lock(hashtextextended(coalesce(p_consumer_id::text, '') || ':' || p_place_id::text, 0));
$function$;

revoke all on function public.wallet_lock(uuid, uuid) from public, anon, authenticated;
grant execute on function public.wallet_lock(uuid, uuid) to service_role;

-- The balance at one place: what can be spent now, what is still Pending,
-- and what an open mixed payment holds. p_now lets a test move the clock.
create or replace function public.wallet_balance(
  p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_now timestamptz default now())
 returns table (available_cents integer, pending_cents integer, held_cents integer, spendable_cents integer)
 language sql
 stable
 set search_path to 'public'
as $function$
  with e as (
    select
      coalesce(sum(amount_cents) filter (where available_at <= p_now), 0)::integer as available_cents,
      coalesce(sum(amount_cents) filter (where available_at > p_now), 0)::integer as pending_cents
    from public.wallet_entries
    where consumer_id = p_consumer_id and place_id = p_place_id
      and currency = p_currency and livemode = p_livemode
  ),
  h as (
    select coalesce(sum(credit_cents), 0)::integer as held_cents
    from public.wallet_payments
    where consumer_id = p_consumer_id and place_id = p_place_id
      and currency = p_currency and livemode = p_livemode
      and status in ('opening', 'open')
  )
  select e.available_cents, e.pending_cents, h.held_cents,
         greatest(e.available_cents - h.held_cents, 0) as spendable_cents
  from e, h;
$function$;

revoke all on function public.wallet_balance(uuid, uuid, text, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_balance(uuid, uuid, text, boolean, timestamptz) to service_role;

comment on function public.wallet_balance(uuid, uuid, text, boolean, timestamptz) is
  'MESITA-3302 Wallet: available = entries whose available_at has passed, pending = the rest, held = credit of open payments, spendable = available minus held, never negative. Service role only.';

-- Crediting a paid purchase: marks it paid and writes its voucher (or legacy
-- prepay) entry plus its bonus, both Pending until p_available_at. Calling
-- it twice credits once. Replaces the two-argument MESITA-3097 function.
drop function if exists public.wallet_credit_purchase(uuid, text);

create or replace function public.wallet_credit_purchase(
  p_purchase_id uuid, p_payment_intent text, p_available_at timestamptz default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_kind text;
  v_at timestamptz := coalesce(p_available_at, now());
begin
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  -- An expired or failed purchase that Stripe nevertheless paid is still
  -- credited: the guest's money arrived.
  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  v_kind := case when v.voucher is null then 'prepay' else 'voucher' end;
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, v_at);
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;

revoke all on function public.wallet_credit_purchase(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_credit_purchase(uuid, text, timestamptz) to service_role;

comment on function public.wallet_credit_purchase(uuid, text, timestamptz) is
  'MESITA-3302 Wallet: marks a purchase paid and writes its voucher (or prepay) entry and its bonus, Pending until p_available_at; idempotent (already_paid). Service role only.';

-- A refund seen in Stripe, as a cumulative amount_refunded. The delta against
-- the stored baseline is what this call applies, so the receiver, the cron
-- and a wallet read can all deliver the same event. Credit is reversed at
-- most up to what the guest still holds at the place (Pending first, then
-- Available); what cannot be reversed is written as uncovered_cents and the
-- purchase reads needs_review.
create or replace function public.wallet_refund_purchase(p_purchase_id uuid, p_amount_refunded integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_new_refunded integer;
  v_delta integer;
  v_target integer;
  v_done integer;
  v_to_reverse integer;
  v_unspent integer;
  v_reversed integer;
  v_status text;
begin
  if p_amount_refunded is null or p_amount_refunded < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status not in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  v_new_refunded := least(p_amount_refunded, v.amount_cents);
  v_delta := v_new_refunded - v.refunded_cents;
  if v_delta <= 0 then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied', 'refunded_cents', v.refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  -- What should be gone in total once this refund is applied: the refunded
  -- principal plus the bonus's share of it (all of the bonus on a full
  -- refund). What is already gone: earlier reversals plus what could not be
  -- reversed. The difference is this call's reversal, whatever order the
  -- events arrived in.
  v_target := v_new_refunded + (v.bonus_cents * v_new_refunded) / v.amount_cents;
  v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                       where purchase_id = v.id and kind = 'reversal'), 0) + v.uncovered_cents;
  v_to_reverse := greatest(v_target - v_done, 0);

  select greatest(available_cents + pending_cents, 0) into v_unspent
    from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode, now());
  v_reversed := least(v_to_reverse, v_unspent);

  if v_reversed > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, now());
  end if;

  v_status := case
    when v.uncovered_cents + (v_to_reverse - v_reversed) > 0 then 'needs_review'
    when v_new_refunded >= v.amount_cents then 'refunded'
    else 'partly_refunded'
  end;
  update public.wallet_purchases
     set refunded_cents = v_new_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;

revoke all on function public.wallet_refund_purchase(uuid, integer) from public, anon, authenticated;
grant execute on function public.wallet_refund_purchase(uuid, integer) to service_role;

comment on function public.wallet_refund_purchase(uuid, integer) is
  'MESITA-3302 Wallet: applies Stripe''s cumulative amount_refunded to a purchase: only the delta above refunded_cents is reversed (bonus first), capped at the credit the guest still holds; the rest is uncovered_cents and needs_review. Replay-safe. Service role only.';

-- A refund of a payment''s card part. A full refund reverses the cashback and
-- the payment reads refunded; a partial leaves the cashback and reads
-- partly_refunded. The fee stays as charged.
create or replace function public.wallet_refund_payment(p_payment_id uuid, p_amount_refunded integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_new_refunded integer;
  v_delta integer;
  v_full boolean;
  v_done integer;
  v_to_reverse integer := 0;
  v_unspent integer;
  v_reversed integer := 0;
  v_status text;
begin
  if p_amount_refunded is null or p_amount_refunded < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status not in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  v_new_refunded := least(p_amount_refunded, v.card_cents);
  v_delta := v_new_refunded - v.refunded_cents;
  if v_delta <= 0 then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied', 'refunded_cents', v.refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  v_full := v_new_refunded >= v.card_cents;

  -- A full refund takes the cashback back, up to what the guest still holds;
  -- a partial leaves it. Earlier reversals and uncovered cents count as done.
  if v_full and v.cashback_cents > 0 then
    v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                         where payment_id = v.id and kind = 'reversal'), 0) + v.uncovered_cents;
    v_to_reverse := greatest(v.cashback_cents - v_done, 0);
    if v_to_reverse > 0 then
      select greatest(available_cents + pending_cents, 0) into v_unspent
        from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode, now());
      v_reversed := least(v_to_reverse, v_unspent);
      if v_reversed > 0 then
        insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
        values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, now());
      end if;
    end if;
  end if;

  v_status := case
    when v.uncovered_cents + (v_to_reverse - v_reversed) > 0 then 'needs_review'
    when v_full then 'refunded'
    else 'partly_refunded'
  end;

  update public.wallet_payments
     set refunded_cents = v_new_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'reversed_cents', v_reversed, 'status', v_status);
end;
$function$;

revoke all on function public.wallet_refund_payment(uuid, integer) from public, anon, authenticated;
grant execute on function public.wallet_refund_payment(uuid, integer) to service_role;

comment on function public.wallet_refund_payment(uuid, integer) is
  'MESITA-3302 Wallet: applies Stripe''s cumulative amount_refunded to a payment''s card part: a full refund reverses its cashback (capped at what the guest still holds) and reads refunded; a partial reads partly_refunded and keeps the cashback. The fee stays. Replay-safe. Service role only.';

-- The place code, checked by hash. W2c's open-charge proves the place with it.
create or replace function public.place_code_check(p_place_id uuid, p_hash text)
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public.place_codes where place_id = p_place_id and code_hash = p_hash);
$function$;

revoke all on function public.place_code_check(uuid, text) from public, anon, authenticated;
grant execute on function public.place_code_check(uuid, text) to service_role;

-- ── 8. Post-flight ─────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  foreach t in array array[
    'wallet_purchases', 'wallet_entries', 'wallet_payments', 'wallet_refund_attempts',
    'place_charges', 'place_charge_tries', 'stripe_connect_events', 'place_codes'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relrowsecurity
    ) then
      raise exception '% missing or RLS off after apply', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception '% must have no policies', t;
    end if;
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'wallet_purchases_status_chk')
     or not exists (select 1 from pg_constraint where conname = 'wallet_purchases_paid_at_chk')
     or not exists (select 1 from pg_constraint where conname = 'wallet_entries_kind_shape_chk') then
    raise exception 'the rewritten wallet constraints are missing after apply';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'wallet_credit_purchase' and p.pronargs = 2) then
    raise exception 'the two-argument wallet_credit_purchase survived the apply';
  end if;
end $$;
