-- MESITA-3856 (Pay W1b, Payments Flow Guest-Lead, 2026-11-14): a guest's
-- card is held, not charged, until the waiter signs.
--
--   * The card part is a manual-capture PaymentIntent. When Stripe holds it
--     (requires_capture) the row gets held_at and stays open, so its credit
--     stays held; the bill's ten minutes start then (wallet_card_held).
--   * Sign on a bill with a held card: pay_tab_begin_capture marks the bill
--     signing (X, Reject and the cron wait), the Edge Function captures with
--     an idempotency key, and wallet_settle_payment turns the hold into the
--     spend and (pay_tab_finish_signing) stamps the signature and writes the
--     cashback, in one transaction, whoever settles it. A
--     failed capture ends the bill: pay_tab_capture_failed (end_reason
--     capture_failed, nothing charged, credit released).
--   * X, Reject and expiry may now end a bill whose card is held: the card
--     row expires with the others (the credit is released), and the Edge
--     Function or the cron cancels the Stripe hold (wallet_released_holds,
--     wallet_hold_cancelled).
--   * A bill being captured is never expired, cancelled or rejected.

alter table public.wallet_payments add column if not exists held_at timestamptz;
alter table public.wallet_payments add column if not exists hold_cancelled_at timestamptz;
alter table public.pay_tabs add column if not exists signing_at timestamptz;
comment on column public.wallet_payments.held_at is
  'MESITA-3856: when Stripe held this guest card part for the waiter (requires_capture). An open row with held_at is waiting for the signature, not going through.';
comment on column public.wallet_payments.hold_cancelled_at is
  'MESITA-3856: when the Stripe hold of a card part whose bill ended unpaid was cancelled.';
comment on column public.pay_tabs.signing_at is
  'MESITA-3856: the waiter signed a bill with a held card and its capture is in progress since then; cleared when the capture fails.';

alter table public.pay_tabs drop constraint if exists pay_tabs_end_reason_chk;
alter table public.pay_tabs add constraint pay_tabs_end_reason_chk
  check (end_reason is null or end_reason in ('cancelled', 'rejected', 'expired', 'capture_failed'));

create index if not exists wallet_payments_released_holds on public.wallet_payments (updated_at)
  where held_at is not null and hold_cancelled_at is null and paid_at is null;

create or replace function public.pay_tab_verify(
  p_tab_id uuid, p_place_id uuid, p_staff_key_hash text, p_received_cents integer default null,
  p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  w public.wallet_payments;
  v_received integer;
  v_tip integer;
  v_res jsonb;
  v_cashback integer := 0;
  v_card_back integer := 0;
begin
  if p_staff_key_hash is null or p_staff_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'pay_tab_verify: a staff key hash is required';
  end if;
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.origin <> 'guest' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.verified_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_verified', 'tab_id', v.id,
      'verified_at', v.verified_at, 'same_phone', v.verified_key_hash = p_staff_key_hash);
  end if;
  if v.status in ('cancelled', 'expired') then
    return jsonb_build_object('ok', false, 'code', v.status);
  end if;
  -- MESITA-3856: a capture the waiter started before the window closed finishes.
  if v.expires_at <= p_now and v.signing_at is null then
    return jsonb_build_object('ok', false, 'code', 'expired', 'expires_at', v.expires_at);
  end if;
  if exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
    return jsonb_build_object('ok', false, 'code', 'card_pending');
  end if;

  -- MESITA-3843: the credit held for this bill is spent now, at the signature.
  for w in
    select * from public.wallet_payments
     where tab_id = v.id and part = 'credit' and status = 'open' and paid_at is null
     for update
  loop
    update public.wallet_payments set status = 'paid', paid_at = p_now, updated_at = now() where id = w.id;
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (w.consumer_id, w.place_id, 'spend', -w.credit_cents, w.currency, w.id, w.livemode, p_now);
  end loop;

  if v.status = 'paying' and v.cash_bill_cents + v.cash_tip_cents = 0 then
    update public.pay_tabs
       set status = 'paid', paid_at = coalesce(paid_at, p_now),
           verified_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    raise log '[pay-tab] %', jsonb_build_object('tab_id', v.id, 'place_id', v.place_id, 'from', 'paying', 'to', 'paid', 'reason', 'signed');
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now,
      'cashback_cents', 0, 'card_cashback_cents', 0);
  end if;

  if v.status = 'paying' and v.cash_bill_cents + v.cash_tip_cents > 0 then
    v_received := coalesce(p_received_cents, v.cash_bill_cents + v.cash_tip_cents);
    if v_received < 0 or v_received > 10000000 then
      return jsonb_build_object('ok', false, 'code', 'amount_required');
    end if;
    if v_received < v.cash_bill_cents then
      return jsonb_build_object('ok', false, 'code', 'short', 'missing_cents', v.cash_bill_cents - v_received,
        'cash_bill_cents', v.cash_bill_cents);
    end if;
    v_tip := least(v.cash_tip_cents, v_received - v.cash_bill_cents);
    if v.cash_bill_cents > 0 then
      select * into w from public.wallet_payments
       where tab_id = v.id and part = 'outside' and status in ('opening', 'open', 'paid')
       order by created_at desc limit 1
       for update;
      if not found then
        return jsonb_build_object('ok', false, 'code', 'expired');
      end if;
      if w.paid_at is null then
        update public.wallet_payments set tip_cents = v_tip, updated_at = now() where id = w.id;
      end if;
      v_res := public.wallet_confirm_outside(w.id, p_now);
      if not coalesce((v_res ->> 'ok')::boolean, false) then
        return v_res;
      end if;
      v_cashback := coalesce((v_res ->> 'cashback_cents')::int, 0);
    end if;
    update public.pay_tabs
       set status = 'paid', paid_at = coalesce(paid_at, p_now), cash_received_cents = v_received, cash_tip_cents = v_tip,
           verified_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    -- MESITA-3772: the card parts already settled earn now.
    v_card_back := public.pay_tab_card_cashback(v.id, p_now);
    raise log '[pay-tab] %', jsonb_build_object('tab_id', v.id, 'place_id', v.place_id, 'from', 'paying', 'to', 'paid', 'reason', 'signed');
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now,
      'cash_received_cents', v_received, 'cash_tip_cents', v_tip, 'cashback_cents', v_cashback + v_card_back,
      'card_cashback_cents', v_card_back);
  end if;

  if v.status = 'paid' then
    update public.pay_tabs set verified_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    v_card_back := public.pay_tab_card_cashback(v.id, p_now);
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now,
      'cashback_cents', v_card_back, 'card_cashback_cents', v_card_back);
  end if;
  return jsonb_build_object('ok', false, 'code', 'not_paid', 'status', v.status);
