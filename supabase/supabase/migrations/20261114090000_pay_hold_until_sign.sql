-- MESITA-3843 (Pay W1a, Payments Flow Guest-Lead, Pato 2026-11-14):
-- nothing a guest pays is final until the waiter signs.
--
--   * A credits-only guest bill holds its credit (an open credit row, which
--     wallet_balance already counts as held) instead of spending it at the
--     tap; the signature spends it.
--   * An unsigned bill that expires, is cancelled (X) or rejected spends no
--     credit: its open rows expire and release what they held. Before, the
--     close spent the credit declared with a cash bill.
--   * The waiter can Reject (pay_tab_reject). pay_tabs.end_reason says why a
--     bill ended unpaid: cancelled, rejected or expired.
--   * Cash Payments Cashback is Off or 3%: MESITA-3837 moved the Edge
--     Function to 300 bps but left the CHECK at 200, so turning it on failed.
--   * Card parts are unchanged here (still charged at the tap); W1b
--     (MESITA-3856) holds them until the signature.
-- Statuses stay the ones the guest flow already uses: paying = waiting for
-- the waiter, paid + verified_at = signed (decision: no new status set).

alter table public.pay_tabs add column if not exists end_reason text;
alter table public.pay_tabs drop constraint if exists pay_tabs_end_reason_chk;
alter table public.pay_tabs add constraint pay_tabs_end_reason_chk
  check (end_reason is null or end_reason in ('cancelled', 'rejected', 'expired'));
comment on column public.pay_tabs.end_reason is
  'MESITA-3843: why a guest bill ended unpaid: cancelled (the guest''s X), rejected (the waiter''s Reject) or expired (ten minutes without a signature). Null otherwise.';

alter table public.place_payment_settings
  drop constraint if exists place_payment_settings_cash_cashback_bps_check,
  add constraint place_payment_settings_cash_cashback_bps_check
    check (cash_cashback_bps is null or cash_cashback_bps = 300);

create index if not exists pay_tabs_guest_expiry on public.pay_tabs (expires_at)
  where origin = 'guest' and status = 'paying';

create or replace function public.pay_tab_open_parts(
  p_tab_id uuid, p_consumer_id uuid, p_bill_version integer,
  p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer,
  p_request_id uuid, p_proof_token text, p_outside_cashback_bps integer, p_max_outside_per_day integer,
  p_now timestamptz default now(),
  p_stripe_account_id text default null, p_card_fee_cents integer default 0,
  p_card_cashback_bps integer default 0, p_card_proof_token text default null,
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
                                        currency, status, stripe_account_id, application_fee_cents, cashback_bps,
                                        request_id, ticket, proof_token, livemode, expires_at,
                                        tab_id, part, charge_amount_cents)
    values (p_consumer_id, v.place_id, p_credit_cents + p_card_bill_cents, p_credit_cents, p_card_bill_cents,
            p_card_tip_cents, v.currency, 'opening', p_stripe_account_id, greatest(coalesce(p_card_fee_cents, 0), 0),
            least(greatest(coalesce(p_card_cashback_bps, 0), 0), 10000), v_card_req, v.ticket, p_card_proof_token,
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
      v.currency, v.livemode, p_request_id, p_proof_token, v.ticket, p_outside_cashback_bps, v_expires);
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
    perform public.wallet_grant_cashback(v_pay, p_now);
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
  if v.expires_at <= p_now then
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
  if exists (select 1 from public.wallet_payments
              where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
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
   where tab_id = v.id and part = 'credit' and status in ('opening', 'open') and paid_at is null;

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
    if exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
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
  if exists (select 1 from public.wallet_payments where tab_id = v.id and part = 'card' and status in ('opening', 'open')) then
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

revoke all on function public.pay_tab_reject(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_reject(uuid, uuid, text, timestamptz) to service_role;
comment on function public.pay_tab_reject(uuid, uuid, text, timestamptz) is
  'MESITA-3843: the waiter''s Reject of an unsigned guest bill at their place: its open rows expire (nothing held stays held, no credit spent) and the bill is cancelled with end_reason rejected; idempotent; a bill with a part already paid answers paid_part. Service role only.';

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'pay_tabs' and column_name = 'end_reason')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'pay_tabs_guest_expiry') then
    raise exception 'MESITA-3843 schema missing after apply';
  end if;
end $$;
