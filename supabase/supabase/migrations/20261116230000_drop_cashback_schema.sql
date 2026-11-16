-- MESITA-4194: delete the dead cashback schema. MESITA-4191 locked every
-- cashback rate Off and removed it from every screen; this removes what was
-- left: the columns, their checks, two stamp triggers, wallet_grant_cashback,
-- pay_tab_card_cashback, and the cashback params and branches of the money
-- functions. Vouchers are the only offer.
--
-- The 6 test-mode 'cashback' entries guests already hold stay spendable: their
-- kind becomes 'extra' (the app already says "Extra credit"), so no balance
-- moves. A later refund no longer claws that old extra credit back.

-- 1. The legacy entries keep their money under a plain name.
alter table public.wallet_entries drop constraint wallet_entries_kind_chk;
alter table public.wallet_entries drop constraint wallet_entries_kind_shape_chk;
alter table public.wallet_entries disable trigger wallet_entries_append_only;
update public.wallet_entries set kind = 'extra' where kind = 'cashback';
alter table public.wallet_entries enable trigger wallet_entries_append_only;
alter table public.wallet_entries add constraint wallet_entries_kind_chk check (kind = any (array[
  'prepay', 'voucher', 'bonus', 'extra', 'spend', 'reversal', 'refund', 'gift_out', 'gift_in', 'gift_back']));
alter table public.wallet_entries add constraint wallet_entries_kind_shape_chk check (
case kind
    when 'prepay' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'voucher' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'bonus' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    -- 'extra': legacy credit from the retired cashback (MESITA-4194); nothing writes it.
    when 'extra' then ((amount_cents > 0) and ((payment_id is null) <> (purchase_id is null)) and (gift_id is null))
    when 'spend' then ((amount_cents < 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'reversal' then ((amount_cents < 0) and ((purchase_id is not null) or (payment_id is not null)) and (gift_id is null))
    when 'refund' then ((amount_cents > 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'gift_out' then ((amount_cents < 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_in' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_back' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    else false
end);

-- 2. The stamp triggers and the two grant functions.
drop trigger if exists wallet_payments_stamp_credit_cashback on public.wallet_payments;
drop trigger if exists wallet_purchases_stamp_cashback on public.wallet_purchases;
drop function if exists public.wallet_payments_stamp_credit_cashback();
drop function if exists public.wallet_purchases_stamp_cashback();
drop function if exists public.pay_tab_card_cashback(uuid, timestamp with time zone);
drop function if exists public.wallet_grant_cashback(uuid, timestamp with time zone);

-- 3. Six functions lose a cashback parameter: drop the old signature first.
drop function if exists public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamp with time zone, text, integer, integer, text, timestamp with time zone, interval, integer, text, boolean);
drop function if exists public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamp with time zone, text, integer, integer, text, timestamp with time zone);
drop function if exists public.wallet_open_outside_capped(uuid, uuid, integer, integer, text, boolean, uuid, text, text, integer, timestamp with time zone, integer);
drop function if exists public.wallet_open_outside(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, integer, timestamp with time zone);
drop function if exists public.wallet_hold_payment(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, text, integer, integer, timestamp with time zone);
drop function if exists public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text, boolean);

-- 4. Every money function, as live, without its cashback branch.

create or replace function public.wallet_pay_credit(
  p_consumer_id uuid, p_place_id uuid, p_amount_cents integer, p_currency text,
  p_livemode boolean, p_request_id uuid, p_proof_token text, p_ticket text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_prior public.wallet_payments;
  v_spendable integer;
  v_id uuid;
  v_paid_at timestamptz;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  if p_consumer_id is null or p_request_id is null then
    raise exception 'wallet_pay_credit: consumer and request_id are required';
  end if;
  -- The function is the last word on currency as on amounts: places store
  -- 'MXN', the ledger 'mxn'.
  p_currency := lower(p_currency);

  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into v_prior from public.wallet_payments
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    if v_prior.place_id = p_place_id and v_prior.amount_cents = p_amount_cents
       and v_prior.livemode = p_livemode and v_prior.paid_at is not null then
      return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v_prior.id,
        'status', v_prior.status, 'credit_cents', v_prior.credit_cents, 'currency', v_prior.currency,
        'paid_at', v_prior.paid_at, 'proof_token', v_prior.proof_token);
    end if;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_prior.id);
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
  v_spendable := coalesce(v_spendable, 0);
  if p_amount_cents > v_spendable then
    return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', v_spendable);
  end if;

  begin
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents,
                                        currency, status, stripe_account_id, paid_at, request_id, ticket,
                                        proof_token, livemode)
    values (p_consumer_id, p_place_id, p_amount_cents, p_amount_cents, 0, 0,
            p_currency, 'paid', null, now(), p_request_id, p_ticket,
            p_proof_token, p_livemode)
    returning id, paid_at into v_id, v_paid_at;
  exception when unique_violation then
    select id into v_id from public.wallet_payments
     where consumer_id = p_consumer_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_id);
  end;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
  values (p_consumer_id, p_place_id, 'spend', -p_amount_cents, p_currency, v_id, p_livemode, now());

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v_id, 'status', 'paid',
    'credit_cents', p_amount_cents, 'currency', p_currency, 'paid_at', v_paid_at, 'proof_token', p_proof_token);
end;
$function$;
revoke all on function public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text) from public, anon, authenticated;
grant execute on function public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text) to service_role;

