-- MESITA-4770 — VISIT OFFERS: DISCOUNT OR CASHBACK (Pato, 2026-11-23: "SAME
-- TIERS. NOT DOUBLE CONFIGURATION NEEDED. YOU JUST SET THE TIER. AND THEN THE
-- MECHANISM FOR ALL YOUR VISIT TIERS IN THE BUSINESS CONSOLE.").
--
-- The place's Welcome / Returning rates now pay out one of two ways:
--   cashback  credit at the place for the next visit (as today; needs the
--             Credits Agreement, Loyalty Cards On)
--   discount  off this bill, at the table (no agreement needed)
--
-- 1. visit_mechanism on place_cashback_settings and cashback_defaults
--    (default 'cashback'); place_visit_mechanism(place) reads it with the
--    usual fallback (the place's row, else the defaults, else cashback).
-- 2. guest_pay_attempts and pay_tabs record what applied to that bill:
--    visit_mechanism, discount_bps, discount_cents. A later switch by the
--    owner never changes a bill already begun.
-- 3. pay_guest_begin (same signature) works the discount out itself: the
--    tier (MESITA-4766's three lines: Welcome Everyone = no earlier paid bill
--    here, else Returning VIP for a VIP, else Returning Regular) on the printed
--    bill, tip excluded, rounded down. The parts (credit + cash) must add up
--    to bill - discount; a phone that sent other numbers gets
--    discount_changed with the right ones.
-- 4. pay_guest_insert_closed copies the three fields to the paid bill.
-- 5. pay_tab_grant_cashback earns nothing on a bill recorded as 'discount'.
--    Waiter-started bills (pay_tab_open) record nothing and keep cashback.

-- ── 1. The owner's choice ───────────────────────────────────────────────────
alter table public.place_cashback_settings
  add column if not exists visit_mechanism text not null default 'cashback'
    check (visit_mechanism in ('cashback', 'discount'));
alter table public.cashback_defaults
  add column if not exists visit_mechanism text not null default 'cashback'
    check (visit_mechanism in ('cashback', 'discount'));

create or replace function public.place_visit_mechanism(p_place_id uuid)
 returns text
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(s.visit_mechanism, d.visit_mechanism, 'cashback')
    from (select 1) one
    left join public.cashback_defaults d on d.id
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$;
revoke all on function public.place_visit_mechanism(uuid) from public, anon, authenticated;
grant execute on function public.place_visit_mechanism(uuid) to service_role;
comment on function public.place_visit_mechanism(uuid) is
  'MESITA-4770: how the place''s Welcome / Returning rates pay out: cashback (credit for the next visit) or discount (off this bill). Its row, else cashback_defaults, else cashback. Internal.';

-- ── 2. What applied to a bill ───────────────────────────────────────────────
alter table public.guest_pay_attempts
  add column if not exists visit_mechanism text check (visit_mechanism is null or visit_mechanism in ('cashback', 'discount')),
  add column if not exists discount_bps integer not null default 0 check (discount_bps >= 0 and discount_bps <= 10000),
  add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0);
alter table public.pay_tabs
  add column if not exists visit_mechanism text check (visit_mechanism is null or visit_mechanism in ('cashback', 'discount')),
  add column if not exists discount_bps integer not null default 0 check (discount_bps >= 0 and discount_bps <= 10000),
  add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0);
comment on column public.pay_tabs.discount_cents is
  'MESITA-4770: the visit discount taken off bill_cents (the printed bill). The parts (credit + cash + card bill) add up to bill_cents - discount_cents.';

