-- MESITA-3305 — W2b: the card part of a payment on the connected account,
-- the Connect receiver's bookkeeping, cashback and the settle cron.
--
-- A guest whose credit is short pays the rest by card: the credit part is
-- HELD (the row is opening/open, wallet_balance already counts the hold),
-- the card part plus an optional tip is one Stripe Checkout on the place's
-- connected account with Mesita's fee as the application fee, and when
-- Stripe says paid the hold becomes a spend and 5% of the card part lands
-- as cashback an hour later. An expired or refused Checkout releases the
-- hold and writes no entry. Settlement has three callers of the same RPCs
-- (the receiver, the cron, a read of the payment); every one locks the row
-- first, so two deliveries of one event write the credit once.
--
--   wallet_payments.cashback_bps        the rate stored at start (CASHBACK_BPS
--                                       when the switch was on, else 0); settle
--                                       never re-reads the switch.
--   wallet_payments.expires_at          the Checkout's expiry, stored so the
--                                       cron and the page read one clock.
--   wallet_payments.tip_refunded_cents  refunds are attributed card first,
--                                       then tip; the ceiling is card + tip.
--   fee_refunded_cents (both tables)    Mesita's fee that followed a refund.
--   stripe_connect_events.processed_at  set when the event's work committed;
--                                       a replay is a row with it set, a retry
--                                       after a 5xx (the row was deleted) runs.
--   needs_review without paid_at        the cron's give-up state for a row
--                                       Stripe never confirmed (48 ticks, or a
--                                       404): excluded from every balance since
--                                       it wrote no entry; wallet_reopen_settle
--                                       sends it back to open.
--
-- Additive except two constraint rewrites (the refund ceiling and the
-- paid_at rule); every new column has a default or is nullable, so the
-- functions of W2a keep working through the migration-before-functions
-- window. Rollback is the next PR.

-- ── 1. Columns ─────────────────────────────────────────────────────────────
alter table public.wallet_payments
  add column cashback_bps integer not null default 0 check (cashback_bps >= 0 and cashback_bps <= 10000),
  add column fee_refunded_cents integer not null default 0 check (fee_refunded_cents >= 0),
  add column tip_refunded_cents integer not null default 0 check (tip_refunded_cents >= 0),
  add column expires_at timestamptz;

alter table public.wallet_purchases
  add column fee_refunded_cents integer not null default 0 check (fee_refunded_cents >= 0);

alter table public.stripe_connect_events
  add column processed_at timestamptz;

comment on column public.wallet_payments.cashback_bps is
  'MESITA-3305: the cashback rate stored when the payment started (CASHBACK_BPS with the switch on, else 0). Settle writes bps(card_cents, cashback_bps) and never re-reads the switch.';
comment on column public.wallet_payments.expires_at is
  'MESITA-3305: when the Checkout expires (WALLET_CHECKOUT_TTL_SEC after start). The hold is released only when Stripe confirms expiry.';
comment on column public.wallet_payments.tip_refunded_cents is
  'MESITA-3305: the part of refunded_cents attributed to the tip (refunds fill the card part first).';
comment on column public.wallet_payments.fee_refunded_cents is
  'MESITA-3305: Mesita''s application fee returned with refunds (bps of the delta on a Mesita-started refund; Stripe''s amount_refunded on the fee for a place-started one).';
comment on column public.wallet_purchases.fee_refunded_cents is
  'MESITA-3305: Mesita''s application fee returned with refunds of this purchase.';
comment on column public.stripe_connect_events.processed_at is
  'MESITA-3305: when the receiver finished this event''s work. A duplicate id with it set is a replay; a row deleted on a 5xx lets Stripe''s retry run.';

-- ── 2. Constraint rewrites ─────────────────────────────────────────────────
-- The refund ceiling of a mixed payment is card + tip (rule 6).
alter table public.wallet_payments drop constraint wallet_payments_refunded_within_card_chk;
alter table public.wallet_payments add constraint wallet_payments_refunded_within_charge_chk
  check (refunded_cents <= card_cents + tip_cents);