create or replace function public.wallet_open_outside(
  p_consumer_id uuid, p_place_id uuid, p_credit_cents integer, p_outside_cents integer, p_tip_cents integer,
  p_currency text, p_livemode boolean, p_request_id uuid, p_proof_token text, p_ticket text,
  p_expires_at timestamptz)
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
  if p_outside_cents is null or p_outside_cents <= 0
     or p_credit_cents is null or p_credit_cents < 0 or p_tip_cents is null or p_tip_cents < 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  if p_consumer_id is null or p_request_id is null or p_expires_at is null then
    raise exception 'wallet_open_outside: consumer, request_id and expiry are required';
  end if;
  p_currency := lower(p_currency);

  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into v_prior from public.wallet_payments
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    if v_prior.place_id <> p_place_id or v_prior.outside_cents = 0 or v_prior.livemode <> p_livemode then
      return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_prior.id);
    end if;
    if v_prior.paid_at is not null then
      return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v_prior.id,
        'status', v_prior.status, 'credit_cents', v_prior.credit_cents, 'outside_cents', v_prior.outside_cents,
        'tip_cents', v_prior.tip_cents, 'currency', v_prior.currency, 'paid_at', v_prior.paid_at,
        'proof_token', v_prior.proof_token);
    end if;
    if v_prior.status in ('opening', 'open') then
      return jsonb_build_object('ok', true, 'outcome', 'in_progress', 'payment_id', v_prior.id,
        'expires_at', v_prior.expires_at);
    end if;
    if v_prior.status = 'expired' then
      return jsonb_build_object('ok', false, 'code', 'closed', 'payment_id', v_prior.id);
    end if;
    if v_prior.status = 'failed' then
      select b.spendable_cents into v_spendable
        from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
      if p_credit_cents > coalesce(v_spendable, 0) then
        return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
      end if;
      update public.wallet_payments
         set status = 'open', credit_cents = p_credit_cents, outside_cents = p_outside_cents,
             amount_cents = p_credit_cents + p_outside_cents,
             tip_cents = p_tip_cents, expires_at = p_expires_at,
             ticket = p_ticket, proof_token = coalesce(proof_token, p_proof_token), updated_at = now()
       where id = v_prior.id;
      return jsonb_build_object('ok', true, 'outcome', 'opened', 'payment_id', v_prior.id, 'expires_at', p_expires_at);
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
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, outside_cents,
                                        tip_cents, currency, status, request_id, ticket,
                                        proof_token, livemode, expires_at)
    values (p_consumer_id, p_place_id, p_credit_cents + p_outside_cents, p_credit_cents, 0, p_outside_cents,
            p_tip_cents, p_currency, 'open', p_request_id, p_ticket,
            p_proof_token, p_livemode, p_expires_at)
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from public.wallet_payments
     where consumer_id = p_consumer_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_id);
  end;

  return jsonb_build_object('ok', true, 'outcome', 'opened', 'payment_id', v_id, 'expires_at', p_expires_at);