end;
$function$;

create or replace function public.pay_tab_change(p_tab_id uuid, p_consumer_id uuid, p_mode text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.consumer_id is distinct from p_consumer_id then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(p_consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.origin = 'guest' then
    -- A guest tab is paid as the guest tapped it; it is never billed again.
    -- cancel: only while nothing moved. close (MESITA-3772): cancels when
    -- nothing moved, else ends it now as the cron would, with no cashback.
    if p_mode not in ('cancel', 'close') then
      return jsonb_build_object('ok', false, 'code', 'guest_tab');
    end if;
    if v.status = 'cancelled' then
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;
    if v.verified_at is not null then
      return jsonb_build_object('ok', false, 'code', 'verified', 'verified_at', v.verified_at);
    end if;
    if v.status = 'expired' and p_mode = 'close' then
      return jsonb_build_object('ok', true, 'outcome', 'closed', 'tab_id', v.id);
    end if;
    if v.status not in ('paying', 'paid') then
      return jsonb_build_object('ok', false, 'code', v.status);
    end if;
    -- MESITA-3856: a card held for the waiter can be cancelled; one still
    -- going through, or being captured, cannot.
    if v.signing_at is not null or exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card'
                    and status in ('opening', 'open') and held_at is null) then
      return jsonb_build_object('ok', false, 'code', 'card_pending');
    end if;

    if not exists (select 1 from public.wallet_payments where tab_id = v.id and paid_at is not null) then
      if v.status <> 'paying' then
        return jsonb_build_object('ok', false, 'code', v.status);
      end if;
      update public.wallet_payments set status = 'expired', stripe_error = 'cancelled', updated_at = now()
       where tab_id = v.id and status in ('opening', 'open');
      update public.pay_tabs set status = 'cancelled', end_reason = 'cancelled', updated_at = now() where id = v.id;
      raise log '[pay-tab] %', jsonb_build_object('tab_id', v.id, 'place_id', v.place_id, 'from', 'paying', 'to', 'cancelled', 'reason', 'cancelled');
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;

    -- Money moved and nobody signed.
    if p_mode = 'cancel' then
      return jsonb_build_object('ok', false, 'code', 'paid_part');
    end if;
    if v.expires_at > now() then
      update public.pay_tabs set expires_at = now(), updated_at = now() where id = v.id;
    end if;
    perform public.pay_tab_guest_end(v.id, now());
    return jsonb_build_object('ok', true, 'outcome', 'closed', 'tab_id', v.id);
  end if;

  if p_mode = 'cancel' then
    if v.status in ('waiting_bill', 'billed') then
      update public.pay_tabs set status = 'cancelled', updated_at = now() where id = v.id;
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;
    if v.status = 'cancelled' then
      return jsonb_build_object('ok', true, 'outcome', 'cancelled', 'tab_id', v.id);
    end if;
    return jsonb_build_object('ok', false, 'code', v.status);
  elsif p_mode = 'change' then
    if v.status <> 'paying' then
      return jsonb_build_object('ok', false, 'code', v.status);
    end if;
    if exists (select 1 from public.wallet_payments where tab_id = v.id and paid_at is not null) then
      return jsonb_build_object('ok', false, 'code', 'paid_part');
    end if;
    update public.wallet_payments set status = 'expired', stripe_error = 'cancelled', updated_at = now()
     where tab_id = v.id and status in ('opening', 'open');
    update public.pay_tabs
       set status = 'billed', pay_request_id = null, paying_at = null,
           credit_cents = 0, cash_bill_cents = 0, cash_tip_cents = 0, card_bill_cents = 0, card_tip_cents = 0,
           updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'billed', 'tab_id', v.id, 'bill_version', v.bill_version);
  elsif p_mode = 'close' then
    return jsonb_build_object('ok', false, 'code', 'not_guest');
  end if;
  raise exception 'pay_tab_change: mode must be cancel, change or close';