alter table public.wallet_payments add constraint wallet_payments_tip_refunded_within_tip_chk
  check (tip_refunded_cents <= tip_cents);

-- needs_review may now stand on a row that was never paid (the cron gave
-- up); the paid statuses still require paid_at and the open ones forbid it.
alter table public.wallet_payments drop constraint wallet_payments_paid_at_chk;
alter table public.wallet_payments add constraint wallet_payments_paid_at_chk check (
  case
    when status in ('paid', 'refunded', 'partly_refunded') then paid_at is not null
    when status in ('opening', 'open', 'failed', 'expired') then paid_at is null
    else true
  end
);
alter table public.wallet_purchases drop constraint wallet_purchases_paid_at_chk;
alter table public.wallet_purchases add constraint wallet_purchases_paid_at_chk check (
  case
    when status in ('paid', 'refunded', 'partly_refunded') then paid_at is not null
    when status in ('opening', 'open', 'failed', 'expired') then paid_at is null
    else true
  end
);

-- ── 3. Holding the credit part ─────────────────────────────────────────────
-- The mixed payment's first half. Under the pair lock: a replayed request_id
-- answers the row it made (already_paid once paid, in_progress while its
-- Checkout is open, a fresh hold on a failed or expired row of the same
-- shape), anything else under that id is taken; more credit than spendable
-- is insufficient; otherwise one `opening` row whose credit_cents is the
-- hold (wallet_balance counts it at once). The EF opens the Checkout next
-- and stores the session with wallet_open_payment.
create or replace function public.wallet_hold_payment(
  p_consumer_id uuid, p_place_id uuid, p_credit_cents integer, p_card_cents integer, p_tip_cents integer,
  p_currency text, p_livemode boolean, p_request_id uuid, p_proof_token text, p_ticket text,
  p_stripe_account_id text, p_application_fee_cents integer, p_cashback_bps integer, p_expires_at timestamptz)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_prior public.wallet_payments;
  v_spendable integer;
  v_id uuid;
begin
  if p_card_cents is null or p_card_cents <= 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  if p_credit_cents is null or p_credit_cents < 0 or p_tip_cents is null or p_tip_cents < 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  if p_consumer_id is null or p_request_id is null or p_stripe_account_id is null then
    raise exception 'wallet_hold_payment: consumer, request_id and account are required';
  end if;
  p_currency := lower(p_currency);

  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into v_prior from public.wallet_payments
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    if v_prior.place_id <> p_place_id or v_prior.amount_cents <> p_credit_cents + p_card_cents
       or v_prior.livemode <> p_livemode then
      return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_prior.id);
    end if;
    if v_prior.paid_at is not null then
      return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v_prior.id,
        'status', v_prior.status, 'credit_cents', v_prior.credit_cents, 'card_cents', v_prior.card_cents,
        'tip_cents', v_prior.tip_cents, 'currency', v_prior.currency, 'paid_at', v_prior.paid_at,
        'proof_token', v_prior.proof_token);
    end if;
    if v_prior.status in ('opening', 'open') then
      return jsonb_build_object('ok', true, 'outcome', 'in_progress', 'payment_id', v_prior.id,
        'session_id', v_prior.stripe_checkout_session_id, 'expires_at', v_prior.expires_at);
    end if;
    if v_prior.status in ('failed', 'expired') then
      -- The same tap after a refused or expired Checkout opens a new one on
      -- the same row: the unique (consumer, request_id) index holds.
      select b.spendable_cents into v_spendable
        from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
      if p_credit_cents > coalesce(v_spendable, 0) then
        return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
      end if;
      update public.wallet_payments
         set status = 'opening', stripe_checkout_session_id = null, stripe_error = null, settle_tries = 0,
             credit_cents = p_credit_cents, card_cents = p_card_cents, tip_cents = p_tip_cents,
             stripe_account_id = p_stripe_account_id, application_fee_cents = p_application_fee_cents,
             cashback_bps = p_cashback_bps, expires_at = p_expires_at, ticket = p_ticket,
             proof_token = coalesce(proof_token, p_proof_token), updated_at = now()
       where id = v_prior.id;
      return jsonb_build_object('ok', true, 'outcome', 'held', 'payment_id', v_prior.id, 'expires_at', p_expires_at);
    end if;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_prior.id);
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
  v_spendable := coalesce(v_spendable, 0);
  if p_credit_cents > v_spendable then
    return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', v_spendable);
  end if;

  begin
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents,
                                        currency, status, stripe_account_id, application_fee_cents, cashback_bps,
                                        request_id, ticket, proof_token, livemode, expires_at)
    values (p_consumer_id, p_place_id, p_credit_cents + p_card_cents, p_credit_cents, p_card_cents, p_tip_cents,
            p_currency, 'opening', p_stripe_account_id, p_application_fee_cents, p_cashback_bps,
            p_request_id, p_ticket, p_proof_token, p_livemode, p_expires_at)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.wallet_payments
     where consumer_id = p_consumer_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_id);
  end;

  return jsonb_build_object('ok', true, 'outcome', 'held', 'payment_id', v_id, 'expires_at', p_expires_at);
