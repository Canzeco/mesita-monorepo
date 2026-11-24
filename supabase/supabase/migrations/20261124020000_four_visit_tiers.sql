-- MESITA-4789 (Pato, 2026-11-23): "for simplicity we are going to add four
-- tiers. Welcome Regular, Returning Regular, Welcome VIP, Returning VIP".
--
-- 1. welcome_vip_bps (Off · 10 · 20 %) on place_cashback_settings and
--    cashback_defaults, backfilled = welcome_bps: until an owner changes it a
--    VIP's first bill earns what it earned yesterday (Welcome was everyone's).
-- 2. The ledger's cashback reason also allows 'welcome_vip'.
-- 3. place_cashback_rates returns the fourth rate.
-- 4. pay_guest_begin (Discount) and pay_tab_grant_cashback (Cashback) pick
--    one of four lines: first paid bill → welcome_vip | welcome; later →
--    returning_vip | returning. The stored key 'welcome' stays and reads
--    Welcome Regular (a renamed key would orphan old ledger rows).

-- ── 1. The fourth rate ──────────────────────────────────────────────────────
alter table public.place_cashback_settings
  add column if not exists welcome_vip_bps integer;
update public.place_cashback_settings set welcome_vip_bps = welcome_bps where welcome_vip_bps is null;
alter table public.place_cashback_settings alter column welcome_vip_bps set default 1000;
alter table public.place_cashback_settings alter column welcome_vip_bps set not null;
alter table public.place_cashback_settings drop constraint if exists place_cashback_settings_welcome_vip_bps_check;
alter table public.place_cashback_settings add constraint place_cashback_settings_welcome_vip_bps_check
  check (welcome_vip_bps in (0, 1000, 2000));
comment on column public.place_cashback_settings.welcome_vip_bps is
  'MESITA-4789: Welcome VIP, a VIP guest''s first paid bill here (Off · 10 · 20 %), by the place''s visit mechanism.';

alter table public.cashback_defaults
  add column if not exists welcome_vip_bps integer;
update public.cashback_defaults set welcome_vip_bps = welcome_bps where welcome_vip_bps is null;
alter table public.cashback_defaults alter column welcome_vip_bps set default 1000;
alter table public.cashback_defaults alter column welcome_vip_bps set not null;
alter table public.cashback_defaults drop constraint if exists cashback_defaults_welcome_vip_bps_check;
alter table public.cashback_defaults add constraint cashback_defaults_welcome_vip_bps_check
  check (welcome_vip_bps in (0, 1000, 2000));

-- ── 2. The ledger's reason ──────────────────────────────────────────────────
alter table public.wallet_entries drop constraint if exists wallet_entries_reason_chk;
alter table public.wallet_entries add constraint wallet_entries_reason_chk check (
  reason is null
  or (kind = 'reversal' and reason in ('refund', 'dispute_lost', 'credit_refund'))
  or (kind = 'cashback' and reason in ('welcome', 'welcome_vip', 'returning', 'returning_vip'))
);

-- ── 3. The rates ────────────────────────────────────────────────────────────
drop function if exists public.place_cashback_rates(uuid);
create function public.place_cashback_rates(p_place_id uuid)
 returns table(welcome_bps integer, returning_bps integer, returning_vip_bps integer, welcome_vip_bps integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(s.welcome_bps, d.welcome_bps, 1000), coalesce(s.returning_bps, d.returning_bps, 500),
         coalesce(s.returning_vip_bps, d.returning_vip_bps, 1000),
         coalesce(s.welcome_vip_bps, d.welcome_vip_bps, 1000)
    from (select 1) one
    left join public.cashback_defaults d on d.id
    left join public.place_cashback_settings s on s.place_id = p_place_id;
$function$;
revoke all on function public.place_cashback_rates(uuid) from public, anon, authenticated;
grant execute on function public.place_cashback_rates(uuid) to service_role;

-- ── 4. Begin (Discount) ─────────────────────────────────────────────────────
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
  v_vip boolean;
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
  -- The same four lines as pay_tab_grant_cashback (MESITA-4789): first
  -- paid bill here → Welcome VIP or Welcome Regular; later → Returning VIP
  -- or Returning Regular.
  v_vip := public.consumer_is_vip_for_money(p_consumer_id, p_livemode);
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = p_consumer_id and o.place_id = p_place_id
       and o.livemode = p_livemode and o.status = 'paid') then
    v_line := case when v_vip then 'welcome_vip' else 'welcome' end;
  elsif v_vip then
    v_line := 'returning_vip';
  else
    v_line := 'returning';
  end if;
  if v_mech = 'discount' then
    select * into r from public.place_cashback_rates(p_place_id);
    v_disc_bps := greatest(case v_line when 'welcome' then r.welcome_bps
                                       when 'welcome_vip' then r.welcome_vip_bps
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

-- ── 5. The grant (Cashback) ─────────────────────────────────────────────────
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
  v_vip boolean;
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

  -- Four lines (MESITA-4789): no earlier paid bill here → Welcome VIP for a
  -- VIP (the bill's own money mode), else Welcome Regular; otherwise
  -- Returning VIP or Returning Regular.
  v_vip := public.consumer_is_vip_for_money(t.consumer_id, t.livemode);
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = t.consumer_id and o.place_id = t.place_id
       and o.livemode = t.livemode and o.status = 'paid' and o.id <> t.id
       and o.paid_at < coalesce(t.paid_at, p_now)) then
    v_line := case when v_vip then 'welcome_vip' else 'welcome' end;
  elsif v_vip then
    v_line := 'returning_vip';
  else
    v_line := 'returning';
  end if;

  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case v_line when 'welcome' then r.welcome_bps
                       when 'welcome_vip' then r.welcome_vip_bps
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
  'MESITA-4698, MESITA-4728, MESITA-4766, MESITA-4770, MESITA-4789: one paid bill''s Cashback by four lines: first paid bill here → Welcome VIP (consumer_is_vip_for_money in the bill''s livemode) or Welcome Regular; later → Returning VIP or Returning Regular; on cash_bill_cents + card_bill_cents, no cap, Pending 1 hour; none where Loyalty Cards is Off, on a bill recorded as discount, or on a bill that already has one. Reason = the line. Internal.';