-- ── 3. Begin ────────────────────────────────────────────────────────────────
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
  v_mech text;
  v_line text;
  r record;
  v_disc_bps integer := 0;
  v_disc integer := 0;
  v_due integer;
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

  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into a from public.guest_pay_attempts
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    return jsonb_build_object(
      'ok', true, 'outcome', 'replayed', 'attempt_id', a.id, 'tab_id', a.tab_id,
      'status', a.status, 'phase', public.guest_pay_phase(a), 'payment_id', a.payment_id,
      'card_payment_id', case when a.tender = 'card' then a.payment_id end,
      'expires_at', a.expires_at, 'cash_cents', a.cash_cents, 'guest_label', a.guest_label,
      'visit_mechanism', a.visit_mechanism, 'discount_bps', a.discount_bps, 'discount_cents', a.discount_cents);
  end if;

  -- MESITA-4770: the visit discount, worked out here and nowhere else.
  v_mech := public.place_visit_mechanism(p_place_id);
  -- The same three lines as pay_tab_grant_cashback (MESITA-4766).
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = p_consumer_id and o.place_id = p_place_id
       and o.livemode = p_livemode and o.status = 'paid') then
    v_line := 'welcome';
  elsif public.consumer_is_vip_for_money(p_consumer_id, p_livemode) then
    v_line := 'returning_vip';
  else
    v_line := 'returning';
  end if;
  if v_mech = 'discount' then
    select * into r from public.place_cashback_rates(p_place_id);
    v_disc_bps := greatest(case v_line when 'welcome' then r.welcome_bps
                                       when 'returning_vip' then r.returning_vip_bps
                                       else r.returning_bps end, 0);
    v_disc := (p_bill_cents::bigint * v_disc_bps / 10000)::integer;
  end if;
  v_due := p_bill_cents - v_disc;

  if p_credit_cents + p_cash_bill_cents + p_card_bill_cents <> v_due then
    raise exception 'guest_refused:%', jsonb_build_object(
      'code', case when v_disc > 0 then 'discount_changed' else 'parts' end,
      'discount_bps', v_disc_bps, 'discount_cents', v_disc, 'to_pay_cents', v_due,
      'line', v_line);
  end if;
  if p_credit_cents > v_due
     or (p_cash_tip_cents > 0 and p_card_tip_cents > 0)
     or (p_cash_bill_cents + p_cash_tip_cents > 0 and p_card_bill_cents + p_card_tip_cents > 0) then
    raise exception 'guest_refused:%', jsonb_build_object('code', 'parts');
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
  elsif v_tender = 'credits' and p_credit_cents > 0 then
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
    currency, livemode, tender, status, payment_id, guest_label, token_hash, expires_at, held_at,
    visit_mechanism, discount_bps, discount_cents)
  values (
    p_consumer_id, p_place_id, p_request_id, p_bill_cents,
    case when v_tender = 'card' then p_card_tip_cents when v_tender = 'cash' then p_cash_tip_cents else 0 end,
    p_credit_cents,
    case when v_tender = 'cash' then p_cash_bill_cents + p_cash_tip_cents else 0 end,
    case when v_tender = 'card' then p_card_bill_cents + p_card_tip_cents else 0 end,
    v_cur, p_livemode, v_tender,
    case when v_tender = 'cash' then 'due' else 'opening' end,
    v_pay, v_label, p_token_hash, v_expires,
    case when v_tender = 'card' then null else p_now end,
    v_mech, v_disc_bps, v_disc)
  returning * into a;

  raise log '[guest-pay] %', jsonb_build_object('attempt_id', a.id, 'from', null, 'to', public.guest_pay_phase(a), 'reason', 'begin', 'source', 'begin', 'tender', v_tender, 'discount_cents', v_disc);
  return jsonb_build_object(
    'ok', true, 'outcome', 'opened', 'attempt_id', a.id, 'tab_id', null,
    'status', a.status, 'phase', public.guest_pay_phase(a), 'payment_id', v_pay,
    'card_payment_id', case when v_tender = 'card' then v_pay end,
    'expires_at', v_expires, 'cash_cents', a.cash_cents, 'guest_label', v_label,
    'visit_mechanism', v_mech, 'discount_bps', v_disc_bps, 'discount_cents', v_disc);