end;
$function$;

revoke all on function public.wallet_hold_payment(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, text, integer, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.wallet_hold_payment(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, text, integer, integer, timestamptz)
  to service_role;

comment on function public.wallet_hold_payment(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, text, integer, integer, timestamptz) is
  'MESITA-3305 Wallet: holds the credit part of a mixed payment as an opening row (wallet_balance counts the hold). Replays by request_id: already_paid, in_progress, a new hold on a failed or expired row, else taken. Service role only.';

-- The Checkout exists: the row names its session and reads open.
create or replace function public.wallet_open_payment(p_payment_id uuid, p_session_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  update public.wallet_payments
     set status = 'open', stripe_checkout_session_id = p_session_id, updated_at = now()
   where id = p_payment_id and status = 'opening';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_opening');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.wallet_open_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_open_payment(uuid, text) to service_role;

-- ── 4. Settling the card part ──────────────────────────────────────────────
-- Stripe said paid. Under the row lock and the pair lock: the hold becomes
-- the spend entry (Available at once, negative), cashback_cents =
-- floor(card_cents * cashback_bps / 10000) lands as an entry one hour after
-- paid_at, same place only. A second delivery answers already_paid and
-- writes nothing. A completed event for a row that was failed, expired or
-- needs_review credits nothing and marks stripe_error = late_completion
-- (rule 12): the operator sees it, the guest's card was charged on the
-- place's account, and the operator refund (W3) is the answer.
create or replace function public.wallet_settle_payment(p_payment_id uuid, p_payment_intent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_cashback integer;
  v_paid_at timestamptz := now();
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.paid_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v.id, 'status', v.status,
      'credit_cents', v.credit_cents, 'card_cents', v.card_cents, 'tip_cents', v.tip_cents,
      'cashback_cents', v.cashback_cents, 'currency', v.currency, 'paid_at', v.paid_at, 'proof_token', v.proof_token);
  end if;
  if v.status in ('failed', 'expired', 'needs_review') then
    update public.wallet_payments
       set stripe_error = 'late_completion',
           stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
           status = 'needs_review', updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'late_completion', 'payment_id', v.id, 'was', v.status);
  end if;

  perform public.wallet_lock(v.consumer_id, v.place_id);
  v_cashback := (v.card_cents * v.cashback_bps) / 10000;

  update public.wallet_payments
     set status = 'paid', paid_at = v_paid_at, updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
         cashback_cents = v_cashback, stripe_error = null
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, v_paid_at);
  end if;
  if v_cashback > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'cashback', v_cashback, v.currency, v.id, v.livemode, v_paid_at + interval '1 hour');
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'card_cents', v.card_cents, 'tip_cents', v.tip_cents,
    'cashback_cents', v_cashback, 'currency', v.currency, 'paid_at', v_paid_at, 'proof_token', v.proof_token);