end;
$function$;

create or replace function public.pay_tab_guest_end(p_tab_id uuid, p_now timestamptz default now())
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  w public.wallet_payments;
  v_res jsonb;
  v_pay uuid;
begin
  select * into v from public.pay_tabs where id = p_tab_id for update;
  if not found or v.origin <> 'guest' or v.status <> 'paying' or v.verified_at is not null then
    return false;
  end if;
  -- MESITA-3856: the cron never touches a bill being captured or a card
  -- still going through; a held card expires with the bill.
  if v.signing_at is not null or exists (select 1 from public.wallet_payments
              where tab_id = v.id and part = 'card' and status in ('opening', 'open') and held_at is null) then
    return false;
  end if;

  select * into w from public.wallet_payments
   where tab_id = v.id and part = 'outside' and paid_at is null
   order by created_at desc limit 1
   for update;
  if found then
    if w.status in ('opening', 'open') then
      update public.wallet_payments set status = 'expired', stripe_error = coalesce(stripe_error, 'not_verified'), updated_at = now()
       where id = w.id;
    end if;
    -- MESITA-3843: an unsigned bill spends no credit; expiring the row
    -- releases what it held.
  end if;
  update public.wallet_payments set status = 'expired', stripe_error = coalesce(stripe_error, 'not_verified'), updated_at = now()
   where tab_id = v.id and part in ('credit', 'card') and status in ('opening', 'open') and paid_at is null;

  update public.pay_tabs t
     set status = case when exists (select 1 from public.wallet_payments p where p.tab_id = t.id and p.paid_at is not null)
                       then 'paid' else 'expired' end,
         paid_at = case when exists (select 1 from public.wallet_payments p where p.tab_id = t.id and p.paid_at is not null)
                        then coalesce(t.paid_at, p_now) end,
         end_reason = case when exists (select 1 from public.wallet_payments p where p.tab_id = t.id and p.paid_at is not null)
                           then null else 'expired' end,
         updated_at = now()
   where t.id = v.id;
  raise log '[pay-tab] %', jsonb_build_object('tab_id', v.id, 'place_id', v.place_id, 'from', 'paying', 'to', 'ended', 'reason', 'expired');
  return true;
end;
$function$;