end;
$function$;
revoke all on function public.pay_guest_begin(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_guest_begin(uuid, uuid, text, boolean, text, integer, integer, integer, integer, integer, integer, uuid, text, integer, integer, timestamptz) to service_role;

-- ── 4. The paid bill keeps what applied ─────────────────────────────────────
create or replace function public.pay_guest_insert_closed(
  p_attempt public.guest_pay_attempts, p_now timestamptz)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_key constant text := 'cc873e0cc5c6d9a278d6804d17e2b06e46cd1e68701b86cbe7a87675f6121775';
begin
  insert into public.pay_tabs (
    place_id, consumer_id, token_hash, status, currency, livemode,
    bill_cents, tip_cents, bill_version, billed_at, pay_request_id,
    credit_cents, cash_bill_cents, cash_tip_cents, card_bill_cents, card_tip_cents,
    cash_received_cents, paying_at, paid_at, verified_at, verified_key_hash,
    expires_at, origin, visit_mechanism, discount_bps, discount_cents)
  values (
    p_attempt.place_id, p_attempt.consumer_id, p_attempt.token_hash, 'paid',
    p_attempt.currency, p_attempt.livemode, p_attempt.bill_cents, p_attempt.tip_cents,
    1, p_now, p_attempt.request_id, p_attempt.credit_cents,
    case when p_attempt.tender = 'cash' then p_attempt.cash_cents - p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'cash' then p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'card' then p_attempt.card_cents - p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'card' then p_attempt.tip_cents else 0 end,
    case when p_attempt.tender = 'cash' then p_attempt.cash_cents else null end,
    p_now, p_now, p_now, v_key, p_attempt.expires_at, 'guest',
    p_attempt.visit_mechanism, p_attempt.discount_bps, p_attempt.discount_cents)
  returning id into v_id;
  if p_attempt.payment_id is not null then
    update public.wallet_payments set tab_id = v_id, updated_at = now() where id = p_attempt.payment_id;
  end if;
  update public.guest_pay_attempts
     set status = 'closed', tab_id = v_id
   where id = p_attempt.id;
  return v_id;
end;
$function$;
revoke all on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_guest_insert_closed(public.guest_pay_attempts, timestamptz) to service_role;

-- ── 5. No cashback on a discounted bill (MESITA-4766's three lines kept) ──
create or replace function public.pay_tab_grant_cashback(p_tab_id uuid, p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  t public.pay_tabs;
  v_earn integer;
  v_line text;
  v_bps integer;
  r record;
  v_amount integer;
begin
  select * into t from public.pay_tabs where id = p_tab_id;
  if not found or t.status <> 'paid' or t.consumer_id is null then
    return 0;
  end if;
  -- MESITA-4770: the bill's own mechanism, never the place's current one.
  if t.visit_mechanism = 'discount' or t.discount_cents > 0 then
    return 0;
  end if;
  -- The part not paid with credit, never the tip.
  v_earn := coalesce(t.cash_bill_cents, 0) + coalesce(t.card_bill_cents, 0);
  if v_earn <= 0 then
    return 0;
  end if;
  -- New credit is born only where Loyalty Cards is On (the signed agreement).
  if not exists (select 1 from public.place_payment_settings s
                  where s.place_id = t.place_id and s.loyalty_cards) then
    return 0;
  end if;

  perform public.wallet_lock(t.consumer_id, t.place_id);

  if exists (select 1 from public.wallet_entries e where e.tab_id = t.id and e.kind = 'cashback') then
    return 0;
  end if;

  -- Welcome Everyone: no earlier paid bill here (VIP or not). Otherwise
  -- Returning VIP for a VIP (the bill's own money mode), else Returning Regular.
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = t.consumer_id and o.place_id = t.place_id
       and o.livemode = t.livemode and o.status = 'paid' and o.id <> t.id
       and o.paid_at < coalesce(t.paid_at, p_now)) then
    v_line := 'welcome';
  elsif public.consumer_is_vip_for_money(t.consumer_id, t.livemode) then
    v_line := 'returning_vip';
  else
    v_line := 'returning';
  end if;

  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case v_line when 'welcome' then r.welcome_bps
                       when 'returning_vip' then r.returning_vip_bps
                       else r.returning_bps end;
  if v_bps <= 0 then
    return 0;
  end if;
  -- No ceiling (MESITA-4728): the rate on every peso paid by card or cash.
  v_amount := (v_earn::bigint * v_bps / 10000)::integer;
  if v_amount <= 0 then
    return 0;
  end if;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, tab_id, livemode, available_at, reason)
  values (t.consumer_id, t.place_id, 'cashback', v_amount, lower(t.currency), t.id, t.livemode,
          coalesce(t.paid_at, p_now) + interval '1 hour', v_line);
  return v_amount;
end;
$function$;
revoke all on function public.pay_tab_grant_cashback(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_grant_cashback(uuid, timestamptz) to service_role;
comment on function public.pay_tab_grant_cashback(uuid, timestamptz) is
  'MESITA-4698, MESITA-4728, MESITA-4766, MESITA-4770: one paid bill''s Back: Welcome Everyone (first paid bill here), else Returning VIP (consumer_is_vip_for_money in the bill''s livemode) or Returning Regular, on cash_bill_cents + card_bill_cents, no cap, Pending 1 hour; none where Loyalty Cards is Off, on a bill recorded as discount, or on a bill that already has one. Reason = the line. Internal.';
