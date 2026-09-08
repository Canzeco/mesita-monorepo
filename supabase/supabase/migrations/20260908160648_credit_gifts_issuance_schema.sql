-- Gift Credits get their table (MESITA-1677): issuance-only, code-addressed.
--
-- 20260908101212_credit_lots_and_ledger.sql deliberately left this out,
-- pending payments counsel (MESITA-1680, still Backlog): "whether a
-- purchased-then-gifted balance is a transfer between consumers... is a
-- question for payments counsel, and the answer changes the gift shape."
-- This ships to the reading MESITA-1677's own text already commits to —
-- "we have designed to the answer 'no, issuance is not transfer'" (MESITA-
-- 1680's own words) — and MESITA-1680 stays open to overturn it. If counsel
-- disagrees, gifting does not ship in this form; that is a live, accepted
-- risk of building ahead of the memo, not an oversight.
--
-- A GIFT IS A LOT WITH NO ORIGIN, NOT A TRANSFER. credit_lots.consumer_id
-- was already nullable for exactly this ("an unclaimed gift can be a lot
-- owned by nobody"); this table is the code that finds that lot. There is
-- still no origin_lot_id anywhere — issuance means there is no origin.
--
-- TWO EXPIRIES, NOT ONE. credit_gifts.expires_at is the CLAIM deadline —
-- after it, the code is dead. credit_lots.expires_at is the SPEND deadline,
-- and per MESITA-1692's emulator ("the clock starts when the code is
-- REDEEMED"), it cannot be fixed at gift-purchase time: redeem_credit_gift
-- recomputes it from expiry_days, frozen on this row, the moment the code
-- becomes money. Until claimed, the lot's own expires_at holds a placeholder
-- (the claim deadline) only to satisfy the NOT NULL / ordering constraints —
-- an owner-less lot is unreachable by spend_credits regardless.
--
-- CANCEL RETURNS THE LOT, IT DOES NOT REFUND STRIPE. "Money must never be
-- strandable" (MESITA-1677): a code created and never shared is
-- unrecoverable unless the sender can get the balance BACK. The organization
-- already holds the funds; cancelling only reassigns who owns the resulting
-- balance — the same consumer_id handover redeem does, landing on the
-- sender instead of a stranger. No Stripe refund, no second charge event.
--
-- PARTIAL UNIQUE ON code_hash, LIVE STATES ONLY (MESITA-1677's own note:
-- "this collides with unique(code_hash) if codes are ever recycled — decide,
-- and make it a partial unique on live states"). Decided: unique WHERE
-- state = 'unclaimed'. A claimed or cancelled code is dead and may recur
-- from a fresh random draw without ever colliding with anything still
-- claimable — at 10 digits (9e9 space) this is theoretical, not a plan to
-- actually recycle codes, but the constraint is honest about what "live"
-- means either way.
--
-- CODE_HASH IS A KEYED HMAC, NEVER THE CODE. Generated and verified in
-- supabase/functions/_shared/gift-code.ts — recoverability comes from
-- cancellation (above), never from re-revealing a secret this table does
-- not store.
--
-- RATE LIMITING TABLE ALSO LANDS HERE: credit_gift_redeem_events, the same
-- sliding-window shape _shared/ticket-check.ts's isRateLimited already
-- reads for the public check surface — a fresh table because a gift redeem
-- is a different actor and a different audit trail, not because the
-- pattern needed reinventing.
--
-- LEDGER: applied through MCP apply_migration, which stamps its own
-- server-side timestamp, so this FILENAME was renamed to match the stamped
-- version 20260908160648 rather than writing to schema_migrations by hand.
--
-- VERIFIED AGAINST THE LIVE SCHEMA at apply time: a gift was issued and
-- redeemed (lot's consumer_id/activates_at/expires_at all updated
-- correctly), a second redeem of the same code returned the generic
-- gift_invalid, a second gift was issued and cancelled (lot returned to the
-- sender under fresh terms), a second cancel of the same gift also returned
-- the generic refusal, and re-calling create_credit_gift with the SAME
-- stripe_payment_intent_id but a different code returned the ORIGINAL
-- giftId/lotId (idempotent, no duplicate). Rows deleted afterwards; all
-- three tables (credit_gifts, credit_lots, credit_ledger) are empty again.

-- ── credit_gifts ─────────────────────────────────────────────────────────

create table if not exists public.credit_gifts (
  id           uuid primary key default gen_random_uuid(),
  lot_id       uuid not null references public.credit_lots (id) on delete restrict,
  sender_id    uuid not null references public.consumers (id) on delete restrict,
  code_hash    text not null,
  state        text not null default 'unclaimed',
  claimed_by   uuid references public.consumers (id) on delete restrict,
  claimed_at   timestamptz,
  cancelled_at timestamptz,
  -- The CLAIM deadline. See header — distinct from credit_lots.expires_at.
  expires_at   timestamptz not null,
  -- The spend term, frozen at gift-purchase time, applied to the lot's
  -- expires_at at claim (or cancel) time. "Carried, not spent" — MESITA-1692.
  expiry_days  integer not null,
  note         text,
  created_at   timestamptz not null default now(),

  constraint credit_gifts_state check (state in ('unclaimed', 'claimed', 'cancelled')),
  constraint credit_gifts_expiry_days_positive check (expiry_days > 0),
  constraint credit_gifts_note_length check (note is null or char_length(note) <= 140),
  constraint credit_gifts_claimed_consistency check (
    (state = 'claimed') = (claimed_by is not null and claimed_at is not null)
  ),
  constraint credit_gifts_cancelled_consistency check (
    (state = 'cancelled') = (cancelled_at is not null)
  )
);

comment on table public.credit_gifts is
  'Issuance-only gifting (MESITA-1677): a credit_lots row created with consumer_id NULL, addressable by a hashed claim code until redeemed or cancelled. There is no origin_lot_id — issuance, not a transfer.';
comment on column public.credit_gifts.code_hash is
  'HMAC-SHA256 digest of the raw code (gift-code.ts), never the code itself. The raw code is shown to the sender exactly once, at purchase, and is never stored.';
comment on column public.credit_gifts.expires_at is
  'The CLAIM deadline. After this, redeem_credit_gift refuses the code even though its row still says state=''unclaimed'' — there is no separate ''expired'' state, the same posture credit_lots itself takes (no expire path yet, MESITA-1671).';
comment on column public.credit_gifts.expiry_days is
  'The spend term frozen at purchase. redeem_credit_gift and cancel_credit_gift both use it to set credit_lots.expires_at = now() + expiry_days at the moment the lot gets an owner — the clock starts when the code becomes money, not when it was bought.';

-- LIVE CODES ONLY — see header. A claimed/cancelled row keeps its historical
-- code_hash (needed for nothing today, kept for the audit trail) without
-- blocking a fresh code from reusing that digest.
create unique index if not exists credit_gifts_code_hash_live_key
  on public.credit_gifts (code_hash)
  where state = 'unclaimed';

-- The sent-gifts list's driving predicate (consumer-web-list-credit-gifts).
create index if not exists credit_gifts_sender_idx
  on public.credit_gifts (sender_id, created_at desc);
-- Postgres does not index the referencing side of a FK; this house does it
-- by hand (credit_lots_organization_idx, organization_members_org_idx).
create index if not exists credit_gifts_lot_idx
  on public.credit_gifts (lot_id);

alter table public.credit_gifts enable row level security;
revoke all on table public.credit_gifts from public, anon, authenticated;
grant all on table public.credit_gifts to service_role;

-- ── credit_gift_redeem_events ───────────────────────────────────────────
-- Rate-limit audit trail for the public preview EF and the authed redeem EF
-- — same sliding-window shape as ticket_check_events, a fresh table because
-- this is a different actor (a stranger with a code, or a freshly-signed-in
-- claimer) and a different money surface, not because the pattern needed
-- reinventing.

create table if not exists public.credit_gift_redeem_events (
  id          uuid primary key default gen_random_uuid(),
  ip_hash     text,
  consumer_id uuid,
  event       text not null,
  created_at  timestamptz not null default now(),

  constraint credit_gift_redeem_events_event check (
    event in ('preview', 'redeemed', 'redeem_failed')
  )
);

comment on table public.credit_gift_redeem_events is
  'Sliding-window rate-limit ledger for gift-web-preview-code and consumer-web-redeem-credit-gift (MESITA-1677). Insert-only, fire-and-forget — never blocks the guest-facing action it audits.';

create index if not exists credit_gift_redeem_events_ip_idx
  on public.credit_gift_redeem_events (ip_hash, created_at);

alter table public.credit_gift_redeem_events enable row level security;
revoke all on table public.credit_gift_redeem_events from public, anon, authenticated;
grant all on table public.credit_gift_redeem_events to service_role;

-- ── The money moves, and they are RPCs ──────────────────────────────────
-- Same law as 20260908101212: supabase-js has no multi-statement
-- transactions, so a gift's charge-confirm, a redeem's code-claim + lot
-- handover, and a cancel's code-close + lot handover each live in ONE SQL
-- function. Every UPDATE carries a WHERE — the authenticator role's
-- safeupdate extension aborts a WHERE-less UPDATE even inside SECURITY
-- DEFINER (20260906213431).

create or replace function public.create_credit_gift(
  p_organization_id uuid,
  p_sender_id uuid,
  p_paid_cents integer,
  p_bonus_cents integer,
  p_currency text,
  p_code_hash text,
  p_claim_expires_at timestamptz,
  p_expiry_days integer,
  p_note text,
  p_stripe_payment_intent_id text
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lot_id uuid;
  v_gift_id uuid;
  v_constraint text;
begin
  -- OWNERLESS ON PURPOSE. activates_at/expires_at only need to satisfy the
  -- table's own NOT NULL + ordering constraint here; nobody can spend an
  -- owner-less lot regardless (spend_credits filters on consumer_id). Redeem
  -- and cancel both overwrite these the moment the lot gets an owner.
  insert into public.credit_lots (
    organization_id, consumer_id, paid_cents, bonus_cents, currency,
    activates_at, expires_at, stripe_payment_intent_id
  ) values (
    p_organization_id, null, coalesce(p_paid_cents, 0),
    coalesce(p_bonus_cents, 0), coalesce(p_currency, 'MXN'),
    now(), p_claim_expires_at, p_stripe_payment_intent_id
  ) returning id into v_lot_id;

  insert into public.credit_ledger (
    lot_id, kind, paid_delta_cents, bonus_delta_cents, reference
  ) values (
    v_lot_id, 'issue', coalesce(p_paid_cents, 0), coalesce(p_bonus_cents, 0),
    p_stripe_payment_intent_id
  );

  insert into public.credit_gifts (
    lot_id, sender_id, code_hash, expires_at, expiry_days, note
  ) values (
    v_lot_id, p_sender_id, p_code_hash, p_claim_expires_at, p_expiry_days, p_note
  ) returning id into v_gift_id;

  return jsonb_build_object('ok', true, 'lotId', v_lot_id, 'giftId', v_gift_id);
exception
  when unique_violation then
    -- TWO DIFFERENT constraints can fire here, and they mean different
    -- things: the payment intent already funded a gift (SUCCESS — the
    -- webhook backstop and the synchronous confirm reader both try, and the
    -- loser must hand back what exists), or the drawn code collided with
    -- another LIVE gift (astronomically rare at 10 digits, but a real
    -- collision, not a retry-safe no-op) — the caller must draw a fresh
    -- code and call again rather than being told it already succeeded.
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'credit_lots_payment_intent_key' then
      select cl.id, cg.id into v_lot_id, v_gift_id
        from public.credit_lots cl
        join public.credit_gifts cg on cg.lot_id = cl.id
       where cl.stripe_payment_intent_id = p_stripe_payment_intent_id;
      return jsonb_build_object('ok', true, 'lotId', v_lot_id, 'giftId', v_gift_id, 'idempotent', true);
    end if;
    return jsonb_build_object('ok', false, 'code', 'gift_code_collision');
end;
$$;

comment on function public.create_credit_gift is
  'Issues an owner-less lot, its opening ledger entry, and the gift row that addresses it, in one transaction. Idempotent on stripe_payment_intent_id; a code_hash collision (a DIFFERENT failure) asks the caller to draw a fresh code. MESITA-1677.';

create or replace function public.redeem_credit_gift(
  p_code_hash text,
  p_claimer_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_gift_id uuid;
  v_lot_id uuid;
  v_expiry_days integer;
begin
  -- THE WHOLE CONCURRENCY STORY (MESITA-1677): one conditional UPDATE. Zero
  -- rows means lost the race, spent, expired, cancelled, or never existed —
  -- ONE generic outcome to the caller, copying consumer-web-claim-invite-
  -- code's deliberate non-differentiation.
  update public.credit_gifts
     set state = 'claimed', claimed_by = p_claimer_id, claimed_at = now()
   where code_hash = p_code_hash
     and state = 'unclaimed'
     and expires_at > now()
   returning id, lot_id, expiry_days into v_gift_id, v_lot_id, v_expiry_days;

  if v_gift_id is null then
    return jsonb_build_object('ok', false, 'code', 'gift_invalid');
  end if;

  -- THE LOT HANDOVER, SAME TRANSACTION. A crash between the two updates
  -- would leave a gift marked claimed with the money nowhere — the reason
  -- this is an RPC and not two supabase-js calls. Terms are recomputed HERE,
  -- not carried from purchase: "the clock starts when the code is redeemed."
  update public.credit_lots
     set consumer_id = p_claimer_id,
         activates_at = now(),
         expires_at = now() + (v_expiry_days || ' days')::interval
   where id = v_lot_id
     and consumer_id is null;

  if not found then
    -- Unreachable in practice — the gift row's own CAS above is the only
    -- door that can ever unlock this lot — but never leave a gift marked
    -- claimed with no lot to show for it. Raising rolls BOTH updates back.
    raise exception 'credit_gift_lot_taken' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'lotId', v_lot_id);
exception
  when raise_exception then
    if sqlerrm = 'credit_gift_lot_taken' then
      return jsonb_build_object('ok', false, 'code', 'gift_invalid');
    end if;
    raise;
end;
$$;

comment on function public.redeem_credit_gift is
  'The one conditional UPDATE that claims a gift code, plus the lot handover, in one transaction. Zero rows claimed is ONE generic outcome regardless of cause. MESITA-1677.';

create or replace function public.cancel_credit_gift(
  p_gift_id uuid,
  p_sender_id uuid
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_lot_id uuid;
  v_expiry_days integer;
begin
  -- MONEY MUST NEVER BE STRANDABLE. Only the SENDER of an UNCLAIMED gift may
  -- cancel — a claimed or cancelled gift, or someone else's gift, all refuse
  -- identically (the caller does not get to learn which).
  update public.credit_gifts
     set state = 'cancelled', cancelled_at = now()
   where id = p_gift_id
     and sender_id = p_sender_id
     and state = 'unclaimed'
   returning lot_id, expiry_days into v_lot_id, v_expiry_days;

  if v_lot_id is null then
    return jsonb_build_object('ok', false, 'code', 'gift_not_cancellable');
  end if;

  -- RETURN THE LOT, NOT A STRIPE REFUND. The organization already holds the
  -- funds; cancelling only reassigns who owns the resulting balance — the
  -- same handover redeem does, landing on the sender instead of a stranger.
  update public.credit_lots
     set consumer_id = p_sender_id,
         activates_at = now(),
         expires_at = now() + (v_expiry_days || ' days')::interval
   where id = v_lot_id
     and consumer_id is null;

  if not found then
    raise exception 'credit_gift_cancel_lot_taken' using errcode = 'P0001';
  end if;

  return jsonb_build_object('ok', true, 'lotId', v_lot_id);
exception
  when raise_exception then
    if sqlerrm = 'credit_gift_cancel_lot_taken' then
      return jsonb_build_object('ok', false, 'code', 'gift_not_cancellable');
    end if;
    raise;
end;
$$;

comment on function public.cancel_credit_gift is
  'Cancels an unclaimed gift the caller sent and returns its lot to them, in one transaction. Refuses identically for claimed/cancelled/not-yours. MESITA-1677.';

-- ── Post-flight ──────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'credit_gifts') then
    raise exception 'credit_gifts missing after migration';
  end if;

  -- A partial UNIQUE INDEX (not a table constraint) never registers in
  -- pg_constraint — pg_indexes is the right catalog to assert it by name.
  if not exists (select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'credit_gifts_code_hash_live_key') then
    raise exception 'credit_gifts_code_hash_live_key missing — a live code collision would be accepted';
  end if;

  if has_table_privilege('authenticated', 'public.credit_gifts', 'SELECT')
     or has_table_privilege('authenticated', 'public.credit_gift_redeem_events', 'SELECT') then
    raise exception 'credit_gifts tables are readable by authenticated — revoke missing';
  end if;

  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_credit_gift' and p.prosecdef) then
    raise exception 'create_credit_gift missing or not security definer';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'redeem_credit_gift' and p.prosecdef) then
    raise exception 'redeem_credit_gift missing or not security definer';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'cancel_credit_gift' and p.prosecdef) then
    raise exception 'cancel_credit_gift missing or not security definer';
  end if;
end $$;
