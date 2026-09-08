-- Credits become an instrument: org-scoped lots and an append-only ledger
-- (MESITA-1671, Pato gate 2026-09-08).
--
-- There was no table. `cashback_ledger` was dropped on 2026-06-06 with "Remove
-- the cashback / wallet model entirely. Mesita is discounts-only", and Pay ›
-- Wallet has run on a browser emulator ever since. This is the money.
--
-- ORG-SCOPED, not place-scoped. Notion Main: "Every Credit is org level: it
-- spends at any of that organization's places and lives in one wallet." The
-- money layer is already shaped this way — the merchant of record is the
-- ORGANIZATION (MESITA-1545, organization_payment_accounts), and the guest's
-- cloned Stripe customer is cached per organization too.
--
-- LOTS, NOT A BALANCE. One row per purchase, because three things need it and
-- none of them falls out of a single number: the hold gives each purchase its
-- own activation time, so the Wallet shows one countdown per lot; expiry runs
-- from each top-up; and a gift will carry its origin's activation rather than
-- resetting it.
--
-- BALANCE IS DERIVED, AND `spent_cents` IS NOT A CACHE OF IT. The instinct to
-- store no aggregate at all is right about the ORG total and wrong about the
-- lot: a CHECK sees one row, and `sum(ledger) >= 0` is a cross-row aggregate
-- Postgres cannot express declaratively, so a purely derived balance has
-- NOTHING at the database level refusing an over-spend. `spent_cents` is a
-- CONSTRAINT ANCHOR, written in the same statement as its ledger row, and
-- pgTAP pins it equal to the ledger's own sum. It is also the O(1) read the
-- spend path needs so it does not re-aggregate a lot's whole history forever.
-- There is deliberately no balance column anywhere, and the post-flight below
-- asserts that.
--
-- TWO DELTAS PER ENTRY, not one signed integer. A single number can never say,
-- retroactively, whether a spend consumed principal or bonus — and both live
-- questions need that answer permanently: "expire only the bonus, never the
-- principal" is on the table for the expiry decision, and "whose money is
-- this" is the obligor question that blocks spend-at-table. Retrofitting it
-- later is a data migration over live money.
--
-- NO GIFTS TABLE HERE, DELIBERATELY. Gifting is issuance-only (Pato,
-- 2026-09-08): you buy a balance for someone else, and moving credits out of a
-- balance you already hold is never built. But whether a purchased-then-gifted
-- balance is a "transfer between consumers" — one of the four banned states
-- MESITA-1380 calls "the load-bearing limited-network exclusion" — is a
-- question for payments counsel (MESITA-1680), and the answer changes the gift
-- shape. So `credit_gifts` lands with MESITA-1677, after that memo. What is
-- here is what counsel cannot move: `consumer_id` is NULLABLE so an unclaimed
-- gift can be a lot owned by nobody, and there is no `origin_lot_id` because
-- issuance means there is no origin.
--
-- WHAT IS NOT HERE, AND WHY:
--   · No expire path. Whether the remainder is forfeited to the place or the
--     paid half returned is unanswered (_shared/controls-config.ts:32-35 says
--     so), and it decides whether the expire entry is one row or two. Expiry
--     is enforced HERE as a spendability rule; the accounting entry waits for
--     the decision. Until it lands, an expired lot's ledger and its
--     spent_cents still agree — nothing is lost, only unrecorded.
--   · No admin_reset_database guard. The reset builds wipe_tables from
--     pg_class minus admin_reset_preserve, so these tables are wiped by
--     default — correct today, because no lot can carry a Stripe payment
--     intent until the buy path exists. The refusal belongs in MESITA-1676,
--     the PR that first makes one possible.
--
-- Data at apply time: 0 rows in both tables, 1 organization and 1 consumer in
-- the catalog, and no organization holds a connected account — so nothing can
-- be bought yet either.
--
-- LEDGER: applied through MCP apply_migration, which stamps its own
-- server-side timestamp, so this FILENAME was renamed to match the stamped
-- version 20260908101212 rather than writing to schema_migrations by hand —
-- repo and ledger agree, and the next db push will not re-run it.
--
-- VERIFIED AGAINST THE LIVE SCHEMA at apply time, not just checked: a lot was
-- issued, re-issued on the same intent (returned the SAME lot, idempotent), a
-- 400 spend took principal before bonus, an 800 spend against 700 remaining
-- refused WHOLE and left spent_cents at 400 with the ledger still summing to
-- 700, and a direct UPDATE past the ceiling was refused by
-- credit_lots_spent_range. Rows deleted afterwards; both tables are empty.
--
-- EF-ONLY. Clients call Edge Functions, never the DB. RLS is the three-
-- statement form the house uses: enable, revoke from the client roles, grant
-- to service_role. `enable` alone leaves the `authenticated` grant standing and
-- PostgREST answers an empty 200 — which a wallet renders as a zero balance,
-- strictly worse than a 401.