end;
$function$;
revoke all on function public.wallet_open_outside(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_open_outside(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, timestamptz) to service_role;

create or replace function public.wallet_open_outside_capped(
  p_consumer_id uuid, p_place_id uuid, p_bill_cents integer, p_tip_cents integer,
  p_currency text, p_livemode boolean, p_request_id uuid, p_proof_token text, p_ticket text,
  p_expires_at timestamptz, p_max_per_day integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_spendable integer;
  v_credit integer;
  v_count integer;
  v_prior public.wallet_payments;
  v_res jsonb;
begin
  if p_bill_cents is null or p_bill_cents <= 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  p_currency := lower(p_currency);
  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into v_prior from public.wallet_payments where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    v_res := public.wallet_open_outside(p_consumer_id, p_place_id, v_prior.credit_cents, greatest(v_prior.outside_cents, 1),
      v_prior.tip_cents, p_currency, p_livemode, p_request_id, p_proof_token, p_ticket, p_expires_at);
    return v_res || jsonb_build_object('credit_cents', v_prior.credit_cents, 'outside_cents', v_prior.outside_cents,
      'tip_cents', v_prior.tip_cents);
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
  v_credit := least(greatest(coalesce(v_spendable, 0), 0), p_bill_cents);
  if p_bill_cents - v_credit <= 0 then
    return jsonb_build_object('ok', false, 'code', 'credit_covers',
      'spendable_cents', coalesce(v_spendable, 0), 'bill_cents', p_bill_cents);
  end if;

  select count(*) into v_count from public.wallet_payments
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and outside_cents > 0 and created_at > now() - interval '1 day'
     and status not in ('expired', 'failed');
  if v_count >= p_max_per_day then
    return jsonb_build_object('ok', false, 'code', 'outside_limit', 'max_per_day', p_max_per_day);
  end if;

  v_res := public.wallet_open_outside(p_consumer_id, p_place_id, v_credit, p_bill_cents - v_credit, p_tip_cents,
    p_currency, p_livemode, p_request_id, p_proof_token, p_ticket, p_expires_at);
  if (v_res ->> 'ok')::boolean then
    v_res := v_res || jsonb_build_object('credit_cents', v_credit, 'outside_cents', p_bill_cents - v_credit, 'tip_cents', p_tip_cents);
  end if;
  return v_res;
end;
$function$;
revoke all on function public.wallet_open_outside_capped(uuid, uuid, integer, integer, text, boolean, uuid, text, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.wallet_open_outside_capped(uuid, uuid, integer, integer, text, boolean, uuid, text, text, timestamptz, integer) to service_role;

create or replace function public.wallet_hold_payment(
  p_consumer_id uuid, p_place_id uuid, p_credit_cents integer, p_card_cents integer, p_tip_cents integer,
  p_currency text, p_livemode boolean, p_request_id uuid, p_proof_token text, p_ticket text,
  p_stripe_account_id text, p_application_fee_cents integer, p_expires_at timestamptz)
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
             expires_at = p_expires_at, ticket = p_ticket,
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
                                        currency, status, stripe_account_id, application_fee_cents,
                                        request_id, ticket, proof_token, livemode, expires_at)
    values (p_consumer_id, p_place_id, p_credit_cents + p_card_cents, p_credit_cents, p_card_cents, p_tip_cents,
            p_currency, 'opening', p_stripe_account_id, p_application_fee_cents,
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
revoke all on function public.wallet_hold_payment(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.wallet_hold_payment(uuid, uuid, integer, integer, integer, text, boolean, uuid, text, text, text, integer, timestamptz) to service_role;

create or replace function public.pay_tab_open_parts(
  p_tab_id uuid, p_consumer_id uuid, p_bill_version integer,
  p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer,
  p_request_id uuid, p_proof_token text, p_max_outside_per_day integer,
  p_now timestamptz default now(),
  p_stripe_account_id text default null, p_card_fee_cents integer default 0,
  p_card_proof_token text default null,
  p_card_expires_at timestamptz default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  v_count integer;
  v_res jsonb;
  v_pay uuid;
  v_card uuid;
  v_status text;
  v_spendable integer;
  v_card_req uuid;
  v_has_card boolean := coalesce(p_card_bill_cents, 0) > 0 or coalesce(p_card_tip_cents, 0) > 0;
  v_expires timestamptz := p_now + interval '30 minutes';
begin
  if p_tab_id is null or p_consumer_id is null or p_request_id is null then
    raise exception 'pay_tab_open_parts: tab, consumer and request_id are required';
  end if;
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.consumer_id is distinct from p_consumer_id then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(p_consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.pay_request_id = p_request_id and v.status in ('paying', 'paid') then
    select id into v_card from public.wallet_payments where tab_id = v.id and part = 'card'
     order by created_at desc limit 1;
    return jsonb_build_object('ok', true, 'outcome', 'replayed', 'tab_id', v.id, 'status', v.status,
      'card_payment_id', v_card);
  end if;
  if v.status = 'billed' and v.expires_at <= p_now then
    update public.pay_tabs set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if v.status <> 'billed' then
    return jsonb_build_object('ok', false, 'code', case when v.status = 'waiting_bill' then 'not_billed'
      when v.status in ('paying', 'paid') then 'paying' else v.status end, 'status', v.status);
  end if;
  if p_bill_version is distinct from v.bill_version then
    return jsonb_build_object('ok', false, 'code', 'stale', 'bill_version', v.bill_version);
  end if;
  if coalesce(p_credit_cents, -1) < 0 or coalesce(p_cash_bill_cents, -1) < 0 or coalesce(p_cash_tip_cents, -1) < 0
     or coalesce(p_card_bill_cents, -1) < 0 or coalesce(p_card_tip_cents, -1) < 0
     or p_credit_cents + p_cash_bill_cents + p_card_bill_cents <> v.bill_cents
     or p_cash_tip_cents + p_card_tip_cents > 10000000 then
    return jsonb_build_object('ok', false, 'code', 'parts', 'bill_cents', v.bill_cents);
  end if;
  if v_has_card and (p_stripe_account_id is null or p_card_expires_at is null) then
    return jsonb_build_object('ok', false, 'code', 'card_unavailable');
  end if;
  if v_has_card and p_credit_cents + p_card_bill_cents = 0 then
    -- A card row carries the credit and the card bill part; a tip by card
    -- alone, with the whole bill in cash, has nothing to ride on.
    return jsonb_build_object('ok', false, 'code', 'card_tip_alone', 'bill_cents', v.bill_cents);
  end if;

  if p_cash_bill_cents > 0 then
    -- The guest's daily limit of outside bills here, counted under the lock.
    select count(*) into v_count from public.wallet_payments
     where consumer_id = p_consumer_id and place_id = v.place_id and livemode = v.livemode
       and outside_cents > 0 and created_at > p_now - interval '1 day'
       and status not in ('expired', 'failed');
    if v_count >= p_max_outside_per_day then
      return jsonb_build_object('ok', false, 'code', 'outside_limit', 'max_per_day', p_max_outside_per_day);
    end if;
  end if;

  if v_has_card then
    -- ONE card row: the credit (held: opening rows count in wallet_balance),
    -- the card bill part and the card tip. Its own request id, derived from
    -- the tap's, so the outside row keeps the tap's.
    select b.spendable_cents into v_spendable
      from public.wallet_balance(p_consumer_id, v.place_id, v.currency, v.livemode) b;
    if p_credit_cents > coalesce(v_spendable, 0) then
      return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
    end if;
    v_card_req := md5(p_request_id::text || ':card')::uuid;
    if exists (select 1 from public.wallet_payments where consumer_id = p_consumer_id and request_id = v_card_req) then
      -- The same tap after its card part failed: a new tap starts over.
      return jsonb_build_object('ok', false, 'code', 'closed');
    end if;
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents,
                                        currency, status, stripe_account_id, application_fee_cents,
                                        request_id, ticket, proof_token, livemode, expires_at,
                                        tab_id, part, charge_amount_cents)
    values (p_consumer_id, v.place_id, p_credit_cents + p_card_bill_cents, p_credit_cents, p_card_bill_cents,
            p_card_tip_cents, v.currency, 'opening', p_stripe_account_id, greatest(coalesce(p_card_fee_cents, 0), 0),
            v_card_req, v.ticket, p_card_proof_token,
            v.livemode, p_card_expires_at, v.id, 'card', v.bill_cents)
    returning id into v_card;
    v_pay := v_card;
    v_status := 'paying';
  end if;

  if p_cash_bill_cents > 0 then
    -- The cash bill part (and any cash tip) is one outside row; with a card
    -- part the credit already rides on the card row.
    v_res := public.wallet_open_outside(p_consumer_id, v.place_id,
      case when v_has_card then 0 else p_credit_cents end, p_cash_bill_cents, p_cash_tip_cents,
      v.currency, v.livemode, p_request_id, p_proof_token, v.ticket, v_expires);
    if not coalesce((v_res ->> 'ok')::boolean, false) or v_res ->> 'outcome' <> 'opened' then
      -- Undo the card row of this call (no Stripe object exists yet).
      if v_card is not null then
        delete from public.wallet_payments where id = v_card and status = 'opening' and stripe_payment_intent_id is null;
      end if;
      return coalesce(v_res, '{}'::jsonb) || jsonb_build_object('ok', false);
    end if;
    update public.wallet_payments set tab_id = v.id, part = 'outside', charge_amount_cents = v.bill_cents
     where id = (v_res ->> 'payment_id')::uuid;
    v_pay := coalesce(v_card, (v_res ->> 'payment_id')::uuid);
    v_status := 'paying';
  elsif not v_has_card and v.origin = 'guest' then
    -- MESITA-3843: a guest's credits-only bill holds the credit (an open row
    -- counts as held in wallet_balance) and spends it at the waiter's
    -- signature; X, Reject and expiry release it.
    select b.spendable_cents into v_spendable
      from public.wallet_balance(p_consumer_id, v.place_id, v.currency, v.livemode) b;
    if p_credit_cents > coalesce(v_spendable, 0) then
      return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
    end if;
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents,
                                        currency, status, request_id, ticket, proof_token, livemode, expires_at,
                                        tab_id, part, charge_amount_cents)
    values (p_consumer_id, v.place_id, p_credit_cents, p_credit_cents, 0, 0,
            v.currency, 'open', p_request_id, v.ticket, p_proof_token, v.livemode, v_expires,
            v.id, 'credit', v.bill_cents)
    returning id into v_pay;
    v_status := 'paying';
  elsif not v_has_card then
    -- Credits pay the whole bill now.
    v_res := public.wallet_pay_credit(p_consumer_id, v.place_id, p_credit_cents, v.currency, v.livemode,
      p_request_id, p_proof_token, v.ticket);
    if not coalesce((v_res ->> 'ok')::boolean, false) or v_res ->> 'outcome' <> 'paid' then
      return coalesce(v_res, '{}'::jsonb) || jsonb_build_object('ok', false);
    end if;
    v_pay := (v_res ->> 'payment_id')::uuid;
    update public.wallet_payments set tab_id = v.id, part = 'credit', charge_amount_cents = v.bill_cents
     where id = v_pay;
    -- A cash tip still waits for the waiter's Received.
    v_status := case when p_cash_tip_cents > 0 then 'paying' else 'paid' end;
  end if;

  update public.pay_tabs
     set status = v_status, pay_request_id = p_request_id, paying_at = p_now,
         paid_at = case when v_status = 'paid' then p_now end,
         credit_cents = p_credit_cents, cash_bill_cents = p_cash_bill_cents, cash_tip_cents = p_cash_tip_cents,
         card_bill_cents = p_card_bill_cents, card_tip_cents = p_card_tip_cents,
         expires_at = greatest(v.expires_at, v_expires), updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'tab_id', v.id, 'status', v_status, 'payment_id', v_pay,
    'card_payment_id', v_card,
    'credit_cents', p_credit_cents, 'cash_bill_cents', p_cash_bill_cents, 'cash_tip_cents', p_cash_tip_cents,
    'card_bill_cents', p_card_bill_cents, 'card_tip_cents', p_card_tip_cents);
end;
$function$;
revoke all on function public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_open_parts(uuid, uuid, integer, integer, integer, integer, integer, integer, uuid, text, integer, timestamptz, text, integer, text, timestamptz) to service_role;

create function public.pay_tab_guest_pay(
  p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_token_hash text,
  p_bill_cents integer,
  p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer,
  p_request_id uuid, p_proof_token text,
  p_now timestamptz default now(),
  p_stripe_account_id text default null, p_card_fee_cents integer default 0,
  p_card_proof_token text default null,
  p_card_expires_at timestamptz default null,
  p_window interval default interval '3 hours', p_max_open integer default 3,
  p_ticket text default null, p_repeat_ok boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  o public.pay_tabs;
  d public.pay_tabs;
  v_res jsonb;
  v_expires timestamptz := p_now + p_window;
  v_card uuid;
  v_ticket text := nullif(btrim(p_ticket), '');
begin
  if p_consumer_id is null or p_place_id is null or p_token_hash is null or p_request_id is null then
    raise exception 'pay_tab_guest_pay: consumer, place, token and request_id are required';
  end if;
  if p_bill_cents is null or p_bill_cents <= 0 or p_bill_cents > 10000000 then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'amount_required');
  end if;
  perform public.wallet_lock(p_consumer_id, p_place_id);
  -- MESITA-3772: the one-open rule spans places, so two taps at two places
  -- serialize on the guest too (only this function takes this lock).
  perform pg_advisory_xact_lock(hashtextextended('pay_tab_guest_open:' || p_consumer_id::text, 0));

  -- The same tap again (a lost answer): its tab, with this call's QR. It
  -- keeps the ticket it was made with and never warns about it.
  select * into v from public.pay_tabs
   where consumer_id = p_consumer_id and place_id = p_place_id and pay_request_id = p_request_id and origin = 'guest'
   for update;
  if found then
    if v.verified_at is null and v.status in ('paying', 'paid') and v.expires_at > p_now then
      update public.pay_tabs set token_hash = p_token_hash, updated_at = now() where id = v.id;
    end if;
    select id into v_card from public.wallet_payments where tab_id = v.id and part = 'card'
     order by created_at desc limit 1;
    return jsonb_build_object('ok', true, 'outcome', 'replayed', 'tab_id', v.id, 'status', v.status,
      'card_payment_id', v_card, 'expires_at', v.expires_at);
  end if;

  -- MESITA-3776: the ticket as typed, 1 to 16 letters, digits, spaces,
  -- dashes or slashes.
  if v_ticket is not null and v_ticket !~ '^[A-Za-z0-9 /-]{1,16}$' then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'ticket_invalid');
  end if;

  -- MESITA-3776: a ticket that already has a payment here. The guest's own
  -- first (never overridable), then another guest's (a share, when the
  -- guest says so). Waiter-billed tabs keep free text and are not compared.
  if v_ticket is not null then
    select * into d from public.pay_tabs
     where place_id = p_place_id and livemode = p_livemode and origin = 'guest'
       and ticket is not null
       and public.pay_ticket_norm(ticket) = public.pay_ticket_norm(v_ticket)
       and status in ('paying', 'paid')
       and (status = 'paid' or expires_at > p_now)
       and created_at > p_now - interval '12 hours'
     order by (consumer_id = p_consumer_id) desc, created_at desc
     limit 1;
    if found then
      if d.consumer_id = p_consumer_id then
        raise exception 'guest_refused:%', jsonb_build_object('code', 'ticket_paid_by_you', 'paid_tab_id', d.id);
      elsif not coalesce(p_repeat_ok, false) then
        raise exception 'guest_refused:%', jsonb_build_object('code', 'ticket_paid');
      end if;
    end if;
  end if;

  -- One open guest payment per guest per money mode, at any place. The
  -- rule is one; p_max_open is kept for old callers and ignored.
  select * into o from public.pay_tabs
   where consumer_id = p_consumer_id and livemode = p_livemode
     and origin = 'guest' and verified_at is null
     and status in ('paying', 'paid') and expires_at > p_now
   order by created_at desc
   limit 1;
  if found then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'too_many_open', 'max_open', 1,
      'open_tab_id', o.id, 'open_place_id', o.place_id);
  end if;

  -- The guest's own waiter tab still waiting for a bill here is stale now.
  update public.pay_tabs set status = 'cancelled', updated_at = now()
   where consumer_id = p_consumer_id and place_id = p_place_id and livemode = p_livemode
     and origin = 'waiter' and status = 'waiting_bill' and parent_tab_id is null;

  insert into public.pay_tabs (place_id, consumer_id, token_hash, status, currency, livemode, bill_cents,
                               tip_cents, bill_version, billed_at, pay_request_id, expires_at, origin, ticket)
  values (p_place_id, p_consumer_id, p_token_hash, 'billed', lower(p_currency), p_livemode, p_bill_cents,
          coalesce(p_cash_tip_cents, 0) + coalesce(p_card_tip_cents, 0), 1, p_now, p_request_id, v_expires, 'guest',
          v_ticket)
  returning * into v;

  -- The waiter's two-a-day outside limit does not count guest tabs: a
  -- large limit here.
  v_res := public.pay_tab_open_parts(v.id, p_consumer_id, 1,
    p_credit_cents, p_cash_bill_cents, p_cash_tip_cents, p_card_bill_cents, p_card_tip_cents,
    p_request_id, p_proof_token, 1000000, p_now,
    p_stripe_account_id, p_card_fee_cents, p_card_proof_token, p_card_expires_at);
  if not coalesce((v_res ->> 'ok')::boolean, false) then
    raise exception 'guest_refused:%', v_res;
  end if;

  -- The Verify window is fixed: the tab and its cash row close together.
  update public.pay_tabs set expires_at = v_expires, updated_at = now() where id = v.id;
  update public.wallet_payments set expires_at = v_expires, updated_at = now()
   where tab_id = v.id and part = 'outside' and status in ('opening', 'open');

  select * into v from public.pay_tabs where id = v.id;
  return v_res || jsonb_build_object('tab_id', v.id, 'status', v.status, 'expires_at', v.expires_at, 'origin', 'guest');