end;
$function$;

revoke all on function public.wallet_settle_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_settle_payment(uuid, text) to service_role;

comment on function public.wallet_settle_payment(uuid, text) is
  'MESITA-3305 Wallet: marks a mixed payment paid, turns the hold into its spend entry and writes bps(card_cents, cashback_bps) as cashback one hour later; idempotent (already_paid); a failed, expired or needs_review row gets stripe_error late_completion and no credit. Service role only.';

-- The Checkout ended with no money: expired by Stripe, or refused at start.
-- The row closes and the hold is gone; no entry was ever written.
create or replace function public.wallet_release_payment(p_payment_id uuid, p_status text, p_error text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
begin
  if p_status not in ('expired', 'failed') then
    return jsonb_build_object('ok', false, 'code', 'bad_status');
  end if;
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status not in ('opening', 'open') then
    return jsonb_build_object('ok', true, 'outcome', 'unchanged', 'status', v.status);
  end if;
  update public.wallet_payments
     set status = p_status, stripe_error = coalesce(p_error, stripe_error), updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'released', 'status', p_status);
end;
$function$;

revoke all on function public.wallet_release_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.wallet_release_payment(uuid, text, text) to service_role;

comment on function public.wallet_release_payment(uuid, text, text) is
  'MESITA-3305 Wallet: closes an opening or open mixed payment as expired or failed, releasing its hold; writes no entry; a closed row is unchanged. Service role only.';