-- ── credit_lots ──────────────────────────────────────────────────────────

create table if not exists public.credit_lots (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete restrict,
  consumer_id              uuid references public.consumers (id) on delete restrict,
  paid_cents               integer not null,
  bonus_cents              integer not null default 0,
  currency                 text    not null default 'MXN',
  spent_cents              integer not null default 0,
  activates_at             timestamptz not null,
  expires_at               timestamptz not null,
  stripe_payment_intent_id text,
  created_at               timestamptz not null default now(),

  constraint credit_lots_paid_nonneg  check (paid_cents  >= 0),
  constraint credit_lots_bonus_nonneg check (bonus_cents >= 0),
  -- THE OVER-SPEND REFUSAL. This is the whole reason spent_cents exists.
  constraint credit_lots_spent_range
    check (spent_cents >= 0 and spent_cents <= paid_cents + bonus_cents),
  -- Credits may never expire before they mature — the same invariant
  -- _shared/controls-config.ts normalizes on the way in, restated where it
  -- cannot be bypassed by a caller that skips the resolver.
  constraint credit_lots_matures_before_expiry check (expires_at > activates_at)
);

comment on table public.credit_lots is
  'One prepaid purchase of Credits at an ORGANIZATION. Balance is derived from credit_ledger; spent_cents is the per-lot constraint anchor that makes an over-spend refusable at the database, never a cached total. MESITA-1671.';
-- ON DELETE RESTRICT AGAINST consumers IS A DECISION WITH A CONSEQUENCE.
-- consumer-web-delete-account currently removes the consumer row; once a
-- guest holds any lot — spent or expired included, since ledger rows persist
-- — that deletion will FAIL rather than silently orphaning money nobody can
-- account for. Blocking loudly is the right default for stored value, but it
-- means "I want my account gone and I hold Credits" needs an operator answer
-- (refund? forfeit?) before the first real lot exists. It belongs with the
-- refund path, MESITA-1679. Restrict, not set null: an orphaned lot is money
-- with no owner and no way to settle it.
comment on column public.credit_lots.consumer_id is
  'NULL means nobody owns this lot yet — the shape an unclaimed gift takes. Redeeming assigns it; there is no origin lot, because gifting is issuance (MESITA-1677).';
comment on column public.credit_lots.paid_cents is
  'What the guest actually paid. bonus_cents is what the organization added on top; the two are tracked separately for the whole life of the lot because who funds the bonus is an open commercial question (MESITA-1678).';
comment on column public.credit_lots.activates_at is
  'When this lot becomes spendable. Computed ONCE, at purchase, from controls_config.defaultHoldHours and never recomputed — an operator editing the config mid-flight must not change terms a guest already paid for. The hold is pre-commitment proof, not float rent (Pato, 2026-09-08).';
comment on column public.credit_lots.spent_cents is
  'Sum of this lot''s spend entries, maintained in the same transaction as every one of them. A constraint anchor and the spend path''s O(1) read — pgTAP pins it equal to the ledger.';
comment on column public.credit_lots.stripe_payment_intent_id is
  'The intent that funded this lot. Its unique index IS the once-only guarantee: Stripe''s idempotency key stops a double CHARGE, nothing else stops a double LOT, so the webhook and the redirect-return may both attempt the write and the loser takes 23505.';