end;
$function$;
revoke all on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, timestamptz, text, integer, text, timestamptz, interval, integer, text, boolean) from public, anon, authenticated;
grant execute on function public.pay_tab_guest_pay(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, timestamptz, text, integer, text, timestamptz, interval, integer, text, boolean) to service_role;

create or replace function public.wallet_confirm_outside(p_payment_id uuid, p_now timestamp with time zone default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.outside_cents = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_outside');
  end if;
  if v.paid_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v.id, 'status', v.status,
      'credit_cents', v.credit_cents, 'outside_cents', v.outside_cents, 'tip_cents', v.tip_cents,
      'currency', v.currency, 'paid_at', v.paid_at, 'proof_token', v.proof_token);
  end if;
  if v.status not in ('opening', 'open') then
    if v.status = 'expired' and v.stripe_error = 'cancelled' then
      return jsonb_build_object('ok', false, 'code', 'closed', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
    end if;
    return jsonb_build_object('ok', false, 'code', 'expired', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
  end if;
  if v.expires_at is not null and v.expires_at <= p_now then
    update public.wallet_payments set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
  end if;

  perform public.wallet_lock(v.consumer_id, v.place_id);
  update public.wallet_payments
     set status = 'paid', paid_at = p_now, confirmed_by = 'waiter', updated_at = now()
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, p_now);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'outside_cents', v.outside_cents, 'tip_cents', v.tip_cents,
    'currency', v.currency, 'paid_at', p_now, 'proof_token', v.proof_token);