-- ── 5. The cron's bookkeeping ──────────────────────────────────────────────
-- One batch of rows still open, oldest first, each one's settle_tries
-- bumped as it is handed out; `for update skip locked`, so two ticks never
-- take the same row. p_limit applies per kind.
create or replace function public.wallet_settle_batch(p_limit integer)
 returns table (
   kind text, id uuid, consumer_id uuid, place_id uuid, stripe_checkout_session_id text,
   stripe_account_id text, created_at timestamptz, expires_at timestamptz, settle_tries integer,
   status text, voucher text, livemode boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  return query
  with p as (
    select wp.id from public.wallet_purchases wp
     where wp.status in ('opening', 'open')
     order by wp.created_at
     limit greatest(p_limit, 0)
     for update skip locked
  ), pu as (
    update public.wallet_purchases wp
       set settle_tries = wp.settle_tries + 1, updated_at = now()
      from p where wp.id = p.id
    returning 'purchase'::text as kind, wp.id, wp.consumer_id, wp.place_id, wp.stripe_checkout_session_id,
              wp.stripe_account_id, wp.created_at, null::timestamptz as expires_at, wp.settle_tries,
              wp.status, wp.voucher, wp.livemode
  ), y as (
    select wy.id from public.wallet_payments wy
     where wy.status in ('opening', 'open')
     order by wy.created_at
     limit greatest(p_limit, 0)
     for update skip locked
  ), yu as (
    update public.wallet_payments wy
       set settle_tries = wy.settle_tries + 1, updated_at = now()
      from y where wy.id = y.id
    returning 'payment'::text as kind, wy.id, wy.consumer_id, wy.place_id, wy.stripe_checkout_session_id,
              wy.stripe_account_id, wy.created_at, wy.expires_at, wy.settle_tries,
              wy.status, null::text as voucher, wy.livemode
  )
  select * from pu
  union all
  select * from yu
  order by created_at;
end;
$function$;

revoke all on function public.wallet_settle_batch(integer) from public, anon, authenticated;
grant execute on function public.wallet_settle_batch(integer) to service_role;

comment on function public.wallet_settle_batch(integer) is
  'MESITA-3305 Wallet: the cron''s batch: up to p_limit open purchases and p_limit open payments, oldest first, for update skip locked, settle_tries bumped. Service role only.';

-- The cron gives up on a row (48 ticks, or Stripe 404): needs_review with
-- the last Stripe code, paid_at null, no entry, excluded from every balance
-- (held credit is released since the status leaves opening/open).
create or replace function public.wallet_give_up(p_kind text, p_row_id uuid, p_error text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  if p_kind = 'purchase' then
    update public.wallet_purchases set status = 'needs_review', stripe_error = p_error, updated_at = now()
     where id = p_row_id and status in ('opening', 'open');
  elsif p_kind = 'payment' then
    update public.wallet_payments set status = 'needs_review', stripe_error = p_error, updated_at = now()
     where id = p_row_id and status in ('opening', 'open');
  else
    return jsonb_build_object('ok', false, 'code', 'bad_kind');
  end if;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'outcome', case when v_n = 0 then 'unchanged' else 'needs_review' end);
end;
$function$;

revoke all on function public.wallet_give_up(text, uuid, text) from public, anon, authenticated;
grant execute on function public.wallet_give_up(text, uuid, text) to service_role;

-- The operator sends a given-up row back to the cron (R31; W3 gets the
-- button, until then one SQL call under an issue). Only a row that was
-- never paid can be re-read; a paid needs_review (an uncovered refund) is
-- the operator refund's business.
create or replace function public.wallet_reopen_settle(p_kind text, p_row_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  if p_kind = 'purchase' then
    update public.wallet_purchases set status = 'open', settle_tries = 0, stripe_error = null, updated_at = now()
     where id = p_row_id and status = 'needs_review' and paid_at is null;
  elsif p_kind = 'payment' then
    update public.wallet_payments set status = 'open', settle_tries = 0, stripe_error = null, updated_at = now()
     where id = p_row_id and status = 'needs_review' and paid_at is null;
  else
    return jsonb_build_object('ok', false, 'code', 'bad_kind');
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_reopenable');
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'reopened');
end;
$function$;

revoke all on function public.wallet_reopen_settle(text, uuid) from public, anon, authenticated;
grant execute on function public.wallet_reopen_settle(text, uuid) to service_role;

comment on function public.wallet_reopen_settle(text, uuid) is
  'MESITA-3305 Wallet (operator): a needs_review row that was never paid goes back to open with settle_tries 0 and no stripe_error, so the next cron tick re-reads it. Service role only.';

-- Mesita's fee that followed a refund, written beside the refund itself.
create or replace function public.wallet_note_fee_refund(p_kind text, p_row_id uuid, p_fee_refunded_cents integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if p_fee_refunded_cents is null or p_fee_refunded_cents < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  if p_kind = 'purchase' then
    update public.wallet_purchases
       set fee_refunded_cents = least(greatest(fee_refunded_cents, p_fee_refunded_cents), application_fee_cents), updated_at = now()
     where id = p_row_id;
  elsif p_kind = 'payment' then
    update public.wallet_payments
       set fee_refunded_cents = least(greatest(fee_refunded_cents, p_fee_refunded_cents), application_fee_cents), updated_at = now()
     where id = p_row_id;
  else
    return jsonb_build_object('ok', false, 'code', 'bad_kind');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.wallet_note_fee_refund(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.wallet_note_fee_refund(text, uuid, integer) to service_role;

-- A place's outstanding credit across every guest (Available plus Pending),
-- for the test-mode cap on buying (rule 15, d5a): one number, no lock; an
-- overshoot by one voucher under a race is accepted.
create or replace function public.wallet_place_outstanding(p_place_id uuid, p_currency text, p_livemode boolean)
 returns integer
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(amount_cents), 0)::integer
    from public.wallet_entries
   where place_id = p_place_id and currency = lower(p_currency) and livemode = p_livemode;
$function$;

revoke all on function public.wallet_place_outstanding(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.wallet_place_outstanding(uuid, text, boolean) to service_role;

-- The waiter's charges (W2c writes them): a paid one is kept 24 h, an
-- unpaid expired one goes at once. Run by the cron each tick.
create or replace function public.place_charges_sweep()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  delete from public.place_charges
   where (paid_at is not null and paid_at < now() - interval '24 hours')
      or (paid_at is null and payment_id is null and expires_at < now());
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;

revoke all on function public.place_charges_sweep() from public, anon, authenticated;
grant execute on function public.place_charges_sweep() to service_role;

-- ── 6. Refunds of a mixed payment ──────────────────────────────────────────
-- Stripe's cumulative amount_refunded over card + tip. The delta against the
-- stored baseline is attributed to the card part first, then the tip
-- (tip_refunded_cents). The cashback to take back is the refunded share of
-- the card part (all of it once the card part is fully refunded), capped at
-- what the guest still holds here; the rest is uncovered_cents and the row
-- reads needs_review. The fee stays as charged; wallet_note_fee_refund
-- records what followed. Same signature as W1a's.
create or replace function public.wallet_refund_payment(p_payment_id uuid, p_amount_refunded integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_ceiling integer;
  v_new_refunded integer;
  v_delta integer;
  v_card_refunded integer;
  v_tip_refunded integer;
  v_target integer := 0;
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
  if v.paid_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  v_ceiling := v.card_cents + v.tip_cents;
  v_new_refunded := least(p_amount_refunded, v_ceiling);
  v_delta := v_new_refunded - v.refunded_cents;
  if v_delta <= 0 then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied', 'refunded_cents', v.refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  v_card_refunded := least(v_new_refunded, v.card_cents);
  v_tip_refunded := v_new_refunded - v_card_refunded;

  if v.cashback_cents > 0 and v.card_cents > 0 then
    v_target := case when v_card_refunded >= v.card_cents then v.cashback_cents
                     else (v.cashback_cents * v_card_refunded) / v.card_cents end;
    v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                         where payment_id = v.id and kind = 'reversal'), 0) + v.uncovered_cents;
    v_to_reverse := greatest(v_target - v_done, 0);
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
    when v_new_refunded >= v_ceiling then 'refunded'
    else 'partly_refunded'
  end;

  update public.wallet_payments
     set refunded_cents = v_new_refunded,
         tip_refunded_cents = v_tip_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'card_refunded_cents', v_card_refunded, 'tip_refunded_cents', v_tip_refunded,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;

comment on function public.wallet_refund_payment(uuid, integer) is
  'MESITA-3305 Wallet: applies Stripe''s cumulative amount_refunded over card + tip: card first, then tip; the refunded share of the card part takes back that share of the cashback (all of it on a full card refund), capped at the credit the guest still holds; the rest is uncovered_cents and needs_review. Replay-safe. Service role only.';

-- ── 7. The settle cron ─────────────────────────────────────────────────────
-- Every 5 minutes, the same shape as sync-premier (20261029090000). The
-- function is the bounded backstop behind the receiver: the wallet read is
-- the third path. Kill switch: select cron.unschedule('settle-wallet');
select cron.unschedule('settle-wallet')
where exists (select 1 from cron.job where jobname = 'settle-wallet');

select cron.schedule(
  'settle-wallet',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-settle-wallet',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'scheduler_service_role_key'
      ),
      'X-Internal-Caller', 'pg_cron'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ── 8. Post-flight ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wallet_payments_refunded_within_charge_chk')
     or exists (select 1 from pg_constraint where conname = 'wallet_payments_refunded_within_card_chk') then
    raise exception 'the refund ceiling was not rewritten';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'wallet_settle_payment')
     or not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'wallet_hold_payment') then
    raise exception 'the W2b functions are missing after apply';
  end if;
  if not exists (select 1 from cron.job where jobname = 'settle-wallet') then
    raise exception 'the settle-wallet cron job is missing after apply';
  end if;
end $$;