create or replace function public.pay_tab_reject(
  p_tab_id uuid, p_place_id uuid, p_staff_key_hash text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  if p_staff_key_hash is null or p_staff_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'pay_tab_reject: a staff key hash is required';
  end if;
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.origin <> 'guest' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.status = 'cancelled' and v.end_reason = 'rejected' then
    return jsonb_build_object('ok', true, 'outcome', 'already_rejected', 'tab_id', v.id);
  end if;
  if v.verified_at is not null then
    return jsonb_build_object('ok', false, 'code', 'verified', 'verified_at', v.verified_at);
  end if;
  if v.status <> 'paying' then
    return jsonb_build_object('ok', false, 'code', v.status);
  end if;
  if v.signing_at is not null or exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card'
                  and status in ('opening', 'open') and held_at is null) then
    return jsonb_build_object('ok', false, 'code', 'card_pending');
  end if;
  if exists (select 1 from public.wallet_payments where tab_id = v.id and paid_at is not null) then
    -- A card part already charged (until W1b holds it) cannot be rejected here.
    return jsonb_build_object('ok', false, 'code', 'paid_part');
  end if;

  update public.wallet_payments set status = 'expired', stripe_error = 'rejected', updated_at = now()
   where tab_id = v.id and status in ('opening', 'open');
  update public.pay_tabs set status = 'cancelled', end_reason = 'rejected', updated_at = now() where id = v.id;
  raise log '[pay-tab] %', jsonb_build_object('tab_id', v.id, 'place_id', v.place_id, 'from', 'paying', 'to', 'cancelled', 'reason', 'rejected');
  return jsonb_build_object('ok', true, 'outcome', 'rejected', 'tab_id', v.id);
end;
$function$;

-- A card hold succeeded (the PaymentIntent is requires_capture). The bill's
-- ten minutes start now. Answers what to do with the hold: keep it for the
-- waiter, capture it (a signature is in progress) or cancel it (the bill
-- ended while the guest was at the bank check).
create or replace function public.wallet_card_held(p_payment_id uuid, p_now timestamptz default now(),
  p_window interval default interval '10 minutes')
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w public.wallet_payments;
  v public.pay_tabs;
begin
  select * into w from public.wallet_payments where id = p_payment_id;
  if not found or w.part is distinct from 'card' or w.tab_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  select * into v from public.pay_tabs where id = w.tab_id;
  perform public.wallet_lock(w.consumer_id, w.place_id);
  select * into v from public.pay_tabs where id = w.tab_id for update;
  select * into w from public.wallet_payments where id = p_payment_id for update;

  if w.status in ('opening', 'open') and v.origin = 'guest' and v.status = 'paying'
     and v.verified_at is null and v.end_reason is null then
    if w.held_at is null then
      update public.wallet_payments set held_at = p_now, status = 'open', updated_at = now() where id = w.id;
      update public.pay_tabs set expires_at = p_now + p_window, updated_at = now() where id = v.id;
      update public.wallet_payments set expires_at = p_now + p_window, updated_at = now()
       where tab_id = v.id and part in ('outside', 'credit') and status in ('opening', 'open');
      raise log '[pay-tab] %', jsonb_build_object('tab_id', v.id, 'place_id', v.place_id, 'from', 'paying', 'to', 'held', 'reason', 'card_held');
      return jsonb_build_object('ok', true, 'decision', 'keep', 'tab_id', v.id, 'expires_at', p_now + p_window);
    end if;
    if v.signing_at is not null then
      return jsonb_build_object('ok', true, 'decision', 'capture', 'tab_id', v.id);
    end if;
    if v.expires_at > p_now then
      return jsonb_build_object('ok', true, 'decision', 'keep', 'tab_id', v.id, 'expires_at', v.expires_at);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'decision', 'cancel', 'tab_id', v.id);
end;
$function$;

-- The waiter taps Sign on a bill with a held card: the bill is being
-- captured from now on (X, Reject and expiry wait). Answers the hold to
-- capture, or none when the bill has no held card (pay_tab_verify signs it).
create or replace function public.pay_tab_begin_capture(
  p_tab_id uuid, p_place_id uuid, p_staff_key_hash text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  w public.wallet_payments;
begin
  if p_staff_key_hash is null or p_staff_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'pay_tab_begin_capture: a staff key hash is required';
  end if;
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.origin <> 'guest' then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.place_id is distinct from p_place_id then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;
  if v.verified_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'none');
  end if;

  select * into w from public.wallet_payments
   where tab_id = v.id and part = 'card' and status = 'open' and held_at is not null
   order by created_at desc limit 1
   for update;
  if not found then
    return jsonb_build_object('ok', true, 'outcome', 'none');
  end if;
  if v.signing_at is null then
    if v.status <> 'paying' then
      return jsonb_build_object('ok', false, 'code', v.status);
    end if;
    if v.expires_at <= p_now then
      return jsonb_build_object('ok', false, 'code', 'expired', 'expires_at', v.expires_at);
    end if;
    update public.pay_tabs set signing_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    raise log '[pay-tab] %', jsonb_build_object('tab_id', v.id, 'place_id', v.place_id, 'from', 'held', 'to', 'signing', 'reason', 'signed');
  end if;
  return jsonb_build_object('ok', true, 'outcome', 'capture', 'tab_id', v.id, 'payment_id', w.id,
    'payment_intent', w.stripe_payment_intent_id, 'stripe_account_id', w.stripe_account_id);