end;
$function$;

create or replace function public.wallet_settle_payment(p_payment_id uuid, p_payment_intent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_paid_at timestamptz := now();
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.paid_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v.id, 'status', v.status,
      'credit_cents', v.credit_cents, 'card_cents', v.card_cents, 'tip_cents', v.tip_cents,
      'currency', v.currency, 'paid_at', v.paid_at, 'proof_token', v.proof_token);
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
         stripe_error = null
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, v_paid_at);
  end if;
  -- MESITA-3856: a held card captured for the waiter's signature finishes
  -- that signature in the same transaction (a no-op for any other payment).
  perform public.pay_tab_finish_signing(v.id);
  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'card_cents', v.card_cents, 'tip_cents', v.tip_cents,
    'currency', v.currency, 'paid_at', v_paid_at, 'proof_token', v.proof_token);
end;
$function$;

create or replace function public.pay_tab_cash(
  p_token_hash text, p_staff_key_hash text, p_received_cents integer, p_now timestamptz default now())
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
begin
  select * into v from public.pay_tabs where token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = v.id for update;
  if v.staff_key_hash is null or p_staff_key_hash is null or v.staff_key_hash <> p_staff_key_hash then
    return jsonb_build_object('ok', false, 'code', 'staff_key');
  end if;
  if v.status = 'paid' then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'tab_id', v.id,
      'cash_received_cents', v.cash_received_cents);
  end if;
  if v.status <> 'paying' or (v.cash_bill_cents = 0 and v.cash_tip_cents = 0) then
    return jsonb_build_object('ok', false, 'code', 'no_cash', 'status', v.status);
  end if;
  if exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
    return jsonb_build_object('ok', false, 'code', 'card_pending');
  end if;

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
      if v_res ->> 'code' in ('expired', 'closed') then
        update public.pay_tabs set status = 'expired', updated_at = now() where id = v.id;
      end if;
      return v_res;
    end if;
  end if;

  update public.pay_tabs
     set status = 'paid', paid_at = p_now, cash_received_cents = v_received, cash_tip_cents = v_tip, updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'paid', 'tab_id', v.id, 'cash_received_cents', v_received,
    'cash_tip_cents', v_tip);