create unique index if not exists credit_lots_payment_intent_key
  on public.credit_lots (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

-- The list query's driving predicate.
create index if not exists credit_lots_consumer_org_idx
  on public.credit_lots (consumer_id, organization_id);
-- The spend hot path: this consumer's live, unspent lots at one organization.
create index if not exists credit_lots_spendable_idx
  on public.credit_lots (consumer_id, organization_id, expires_at)
  where paid_cents + bonus_cents > spent_cents;
-- Postgres does not index the referencing side of a FK; this house does it by
-- hand (organization_guest_customers_consumer_idx, organization_members_org_idx).
create index if not exists credit_lots_organization_idx
  on public.credit_lots (organization_id);

alter table public.credit_lots enable row level security;
revoke all on table public.credit_lots from public, anon, authenticated;
grant all on table public.credit_lots to service_role;

-- ── credit_ledger ────────────────────────────────────────────────────────

create table if not exists public.credit_ledger (
  id               uuid primary key default gen_random_uuid(),
  lot_id           uuid not null references public.credit_lots (id) on delete restrict,
  kind             text not null,
  paid_delta_cents  integer not null default 0,
  bonus_delta_cents integer not null default 0,
  reference        text,
  created_at       timestamptz not null default now(),

  -- A named CHECK on every enum-ish text column, house style. Without it
  -- 'cancelled' vs 'canceled' is a live money bug. 'expire' is listed so the
  -- decision that unblocks it does not also need a constraint migration.
  constraint credit_ledger_kind check (kind in ('issue', 'spend', 'refund', 'expire'))
);

comment on table public.credit_ledger is
  'Append-only. Every movement of Credits, with principal and bonus tracked separately. Nothing ever updates or deletes a row here; a reversal is another row. MESITA-1671.';
comment on column public.credit_ledger.paid_delta_cents is
  'Signed, in cents, against the PRINCIPAL half of the lot. Positive issues, negative spends. Split from bonus because a single signed integer cannot say retroactively which half a spend consumed, and both the expiry decision and the obligor question need that answer permanently.';
comment on column public.credit_ledger.reference is
  'What caused the entry — a ticket id for a spend, an intent id for an issue. Free text on purpose: the things that move Credits do not share one id space.';

create index if not exists credit_ledger_lot_idx
  on public.credit_ledger (lot_id, created_at);

alter table public.credit_ledger enable row level security;
revoke all on table public.credit_ledger from public, anon, authenticated;
grant all on table public.credit_ledger to service_role;

-- ── The money moves, and they are RPCs (not the client, not two calls) ────
--
-- 20260906040000_claim_release_atomic_rpcs.sql:6 already settled the shape:
-- "supabase-js has no multi-statement transactions, so the claim update and
-- the owner upsert live in ONE SQL function." A spend is N ledger inserts and
-- N lot updates; across separate client calls a crash halfway debits the guest
-- and credits nobody.
--
-- EVERY UPDATE BELOW CARRIES A WHERE. The `authenticator` role preloads the
-- `safeupdate` extension, which aborts a WHERE-less UPDATE even inside a
-- SECURITY DEFINER function reached over RPC — 20260906213431 records that
-- passing static review and failing live.

create or replace function public.create_credit_lot(
  p_organization_id uuid,
  p_consumer_id uuid,
  p_paid_cents integer,
  p_bonus_cents integer,
  p_currency text,
  p_activates_at timestamptz,
  p_expires_at timestamptz,
  p_stripe_payment_intent_id text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  insert into public.credit_lots (
    organization_id, consumer_id, paid_cents, bonus_cents, currency,
    activates_at, expires_at, stripe_payment_intent_id
  ) values (
    p_organization_id, p_consumer_id, coalesce(p_paid_cents, 0),
    coalesce(p_bonus_cents, 0), coalesce(p_currency, 'MXN'),
    p_activates_at, p_expires_at, p_stripe_payment_intent_id
  ) returning id into v_id;

  insert into public.credit_ledger (
    lot_id, kind, paid_delta_cents, bonus_delta_cents, reference
  ) values (
    v_id, 'issue', coalesce(p_paid_cents, 0), coalesce(p_bonus_cents, 0),
    p_stripe_payment_intent_id
  );

  return jsonb_build_object('ok', true, 'lotId', v_id);
exception
  when unique_violation then
    -- The payment intent already funded a lot. This is the SUCCESS path, not
    -- an error: the webhook and the redirect-return both try, and the loser
    -- must hand back the lot that exists rather than a failure the caller
    -- would retry into a second charge.
    select id into v_id
      from public.credit_lots
     where stripe_payment_intent_id = p_stripe_payment_intent_id;
    return jsonb_build_object('ok', true, 'lotId', v_id, 'idempotent', true);
end;
$$;

comment on function public.create_credit_lot is
  'Issues a lot and its opening ledger entry in one transaction. Idempotent on stripe_payment_intent_id — a second call for the same intent returns the first lot. MESITA-1671.';

create or replace function public.spend_credits(
  p_consumer_id uuid,
  p_organization_id uuid,
  p_amount_cents integer,
  p_reference text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_remaining integer := p_amount_cents;
  v_lot record;
  v_take integer;
  v_take_paid integer;
  v_take_bonus integer;
  v_paid_left integer;
  v_applied jsonb := '[]'::jsonb;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_not_positive');
  end if;

  -- SOONEST-EXPIRING FIRST, and `for update` is what serializes two concurrent
  -- spends: under READ COMMITTED the second waiter re-reads the row after the
  -- lock is granted, so it sees the first spender's spent_cents rather than
  -- the stale value it queued on.
  for v_lot in
    select id, paid_cents, bonus_cents, spent_cents
      from public.credit_lots
     where consumer_id = p_consumer_id
       and organization_id = p_organization_id
       and activates_at <= now()
       and expires_at > now()
       and paid_cents + bonus_cents > spent_cents
     order by expires_at asc, created_at asc
     for update
  loop
    exit when v_remaining <= 0;
    v_take := least(
      v_remaining,
      v_lot.paid_cents + v_lot.bonus_cents - v_lot.spent_cents
    );

    -- PRINCIPAL FIRST, and this is a product law rather than an
    -- implementation detail, so it lives here and not only in a test.
    -- Spending the guest's own money first leaves the BONUS as what is left
    -- to die at expiry. Bonus-first would leave their principal exposed,
    -- which is the guest losing what they actually paid.
    v_paid_left := greatest(
      v_lot.paid_cents - least(v_lot.spent_cents, v_lot.paid_cents), 0
    );
    v_take_paid := least(v_take, v_paid_left);
    v_take_bonus := v_take - v_take_paid;

    update public.credit_lots
       set spent_cents = spent_cents + v_take
     where id = v_lot.id;

    insert into public.credit_ledger (
      lot_id, kind, paid_delta_cents, bonus_delta_cents, reference
    ) values (v_lot.id, 'spend', -v_take_paid, -v_take_bonus, p_reference);

    v_applied := v_applied || jsonb_build_object(
      'lotId', v_lot.id, 'cents', v_take,
      'paidCents', v_take_paid, 'bonusCents', v_take_bonus
    );
    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    -- A RAISE, NOT A RETURN. Returning here would COMMIT the lots already
    -- debited above for a bill that was never settled — a plpgsql function
    -- runs inside its caller's transaction, so only an exception unwinds it.
    -- This block's own handler catches it, which rolls every write above back
    -- to the entry savepoint and then answers honestly.
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'applied', v_applied);
exception
  when check_violation then
    -- credit_lots_spent_range fired: another spender took the money between
    -- our read and our write. Everything rolls back; the caller sees a race,
    -- never a 500.
    return jsonb_build_object('ok', false, 'code', 'race_lost');
  when raise_exception then
    if sqlerrm = 'insufficient_credits' then
      return jsonb_build_object('ok', false, 'code', 'insufficient_credits');
    end if;
    raise;
end;
$$;

comment on function public.spend_credits is
  'Spends across a consumer''s live lots at one organization, soonest-expiring first and principal before bonus, in one transaction. Refuses whole rather than partially: an insufficient balance rolls back every debit. MESITA-1671.';

-- ── Post-flight ──────────────────────────────────────────────────────────
-- The 5A posture: assert the shape, by name, before any EF starts reading it.

do $$
begin
  if not exists (select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'credit_lots') then
    raise exception 'credit_lots missing after migration';
  end if;
  if not exists (select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'credit_ledger') then
    raise exception 'credit_ledger missing after migration';
  end if;

  -- BALANCE IS DERIVED. This is the column a later migration adds "for
  -- performance" and it is exactly how a wallet starts disagreeing with its
  -- own ledger, so the absence is a schema fact rather than a convention.
  if exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'credit_lots'
      and column_name in ('balance_cents', 'balance')) then
    raise exception 'credit_lots must not carry a balance column — balance is SUM(credit_ledger)';
  end if;

  -- The over-spend refusal, by name: a constraint that is silently dropped
  -- leaves every other guarantee here standing and this one gone.
  if not exists (select 1 from pg_constraint
    where conname = 'credit_lots_spent_range') then
    raise exception 'credit_lots_spent_range missing — an over-spend would be accepted';
  end if;

  -- EF-only. A missing revoke is invisible until a client reads money, and
  -- PostgREST answers an empty 200 that renders as a zero balance.
  if has_table_privilege('authenticated', 'public.credit_lots', 'SELECT')
     or has_table_privilege('authenticated', 'public.credit_ledger', 'SELECT') then
    raise exception 'credits tables are readable by authenticated — revoke missing';
  end if;

  -- The RPCs exist AND are security definer; without the latter they run as
  -- the caller and cannot see a table nobody is granted.
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'spend_credits' and p.prosecdef) then
    raise exception 'spend_credits missing or not security definer';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_credit_lot' and p.prosecdef) then
    raise exception 'create_credit_lot missing or not security definer';
  end if;
end $$;

notify pgrst, 'reload schema';