end;
$function$;

-- Stripe captured the hold (the card row is paid): the signature started in
-- pay_tab_begin_capture finishes, with the key and time it started with.
create or replace function public.pay_tab_finish_signing(p_payment_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  select t.* into v from public.pay_tabs t join public.wallet_payments w on w.tab_id = t.id where w.id = p_payment_id;
  if not found or v.signing_at is null or v.verified_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'nothing');
  end if;
  return public.pay_tab_verify(v.id, v.place_id, v.verified_key_hash, null, v.signing_at);
end;
$function$;

-- The capture failed: nothing is charged, the credit is released, the bill
-- ends (Not paid: the card charge failed).
create or replace function public.pay_tab_capture_failed(p_tab_id uuid, p_error text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
begin
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;
  if v.verified_at is not null or v.signing_at is null then
    return jsonb_build_object('ok', true, 'outcome', 'unchanged');
  end if;
  update public.wallet_payments set status = 'failed', stripe_error = coalesce(p_error, 'capture_failed'), updated_at = now()
   where tab_id = v.id and status in ('opening', 'open') and paid_at is null;
  update public.pay_tabs set status = 'cancelled', end_reason = 'capture_failed', signing_at = null, updated_at = now()
   where id = v.id;
  raise log '[pay-tab] %', jsonb_build_object('tab_id', v.id, 'place_id', v.place_id, 'from', 'signing', 'to', 'cancelled', 'reason', 'capture_failed');
  return jsonb_build_object('ok', true, 'outcome', 'failed');
end;
$function$;

-- Holds whose bill ended (X, Reject, expiry, a failed capture) and whose
-- Stripe hold is not cancelled yet: the Edge Functions and the cron cancel
-- each one, then stamp it.
create or replace function public.wallet_released_holds(p_tab_id uuid default null, p_limit integer default 50)
 returns table (id uuid, stripe_payment_intent_id text, stripe_account_id text)
 language sql
 security definer
 set search_path to 'public'
as $function$
  select w.id, w.stripe_payment_intent_id, w.stripe_account_id
    from public.wallet_payments w
   where w.held_at is not null and w.hold_cancelled_at is null and w.paid_at is null
     and w.status in ('expired', 'failed') and w.stripe_payment_intent_id is not null
     and (p_tab_id is null or w.tab_id = p_tab_id)
   order by w.updated_at
   limit greatest(p_limit, 0);
$function$;

create or replace function public.wallet_hold_cancelled(p_payment_id uuid)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.wallet_payments set hold_cancelled_at = now(), updated_at = now()
   where id = p_payment_id and hold_cancelled_at is null;
$function$;


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
  update public.wallet_payments
     set status = 'paid', paid_at = v_paid_at, updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
         cashback_cents = 0, stripe_error = null
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, v_paid_at);
  end if;
  -- MESITA-3827: card and credit parts, one entry; none on an unsigned guest tab.
  v_cashback := public.wallet_grant_cashback(v.id, v_paid_at);

  -- MESITA-3856: a held card captured for the waiter's signature finishes
  -- that signature in the same transaction (a no-op for any other payment).
  perform public.pay_tab_finish_signing(v.id);
  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'card_cents', v.card_cents, 'tip_cents', v.tip_cents,
    'cashback_cents', v_cashback, 'currency', v.currency, 'paid_at', v_paid_at, 'proof_token', v.proof_token);
end;
$function$;

revoke all on function public.wallet_card_held(uuid, timestamptz, interval) from public, anon, authenticated;
revoke all on function public.pay_tab_begin_capture(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.pay_tab_finish_signing(uuid) from public, anon, authenticated;
revoke all on function public.pay_tab_capture_failed(uuid, text) from public, anon, authenticated;
revoke all on function public.wallet_released_holds(uuid, integer) from public, anon, authenticated;
revoke all on function public.wallet_hold_cancelled(uuid) from public, anon, authenticated;
grant execute on function public.wallet_card_held(uuid, timestamptz, interval) to service_role;
grant execute on function public.pay_tab_begin_capture(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.pay_tab_finish_signing(uuid) to service_role;
grant execute on function public.pay_tab_capture_failed(uuid, text) to service_role;
grant execute on function public.wallet_released_holds(uuid, integer) to service_role;
grant execute on function public.wallet_hold_cancelled(uuid) to service_role;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'wallet_payments' and column_name = 'held_at')
     or not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'pay_tabs' and column_name = 'signing_at') then
    raise exception 'MESITA-3856 schema missing after apply';
  end if;
end $$;