end;
$function$;

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
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now);
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
    end if;
    update public.pay_tabs
       set status = 'paid', paid_at = coalesce(paid_at, p_now), cash_received_cents = v_received, cash_tip_cents = v_tip,
           verified_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    raise log '[pay-tab] %', jsonb_build_object('tab_id', v.id, 'place_id', v.place_id, 'from', 'paying', 'to', 'paid', 'reason', 'signed');
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now,
      'cash_received_cents', v_received, 'cash_tip_cents', v_tip);
  end if;

  if v.status = 'paid' then
    update public.pay_tabs set verified_at = p_now, verified_key_hash = p_staff_key_hash, updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'verified', 'tab_id', v.id, 'verified_at', p_now);
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
    -- nothing moved, else ends it now as the cron would.
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

create or replace function public.place_money_summary(
  p_place_id uuid, p_from timestamptz, p_to timestamptz, p_livemode boolean,
  p_before timestamptz default null, p_before_id uuid default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_received bigint;
  v_fee bigint;
  v_tips bigint;
  v_available bigint;
  v_pending bigint;
  v_share jsonb;
  v_rows jsonb;
  v_next jsonb;
begin
  with pu as (
    select amount_cents - refunded_cents as received, application_fee_cents - fee_refunded_cents as fee, 0 as tips
      from public.wallet_purchases
     where place_id = p_place_id and livemode = p_livemode and paid_at is not null
       and created_at >= p_from and created_at < p_to
  ), py as (
    select card_cents - (refunded_cents - tip_refunded_cents)
             + case when outside_cents > 0 and status not in ('refunded', 'needs_review') then outside_cents else 0 end
             as received,
           application_fee_cents - fee_refunded_cents as fee,
           case when outside_cents > 0 or part = 'outside' then 0 else tip_cents - tip_refunded_cents end as tips
      from public.wallet_payments
     where place_id = p_place_id and livemode = p_livemode and paid_at is not null
       and created_at >= p_from and created_at < p_to
  ), al as (select * from pu union all select * from py)
  select coalesce(sum(received), 0), coalesce(sum(fee), 0), coalesce(sum(tips), 0)
    into v_received, v_fee, v_tips
    from al;

  select coalesce(sum(amount_cents) filter (where available_at <= now()), 0),
         coalesce(sum(amount_cents) filter (where available_at > now()), 0)
    into v_available, v_pending
    from public.wallet_entries
   where place_id = p_place_id and livemode = p_livemode;

  -- One bill per charge or tab: a tab's card row and outside row are one bill.
  with bills as (
    select coalesce(tab_id, id) as bill, bool_or(confirmed_by = 'waiter') as received
      from public.wallet_payments
     where place_id = p_place_id and livemode = p_livemode and paid_at is not null
       and (charge_amount_cents is not null or tab_id is not null)
       and created_at >= p_from and created_at < p_to
     group by coalesce(tab_id, id)
  )
  select jsonb_build_object('received', count(*) filter (where received), 'total', count(*))
    into v_share
    from bills;

  with r as (
    select 'voucher'::text as kind, p.id, p.created_at, p.paid_at, p.status, p.voucher, null::text as ticket,
           p.amount_cents as amount_cents, 0 as credit_cents, p.amount_cents as card_cents, 0 as tip_cents,
           p.refunded_cents, p.consumer_id,
           null::text as confirmed_by, 0 as outside_cents, null::integer as charge_amount_cents,
           null::uuid as tab_id, null::text as part
      from public.wallet_purchases p
     where p.place_id = p_place_id and p.livemode = p_livemode and p.paid_at is not null
       and p.created_at >= p_from and p.created_at < p_to
    union all
    select 'payment'::text, y.id, y.created_at, y.paid_at, y.status, null::text, y.ticket,
           y.amount_cents + y.tip_cents, y.credit_cents, y.card_cents, y.tip_cents,
           y.refunded_cents + y.credit_refunded_cents, y.consumer_id,
           y.confirmed_by, y.outside_cents, y.charge_amount_cents,
           y.tab_id, y.part
      from public.wallet_payments y
     where y.place_id = p_place_id and y.livemode = p_livemode and y.paid_at is not null
       and y.created_at >= p_from and y.created_at < p_to
  ), page as (
    select r.* from r
     where p_before is null
        or r.created_at < p_before
        or (p_before_id is not null and r.created_at = p_before and r.id < p_before_id)
     order by r.created_at desc, r.id desc
     limit 51
  ), named as (
    select page.*,
           row_number() over (order by page.created_at desc, page.id desc) as n,
           coalesce(nullif(btrim(c.full_name), ''), nullif(btrim(c.first_name), '')) as guest_name,
           u.email as guest_email
      from page
      left join public.consumers c on c.id = page.consumer_id
      left join auth.users u on u.id = page.consumer_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', kind, 'id', id, 'created_at', created_at, 'paid_at', paid_at, 'status', status,
           'voucher', voucher, 'ticket', ticket, 'amount_cents', amount_cents, 'credit_cents', credit_cents,
           'card_cents', card_cents, 'tip_cents', tip_cents, 'refunded_cents', refunded_cents,
           'confirmed_by', confirmed_by, 'outside_cents', outside_cents, 'charge_amount_cents', charge_amount_cents,
           'tab_id', tab_id, 'part', part,
           'guest_name', guest_name, 'guest_email', guest_email)
           order by created_at desc, id desc) filter (where n <= 50), '[]'::jsonb),
         (select jsonb_build_object('created_at', x.created_at, 'id', x.id)
            from named x where x.n = 50 and exists (select 1 from named y where y.n = 51))
    into v_rows, v_next
    from named;

  return jsonb_build_object(
    'received_cents', v_received, 'fee_cents', v_fee, 'tips_cents', v_tips,
    'available_cents', v_available, 'pending_cents', v_pending,
    'received_share', v_share,
    'rows', v_rows, 'next', v_next);
