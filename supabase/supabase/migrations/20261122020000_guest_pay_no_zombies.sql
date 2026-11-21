-- MESITA-4524 — no zombie tickets. Every guest pay attempt ends: closed
-- (paid, a pay_tabs ticket) or released with one end_reason.
--
--   card / wallet: Bill · Tip · Method · Confirm · Pay · Receipt. "Show the
--     waiter" places a HOLD (held_at once Stripe reads requires_capture);
--     the waiter's Confirm claims the attempt (charging_at) and captures it.
--   cash: Bill · Tip · Method · Pay · Confirm · Receipt. "I gave the cash"
--     opens it due; the waiter's Confirm closes it.
--   credits-only: held at once (a held credit row); the waiter's Confirm
--     spends it and closes.
--
-- Every transition that also talks to Stripe is CLAIM -> Stripe -> FINISH:
-- supabase-js has no multi-statement transactions, so no row lock can span
-- a Stripe call. A claim is a conditional update; whoever loses gets
-- `charging` or `already_final`. A release happens only after Stripe reads
-- back that nothing was charged (the Edge Functions check; these functions
-- only record it).

alter table public.guest_pay_attempts
  add column if not exists end_reason text
    check (end_reason is null or end_reason in ('declined', 'rejected', 'expired', 'cancelled')),
  add column if not exists held_at timestamptz,
  add column if not exists charging_at timestamptz,
  add column if not exists ending_at timestamptz,
  add column if not exists ending_reason text
    check (ending_reason is null or ending_reason in ('declined', 'rejected', 'expired', 'cancelled')),
  add column if not exists needs_review_at timestamptz,
  add column if not exists prev_token_hash text check (prev_token_hash is null or prev_token_hash ~ '^[0-9a-f]{64}$'),
  add column if not exists prev_token_until timestamptz,
  add column if not exists confirmed_key_hash text;

comment on column public.guest_pay_attempts.end_reason is
  'MESITA-4524: why a released attempt did not pay: declined, rejected, expired or cancelled. Null unless released.';
comment on column public.guest_pay_attempts.held_at is
  'MESITA-4524: when the money was held (card: Stripe read requires_capture; cash and credits: at creation). The QR and Confirm need it.';
comment on column public.guest_pay_attempts.charging_at is
  'MESITA-4524: the waiter''s Confirm claim. Set once; a charging attempt is released only after Stripe reads back not charged.';
comment on column public.guest_pay_attempts.ending_at is
  'MESITA-4524: a Cancel, Reject or expiry claim (ending_reason says which). Refused once charging_at is set.';

-- Rows written before this migration that are already released get a reason.
update public.guest_pay_attempts set end_reason = 'cancelled' where status = 'released' and end_reason is null;
update public.guest_pay_attempts set held_at = created_at where held_at is null and status in ('due', 'closed');

alter table public.guest_pay_attempts
  add constraint guest_pay_attempts_end_reason_iff_released
  check ((status = 'released') = (end_reason is not null));

create index if not exists guest_pay_attempts_open_expiry
  on public.guest_pay_attempts (expires_at)
  where status in ('opening', 'due');

-- The one place a phase is computed.
create or replace function public.guest_pay_phase(a public.guest_pay_attempts)
 returns text
 language sql
 immutable
as $function$
  select case
    when a.status = 'closed' then 'closed'
    when a.status = 'released' then 'released'
    when a.charging_at is not null then 'charging'
    when a.held_at is null then 'placing_hold'
    else 'live'
  end;
$function$;

-- ── Begin ──────────────────────────────────────────────────────────────────

drop function if exists public.pay_guest_begin(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz);