end;
$function$;

create or replace function public.place_payment_settings_stripe_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  turning_on boolean;
begin
  if tg_op = 'INSERT' then
    turning_on := new.pay_cards or new.prepayments
               or new.voucher_200 or new.voucher_1000 or new.voucher_5000
               or new.voucher_welcome or new.voucher_story or new.voucher_vip;
  else
    turning_on := (new.pay_cards and not old.pay_cards)
               or (new.prepayments and not old.prepayments)
               or (new.voucher_200 and not old.voucher_200)
               or (new.voucher_1000 and not old.voucher_1000)
               or (new.voucher_5000 and not old.voucher_5000)
               or (new.voucher_welcome and not old.voucher_welcome)
               or (new.voucher_story and not old.voucher_story)
               or (new.voucher_vip and not old.voucher_vip);
  end if;
  if turning_on and not exists (
    select 1 from public.place_payment_accounts a
     where a.place_id = new.place_id and a.charges_enabled
  ) then
    raise exception 'needs_stripe: Mesita Payments and Mesita Prepayments need a Stripe account that takes cards'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

create or replace function public.wallet_activate_story(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_at timestamptz := now();
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  select * into v from public.wallet_purchases
   where story_token = p_token and voucher = 'voucher_story'
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if v.story_activated_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_active', 'activated_at', v.story_activated_at, 'purchase_id', v.id);
  end if;
  if v.status <> 'paid' then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, 'voucher', v.amount_cents, v.currency, v.id, v.livemode, v_at);
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;
  update public.wallet_purchases
     set story_activated_at = v_at, updated_at = now()
   where id = v.id;
  v.story_activated_at := v_at;

  return jsonb_build_object('ok', true, 'outcome', 'activated', 'activated_at', v.story_activated_at, 'purchase_id', v.id);
end;
$function$;

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

  -- A Story waits for staff (MESITA-3507): paid, its activation key minted,
  -- no credit until wallet_activate_story writes it.
  if v.voucher = 'voucher_story' then
    update public.wallet_purchases
       set story_token = coalesce(story_token, replace(gen_random_uuid()::text, '-', ''))
     where id = p_purchase_id;
    return jsonb_build_object('ok', true, 'outcome', 'credited', 'held', true);
  end if;

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

create or replace function public.wallet_refund_credit(p_attempt_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.wallet_refund_attempts;
  v public.wallet_payments;
  v_new integer;
  v_status text;
begin
  select * into a from public.wallet_refund_attempts where id = p_attempt_id for update;
  if not found or a.payment_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if a.status = 'done' then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied');
  end if;
  if a.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'not_pending');
  end if;
  select * into v from public.wallet_payments where id = a.payment_id for update;
  if v.paid_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  if a.amount_cents > v.credit_cents - v.credit_refunded_cents then
    return jsonb_build_object('ok', false, 'code', 'above_refundable',
      'refundable_cents', v.credit_cents - v.credit_refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
  values (v.consumer_id, v.place_id, 'refund', a.amount_cents, v.currency, v.id, v.livemode, now());

  v_new := v.credit_refunded_cents + a.amount_cents;

  v_status := case
    when v.uncovered_cents > 0 then 'needs_review'
    when v_new >= v.credit_cents and v.refunded_cents >= v.card_cents + v.tip_cents then 'refunded'
    else 'partly_refunded'
  end;
  update public.wallet_payments
     set credit_refunded_cents = v_new, status = v_status, updated_at = now()
   where id = v.id;
  update public.wallet_refund_attempts set status = 'done', updated_at = now() where id = a.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'credit_refunded_cents', v_new, 'status', v_status);
end;
$function$;

create or replace function public.wallet_refund_outside(p_payment_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_credit integer;
  v_uncovered integer;
  v_status text;
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.outside_cents = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_outside');
  end if;
  if v.paid_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  if v.status in ('refunded', 'needs_review') then
    return jsonb_build_object('ok', true, 'outcome', 'already_refunded', 'status', v.status,
      'credit_refunded_cents', 0);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  v_credit := v.credit_cents - v.credit_refunded_cents;
  if v_credit > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'refund', v_credit, v.currency, v.id, v.livemode, now());
  end if;

  v_uncovered := v.uncovered_cents;
  v_status := case when v_uncovered > 0 then 'needs_review' else 'refunded' end;

  update public.wallet_payments
     set credit_refunded_cents = v.credit_cents, uncovered_cents = v_uncovered, status = v_status, updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'status', v_status,
    'credit_refunded_cents', v_credit, 'uncovered_cents', v_uncovered);
end;
$function$;

create or replace function public.wallet_refund_payment(p_payment_id uuid, p_amount_refunded integer, p_reason text default 'refund')
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
  v_to_reverse integer := 0;
  v_reversed integer := 0;
  v_status text;
  v_fee_refunded integer;
begin
  if p_amount_refunded is null or p_amount_refunded < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  if p_reason is null or p_reason not in ('refund', 'dispute_lost') then
    return jsonb_build_object('ok', false, 'code', 'bad_reason');
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

  -- MESITA-3461: the refunded share of the card part owes no fee; a full
  -- card refund owes none. Never shrinks (a replay cannot bill it again).
  v_fee_refunded := case
    when v.card_cents <= 0 or v_card_refunded >= v.card_cents then v.application_fee_cents
    else (v.application_fee_cents * v_card_refunded) / v.card_cents end;
  v_fee_refunded := least(greatest(v.fee_refunded_cents, v_fee_refunded), v.application_fee_cents);

  v_status := case
    when v.uncovered_cents + (v_to_reverse - v_reversed) > 0 then 'needs_review'
    when v_new_refunded >= v_ceiling then 'refunded'
    else 'partly_refunded'
  end;

  update public.wallet_payments
     set refunded_cents = v_new_refunded,
         tip_refunded_cents = v_tip_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         fee_refunded_cents = v_fee_refunded,
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'card_refunded_cents', v_card_refunded, 'tip_refunded_cents', v_tip_refunded,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;

create or replace function public.wallet_refund_purchase(p_purchase_id uuid, p_amount_refunded integer, p_reason text default 'refund')
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
  v_fee_refunded integer;
begin
  if p_amount_refunded is null or p_amount_refunded < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  if p_reason is null or p_reason not in ('refund', 'dispute_lost') then
    return jsonb_build_object('ok', false, 'code', 'bad_reason');
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

  -- MESITA-3461: the refunded share owes no fee; a full refund owes none.
  v_fee_refunded := case
    when v.amount_cents <= 0 or v_new_refunded >= v.amount_cents then v.application_fee_cents
    else (v.application_fee_cents * v_new_refunded) / v.amount_cents end;
  v_fee_refunded := least(greatest(v.fee_refunded_cents, v_fee_refunded), v.application_fee_cents);

  -- A Story refunded before staff activated it was never credited
  -- (MESITA-3507): nothing to reverse, nothing uncovered. It can no longer be
  -- activated (wallet_activate_story needs status paid).
  if v.voucher = 'voucher_story' and v.story_activated_at is null then
    v_status := case when v_new_refunded >= v.amount_cents then 'refunded' else 'partly_refunded' end;
    update public.wallet_purchases
       set refunded_cents = v_new_refunded, fee_refunded_cents = v_fee_refunded, status = v_status, updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
      'reversed_cents', 0, 'uncovered_cents', 0, 'status', v_status);
  end if;

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
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at, reason)
    values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, now(), p_reason);
  end if;

  v_status := case
    when v.uncovered_cents + (v_to_reverse - v_reversed) > 0 then 'needs_review'
    when v_new_refunded >= v.amount_cents then 'refunded'
    else 'partly_refunded'
  end;
  update public.wallet_purchases
     set refunded_cents = v_new_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         fee_refunded_cents = v_fee_refunded,
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;

-- The Stripe guard's trigger watched two of the columns: re-create it without them.
drop trigger place_payment_settings_stripe_guard on public.place_payment_settings;
create trigger place_payment_settings_stripe_guard
  before insert or update of pay_cards, prepayments, voucher_200, voucher_1000, voucher_5000,
    voucher_welcome, voucher_story, voucher_vip
  on public.place_payment_settings
  for each row execute function public.place_payment_settings_stripe_guard();

-- 5. The columns (their checks, including place_payment_settings_cash_le_card, go with them).
alter table public.place_payment_settings
  drop column card_cashback_bps, drop column cash_cashback_bps,
  drop column credit_cashback_bps, drop column prepay_cashback_bps, drop column cashback;
alter table public.wallet_payments
  drop column cashback_bps, drop column cashback_cents,
  drop column credit_cashback_bps, drop column credit_cashback_cents, drop column outside_cashback_bps;
alter table public.wallet_purchases
  drop column cashback_bps, drop column cashback_cents;