create or replace function public.pay_guest_begin(
  p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_token_hash text,
  p_bill_cents integer, p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer, p_request_id uuid,
  p_stripe_account_id text, p_card_fee_cents integer, p_window_minutes integer default 15,
  p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
  v_open public.guest_pay_attempts;
  v_spendable integer;
  v_pay uuid;
  v_label text;
  v_tender text;
  v_expires timestamptz := p_now + make_interval(mins => greatest(least(coalesce(p_window_minutes, 15), 120), 5));
  v_cur text := lower(p_currency);
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'bad_request');
  end if;
  if coalesce(p_bill_cents, 0) <= 0
     or coalesce(p_credit_cents, -1) < 0 or coalesce(p_cash_bill_cents, -1) < 0
     or coalesce(p_cash_tip_cents, -1) < 0 or coalesce(p_card_bill_cents, -1) < 0
     or coalesce(p_card_tip_cents, -1) < 0 then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'amount_required');
  end if;
  if p_credit_cents + p_cash_bill_cents + p_card_bill_cents <> p_bill_cents
     or p_credit_cents > p_bill_cents
     or (p_cash_tip_cents > 0 and p_card_tip_cents > 0)
     or (p_cash_bill_cents + p_cash_tip_cents > 0 and p_card_bill_cents + p_card_tip_cents > 0) then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'parts');
  end if;

  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into a from public.guest_pay_attempts
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    return jsonb_build_object(
      'ok', true, 'outcome', 'replayed', 'attempt_id', a.id, 'tab_id', a.tab_id,
      'status', a.status, 'phase', public.guest_pay_phase(a), 'payment_id', a.payment_id,
      'card_payment_id', case when a.tender = 'card' then a.payment_id end,
      'expires_at', a.expires_at, 'cash_cents', a.cash_cents, 'guest_label', a.guest_label);
  end if;

  -- An open attempt of this guest: one past its window that holds no card
  -- PaymentIntent ends here (expired); anything else is still live or needs
  -- Stripe first (the Edge Function ends it, then begins again).
  select * into v_open from public.guest_pay_attempts
   where consumer_id = p_consumer_id and livemode = p_livemode and status in ('opening', 'due')
   limit 1;
  if found then
    if v_open.expires_at <= p_now and v_open.charging_at is null
       and not exists (select 1 from public.wallet_payments w
                        where w.id = v_open.payment_id and w.stripe_payment_intent_id is not null
                          and w.status in ('opening', 'open')) then
      update public.wallet_payments
         set status = 'expired', updated_at = now()
       where id = v_open.payment_id and paid_at is null and status in ('opening', 'open');
      update public.guest_pay_attempts
         set status = 'released', end_reason = 'expired', ending_at = coalesce(ending_at, p_now), ending_reason = coalesce(ending_reason, 'expired')
       where id = v_open.id;
      raise log '[guest-pay] %', jsonb_build_object('attempt_id', v_open.id, 'from', public.guest_pay_phase(v_open), 'to', 'released', 'reason', 'expired', 'source', 'begin');
    else
      raise exception 'guest_refused:%', jsonb_build_object(
        'code', 'too_many_open', 'open_attempt_id', v_open.id, 'open_place_id', v_open.place_id,
        'open_expired', v_open.expires_at <= p_now);
    end if;
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_consumer_id, p_place_id, v_cur, p_livemode) b;
  if p_credit_cents > coalesce(v_spendable, 0) then
    raise exception 'guest_refused:%', jsonb_build_object(
      'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
  end if;

  select coalesce(nullif(trim(first_name), ''), 'Guest') into v_label
    from public.consumers where id = p_consumer_id;
  v_label := coalesce(left(v_label, 40), 'Guest');

  if p_card_bill_cents + p_card_tip_cents > 0 then
    v_tender := 'card';
  elsif p_cash_bill_cents + p_cash_tip_cents > 0 then
    v_tender := 'cash';
  else
    v_tender := 'credits';
  end if;

  -- Every row below that carries credit is open: wallet_balance holds that
  -- credit until the close spends it or a release frees it.
  if v_tender = 'card' then
    if p_stripe_account_id is null then
      raise exception 'guest_refused:%', jsonb_build_object('code', 'card_unavailable');
    end if;
    insert into public.wallet_payments (
      consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents, tip_cents,
      currency, status, stripe_account_id, application_fee_cents, request_id, livemode, expires_at, part)
    values (
      p_consumer_id, p_place_id, p_credit_cents + p_card_bill_cents, p_credit_cents, p_card_bill_cents, 0,
      p_card_tip_cents, v_cur, 'opening', p_stripe_account_id, greatest(coalesce(p_card_fee_cents, 0), 0),
      md5(p_request_id::text || ':card')::uuid, p_livemode, v_expires, 'card')
    returning id into v_pay;
  elsif v_tender = 'cash' and p_credit_cents + p_cash_bill_cents > 0 then
    insert into public.wallet_payments (
      consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents, tip_cents,
      currency, status, request_id, livemode, expires_at, part)
    values (
      p_consumer_id, p_place_id, p_credit_cents + p_cash_bill_cents, p_credit_cents, 0, p_cash_bill_cents,
      p_cash_tip_cents, v_cur, 'open', p_request_id, p_livemode, v_expires, 'outside')
    returning id into v_pay;
  elsif v_tender = 'credits' then
    insert into public.wallet_payments (
      consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents, tip_cents,
      currency, status, request_id, livemode, expires_at, part)
    values (
      p_consumer_id, p_place_id, p_credit_cents, p_credit_cents, 0, 0, 0,
      v_cur, 'open', p_request_id, p_livemode, v_expires, 'credit')
    returning id into v_pay;
  end if;

  insert into public.guest_pay_attempts (
    consumer_id, place_id, request_id, bill_cents, tip_cents, credit_cents, cash_cents, card_cents,
    currency, livemode, tender, status, payment_id, guest_label, token_hash, expires_at, held_at)
  values (
    p_consumer_id, p_place_id, p_request_id, p_bill_cents,
    case when v_tender = 'card' then p_card_tip_cents when v_tender = 'cash' then p_cash_tip_cents else 0 end,
    p_credit_cents,
    case when v_tender = 'cash' then p_cash_bill_cents + p_cash_tip_cents else 0 end,
    case when v_tender = 'card' then p_card_bill_cents + p_card_tip_cents else 0 end,
    v_cur, p_livemode, v_tender,
    case when v_tender = 'cash' then 'due' else 'opening' end,
    v_pay, v_label, p_token_hash, v_expires,
    case when v_tender = 'card' then null else p_now end)
  returning * into a;

  raise log '[guest-pay] %', jsonb_build_object('attempt_id', a.id, 'from', null, 'to', public.guest_pay_phase(a), 'reason', 'begin', 'source', 'begin', 'tender', v_tender);
  return jsonb_build_object(
    'ok', true, 'outcome', 'opened', 'attempt_id', a.id, 'tab_id', null,
    'status', a.status, 'phase', public.guest_pay_phase(a), 'payment_id', v_pay,
    'card_payment_id', case when v_tender = 'card' then v_pay end,
    'expires_at', v_expires, 'cash_cents', a.cash_cents, 'guest_label', v_label);
end;
$function$;

-- ── The hold landed ────────────────────────────────────────────────────────

create or replace function public.pay_guest_mark_held(p_attempt_id uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
begin
  update public.guest_pay_attempts
     set held_at = p_now
   where id = p_attempt_id and status = 'opening' and held_at is null and ending_at is null
  returning * into a;
  if found then
    raise log '[guest-pay] %', jsonb_build_object('attempt_id', a.id, 'from', 'placing_hold', 'to', 'live', 'reason', 'held', 'source', 'ef');
    return jsonb_build_object('ok', true, 'outcome', 'held', 'phase', 'live');
  end if;
  select * into a from public.guest_pay_attempts where id = p_attempt_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'unchanged', 'phase', public.guest_pay_phase(a));
end;
$function$;

-- ── Claims ─────────────────────────────────────────────────────────────────

-- The waiter's Confirm. Wins only on a held, live attempt of this place
-- inside its window. A repeat answers the attempt's phase.
create or replace function public.pay_guest_claim_confirm(
  p_attempt_id uuid, p_place_id uuid, p_key_hash text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
  w public.wallet_payments;
begin
  select * into a from public.guest_pay_attempts where id = p_attempt_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if a.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  update public.guest_pay_attempts
     set charging_at = p_now, confirmed_key_hash = p_key_hash
   where id = a.id and status in ('opening', 'due') and held_at is not null
     and charging_at is null and ending_at is null and expires_at > p_now
  returning * into a;
  if not found then
    select * into a from public.guest_pay_attempts where id = p_attempt_id;
    if a.status = 'closed' then
      return jsonb_build_object('ok', true, 'outcome', 'already_confirmed', 'phase', 'closed', 'tab_id', a.tab_id);
    end if;
    if a.status = 'released' or a.ending_at is not null then
      return jsonb_build_object('ok', false, 'code', 'already_final', 'end_reason', coalesce(a.end_reason, a.ending_reason));
    end if;
    if a.charging_at is not null then
      return jsonb_build_object('ok', true, 'outcome', 'charging', 'phase', 'charging');
    end if;
    if a.held_at is null then
      return jsonb_build_object('ok', false, 'code', 'card_pending');
    end if;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  select * into w from public.wallet_payments where id = a.payment_id;
  raise log '[guest-pay] %', jsonb_build_object('attempt_id', a.id, 'from', 'live', 'to', 'charging', 'reason', 'confirm', 'source', 'ef');
  return jsonb_build_object(
    'ok', true, 'outcome', 'claimed', 'phase', 'charging', 'tender', a.tender,
    'payment_id', a.payment_id, 'payment_intent', w.stripe_payment_intent_id,
    'stripe_account_id', w.stripe_account_id, 'cash_cents', a.cash_cents);
end;
$function$;

-- Cancel, Reject or expiry. Refused once the waiter's Confirm claimed it.
-- p_consumer_id (the guest's own cancel) and p_place_id (the waiter's
-- Reject) scope who may end it; both null is the service's own sweep.
create or replace function public.pay_guest_claim_end(
  p_attempt_id uuid, p_reason text, p_consumer_id uuid default null, p_place_id uuid default null,
  p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
  w public.wallet_payments;
begin
  if p_reason is null or p_reason not in ('declined', 'rejected', 'expired', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  select * into a from public.guest_pay_attempts where id = p_attempt_id;
  if not found
     or (p_consumer_id is not null and a.consumer_id is distinct from p_consumer_id) then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if p_place_id is not null and a.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  update public.guest_pay_attempts
     set ending_at = p_now, ending_reason = p_reason
   where id = a.id and status in ('opening', 'due') and charging_at is null and ending_at is null
  returning * into a;
  if not found then
    select * into a from public.guest_pay_attempts where id = p_attempt_id;
    if a.status = 'closed' then
      return jsonb_build_object('ok', false, 'code', 'already_final', 'phase', 'closed', 'tab_id', a.tab_id);
    end if;
    if a.status = 'released' then
      return jsonb_build_object('ok', true, 'outcome', 'already', 'phase', 'released', 'end_reason', a.end_reason);
    end if;
    if a.charging_at is not null then
      return jsonb_build_object('ok', false, 'code', 'charging');
    end if;
    -- Someone else is ending it: their reason stands.
    return jsonb_build_object('ok', true, 'outcome', 'ending', 'ending_reason', a.ending_reason,
      'payment_id', a.payment_id);
  end if;
  select * into w from public.wallet_payments where id = a.payment_id;
  return jsonb_build_object(
    'ok', true, 'outcome', 'claimed', 'ending_reason', p_reason, 'tender', a.tender,
    'payment_id', a.payment_id, 'payment_intent', w.stripe_payment_intent_id,
    'stripe_account_id', w.stripe_account_id, 'payment_status', w.status);
end;
$function$;

-- ── Finish ─────────────────────────────────────────────────────────────────

-- Release: only after the caller read Stripe back as not charged. Frees the
-- held credit (the payment row fails). A paid payment is never released.
create or replace function public.pay_guest_finish_release(
  p_attempt_id uuid, p_reason text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
  w public.wallet_payments;
  v_from text;
begin
  if p_reason is null or p_reason not in ('declined', 'rejected', 'expired', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  select * into a from public.guest_pay_attempts where id = p_attempt_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  perform public.wallet_lock(a.consumer_id, a.place_id);
  select * into a from public.guest_pay_attempts where id = p_attempt_id for update;
  if a.status = 'closed' then
    return jsonb_build_object('ok', false, 'code', 'already_final', 'phase', 'closed', 'tab_id', a.tab_id);
  end if;
  if a.status = 'released' then
    return jsonb_build_object('ok', true, 'outcome', 'already', 'end_reason', a.end_reason);
  end if;
  if a.payment_id is not null then
    select * into w from public.wallet_payments where id = a.payment_id for update;
    if w.paid_at is not null then
      return jsonb_build_object('ok', false, 'code', 'paid');
    end if;
    update public.wallet_payments
       set status = 'failed', stripe_error = coalesce(stripe_error, 'guest_' || p_reason), updated_at = now()
     where id = w.id and paid_at is null and status in ('opening', 'open');
  end if;
  v_from := public.guest_pay_phase(a);
  update public.guest_pay_attempts
     set status = 'released', end_reason = p_reason,
         ending_at = coalesce(ending_at, p_now), ending_reason = coalesce(ending_reason, p_reason)
   where id = a.id;
  raise log '[guest-pay] %', jsonb_build_object('attempt_id', a.id, 'from', v_from, 'to', 'released', 'reason', p_reason, 'source', 'ef');
  return jsonb_build_object('ok', true, 'outcome', 'released', 'end_reason', p_reason);
end;
$function$;

-- Close: the ticket. Card: the payment is paid (Stripe captured; the settle
-- already spent the credit). Cash and credits: needs the waiter's Confirm
-- claim; the held credit is spent here, once.
create or replace function public.pay_guest_close(p_attempt_id uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
  w public.wallet_payments;
  v_tab uuid;
begin
  select * into a from public.guest_pay_attempts where id = p_attempt_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(a.consumer_id, a.place_id);
  select * into a from public.guest_pay_attempts where id = p_attempt_id for update;
  if a.status = 'closed' then
    return jsonb_build_object('ok', true, 'outcome', 'already', 'attempt_id', a.id, 'tab_id', a.tab_id, 'status', 'paid');
  end if;
  if a.status = 'released' then
    return jsonb_build_object('ok', false, 'code', 'released', 'end_reason', a.end_reason);
  end if;
  if a.payment_id is not null then
    select * into w from public.wallet_payments where id = a.payment_id for update;
  end if;
  if a.tender = 'card' then
    if w.paid_at is null then
      return jsonb_build_object('ok', false, 'code', 'card_pending');
    end if;
  else
    if a.charging_at is null then
      return jsonb_build_object('ok', false, 'code', 'not_confirmed');
    end if;
    if a.payment_id is not null and w.paid_at is null then
      if w.status not in ('opening', 'open') then
        return jsonb_build_object('ok', false, 'code', 'released');
      end if;
      update public.wallet_payments set status = 'paid', paid_at = p_now, updated_at = now() where id = w.id;
      if w.credit_cents > 0 then
        insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
        values (w.consumer_id, w.place_id, 'spend', -w.credit_cents, w.currency, w.id, w.livemode, p_now);
      end if;
    end if;
  end if;
  v_tab := public.pay_guest_insert_closed(a, p_now);
  if a.confirmed_key_hash ~ '^[0-9a-f]{64}$' then
    update public.pay_tabs set verified_key_hash = a.confirmed_key_hash where id = v_tab;
  end if;
  raise log '[guest-pay] %', jsonb_build_object('attempt_id', a.id, 'from', public.guest_pay_phase(a), 'to', 'closed', 'reason', 'paid', 'source', 'ef', 'tab_id', v_tab);
  return jsonb_build_object('ok', true, 'outcome', 'closed', 'attempt_id', a.id, 'tab_id', v_tab, 'status', 'paid');
end;
$function$;

-- The guest's dismiss of a wallet sheet (or a refused hold) before any
-- Confirm: by request id, through the same claim-free release (no PaymentIntent
-- was ever confirmed, so nothing can be charged). Kept for the phone's retry.
create or replace function public.pay_guest_release(p_consumer_id uuid, p_request_id uuid, p_reason text default 'cancelled')
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
begin
  select * into a from public.guest_pay_attempts
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if not found then
    return jsonb_build_object('ok', true, 'outcome', 'none');
  end if;
  if a.charging_at is not null then
    return jsonb_build_object('ok', false, 'code', 'charging');
  end if;
  return public.pay_guest_finish_release(a.id, coalesce(p_reason, 'cancelled'));
end;
$function$;
drop function if exists public.pay_guest_release(uuid, uuid);

-- The owner's Received on Business › Payments (fallback for cash).
create or replace function public.pay_guest_receive(
  p_attempt_id uuid, p_place_id uuid, p_amount_cents integer, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
begin
  select * into a from public.guest_pay_attempts where id = p_attempt_id;
  if not found or a.tender <> 'cash' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if a.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if a.status = 'closed' then
    return jsonb_build_object('ok', true, 'outcome', 'already', 'tab_id', a.tab_id, 'status', 'paid');
  end if;
  if a.status = 'released' then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if p_amount_cents is distinct from a.cash_cents then
    return jsonb_build_object('ok', false, 'code', 'amount_changed', 'cash_cents', a.cash_cents);
  end if;
  update public.guest_pay_attempts
     set charging_at = coalesce(charging_at, p_now)
   where id = a.id and status = 'due' and ending_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  return (select jsonb_set(r, '{outcome}', to_jsonb(case when r->>'outcome' = 'closed' then 'received' else r->>'outcome' end))
            from (select public.pay_guest_close(a.id, p_now) as r) x);
end;
$function$;

-- What the sweep must look at: open attempts past their window (not being
-- confirmed, not a hold still being placed under 2 minutes old), attempts
-- the waiter confirmed that have not finished, and ending claims that did
-- not finish within a minute. At most p_limit.
create or replace function public.pay_guest_sweep_list(p_now timestamptz default now(), p_limit integer default 50)
 returns table (attempt_id uuid, phase text, tender text, ending_reason text, charging_at timestamptz,
                payment_id uuid, payment_intent text, stripe_account_id text, payment_status text, needs_review_at timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select a.id, public.guest_pay_phase(a), a.tender, a.ending_reason, a.charging_at,
         a.payment_id, w.stripe_payment_intent_id, w.stripe_account_id, w.status, a.needs_review_at
    from public.guest_pay_attempts a
    left join public.wallet_payments w on w.id = a.payment_id
   where a.status in ('opening', 'due')
     and (
       (a.charging_at is null and a.ending_at is null and a.expires_at <= p_now
         and not (a.held_at is null and a.created_at > p_now - interval '2 minutes'))
       or a.charging_at is not null
       or (a.ending_at is not null and a.ending_at < p_now - interval '1 minute')
     )
   order by a.expires_at
   limit greatest(least(coalesce(p_limit, 50), 200), 1);
$function$;

create or replace function public.pay_guest_mark_review(p_attempt_id uuid, p_now timestamptz default now())
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.guest_pay_attempts set needs_review_at = coalesce(needs_review_at, p_now)
   where id = p_attempt_id and status in ('opening', 'due');
$function$;

-- A reload of the guest's phone: a new QR; the old one works 60 seconds more.
create or replace function public.pay_guest_reissue_token(
  p_attempt_id uuid, p_consumer_id uuid, p_token_hash text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.guest_pay_attempts;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'bad_request');
  end if;
  select * into a from public.guest_pay_attempts where id = p_attempt_id for update;
  if not found or a.consumer_id is distinct from p_consumer_id then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if a.status not in ('opening', 'due') or a.expires_at <= p_now then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;
  if a.prev_token_until is not null and a.prev_token_until > p_now + interval '30 seconds' then
    return jsonb_build_object('ok', false, 'code', 'too_soon');
  end if;
  update public.guest_pay_attempts
     set prev_token_hash = token_hash, prev_token_until = p_now + interval '60 seconds', token_hash = p_token_hash
   where id = a.id;
  return jsonb_build_object('ok', true, 'outcome', 'reissued');
end;
$function$;

-- ── One-time cleanup ───────────────────────────────────────────────────────

-- Attempts past their window with no card PaymentIntent end now; any other
-- open attempt is left to the sweep, which reads Stripe first.
update public.wallet_payments w
   set status = 'expired', updated_at = now()
  from public.guest_pay_attempts a
 where a.payment_id = w.id and a.status in ('opening', 'due') and a.expires_at <= now() - interval '30 minutes'
   and w.paid_at is null and w.status in ('opening', 'open') and w.stripe_payment_intent_id is null;
update public.guest_pay_attempts a
   set status = 'released', end_reason = 'expired', ending_at = now(), ending_reason = 'expired'
 where a.status in ('opening', 'due') and a.expires_at <= now() - interval '30 minutes'
   and not exists (select 1 from public.wallet_payments w
                    where w.id = a.payment_id and w.stripe_payment_intent_id is not null and w.paid_at is null
                      and w.status in ('opening', 'open'));

-- An old guest bill paid in full but never signed is a paid ticket.
update public.pay_tabs
   set verified_at = coalesce(paid_at, now()),
       verified_key_hash = 'cc873e0cc5c6d9a278d6804d17e2b06e46cd1e68701b86cbe7a87675f6121775',
       updated_at = now()
 where origin = 'guest' and status = 'paid' and verified_at is null and expires_at <= now();

-- ── Grants ─────────────────────────────────────────────────────────────────

revoke all on function public.guest_pay_phase(public.guest_pay_attempts) from public, anon, authenticated;
revoke all on function public.pay_guest_begin(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_mark_held(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_claim_confirm(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_claim_end(uuid, text, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_finish_release(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_close(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_release(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.pay_guest_receive(uuid, uuid, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_sweep_list(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.pay_guest_mark_review(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_guest_reissue_token(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.guest_pay_phase(public.guest_pay_attempts) to service_role;
grant execute on function public.pay_guest_begin(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz) to service_role;
grant execute on function public.pay_guest_mark_held(uuid, timestamptz) to service_role;
grant execute on function public.pay_guest_claim_confirm(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.pay_guest_claim_end(uuid, text, uuid, uuid, timestamptz) to service_role;
grant execute on function public.pay_guest_finish_release(uuid, text, timestamptz) to service_role;
grant execute on function public.pay_guest_close(uuid, timestamptz) to service_role;
grant execute on function public.pay_guest_release(uuid, uuid, text) to service_role;
grant execute on function public.pay_guest_receive(uuid, uuid, integer, timestamptz) to service_role;
grant execute on function public.pay_guest_sweep_list(timestamptz, integer) to service_role;
grant execute on function public.pay_guest_mark_review(uuid, timestamptz) to service_role;
grant execute on function public.pay_guest_reissue_token(uuid, uuid, text, timestamptz) to service_role;
