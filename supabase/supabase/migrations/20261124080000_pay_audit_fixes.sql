-- MESITA-4831 — the pay-flow audit (Pato, 2026-11-24: "Yes, fix 1-4").
--   pay_bill_open           a rescan finds the accepted bill still to collect
--   pay_bill_quote, pay_tab_grant_cashback
--                           one bill earns MX$1,000 of cashback at most
--                           (no ceiling since MESITA-4728, until now)
--   wallet_refund_outside   also takes back the cashback the bill earned

create or replace function public.visit_cashback_cap_cents()
 returns integer language sql immutable set search_path to 'public'
as $function$ select 100000; $function$;
comment on function public.visit_cashback_cap_cents() is
  'MESITA-4831: the most cashback one bill earns. Mirrored by CASHBACK_CAP_CENTS in functions/_shared/cashback.ts.';

create or replace function public.pay_bill_quote(
  p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean,
  p_bill_cents integer, p_tip_cents integer, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_vip boolean := public.consumer_is_vip_for_money(p_consumer_id, p_livemode);
  v_mech text := public.place_visit_mechanism(p_place_id);
  v_line text;
  v_bps integer;
  r record;
  v_disc_bps integer := 0;
  v_disc integer := 0;
  v_due integer;
  v_credit integer;
  v_back_bps integer := 0;
  v_back integer;
begin
  if not exists (
    select 1 from public.pay_tabs o
     where o.consumer_id = p_consumer_id and o.place_id = p_place_id
       and o.livemode = p_livemode and o.status = 'paid') then
    v_line := case when v_vip then 'welcome_vip' else 'welcome' end;
  else
    v_line := case when v_vip then 'returning_vip' else 'returning' end;
  end if;
  select * into r from public.place_cashback_rates(p_place_id);
  v_bps := greatest(coalesce(case v_line when 'welcome' then r.welcome_bps
                                         when 'welcome_vip' then r.welcome_vip_bps
                                         when 'returning_vip' then r.returning_vip_bps
                                         else r.returning_bps end, 0), 0);
  if v_mech = 'discount' then
    v_disc_bps := v_bps;
    v_disc := (p_bill_cents::bigint * v_bps / 10000)::integer;
  elsif exists (select 1 from public.place_payment_settings s
                 where s.place_id = p_place_id and s.loyalty_cards) then
    v_back_bps := v_bps;
  end if;
  v_due := p_bill_cents - v_disc;
  select least(coalesce(b.spendable_cents, 0), v_due) into v_credit
    from public.wallet_balance(p_consumer_id, p_place_id, lower(p_currency), p_livemode, p_now) b;
  v_credit := greatest(coalesce(v_credit, 0), 0);
  v_back := ((v_due - v_credit)::bigint * v_back_bps / 10000)::integer;
  return jsonb_build_object(
    'mechanism', v_mech, 'line', v_line,
    'discount_bps', v_disc_bps, 'discount_cents', v_disc,
    'credit_cents', v_credit, 'outside_bill_cents', v_due - v_credit,
    'tip_cents', p_tip_cents, 'outside_cents', v_due - v_credit + p_tip_cents,
    'cashback_bps', v_back_bps,
    'cashback_cents', least(v_back, public.visit_cashback_cap_cents()),
    'cashback_capped', v_back > public.visit_cashback_cap_cents());
end;
$function$;

create or replace function public.pay_bill_open(
  p_code_hash text, p_again_bill_id uuid, p_place_id uuid, p_currency text, p_livemode boolean,
  p_key_hash text, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_consumer uuid;
  b public.pay_bills;
  a public.guest_pay_attempts;
begin
  if p_again_bill_id is not null then
    select * into b from public.pay_bills where id = p_again_bill_id and place_id = p_place_id and livemode = p_livemode;
    if not found or b.not_mine or b.created_at < p_now - interval '3 hours' then
      return jsonb_build_object('ok', false, 'code', 'code_gone');
    end if;
    if b.status = 'accepted' then
      select * into a from public.guest_pay_attempts where id = b.attempt_id;
      if a.status <> 'released' then
        return jsonb_build_object('ok', false, 'code', 'not_over');
      end if;
    end if;
    v_consumer := b.consumer_id;
  else
    select consumer_id into v_consumer from public.pay_guest_codes
     where (token_hash = p_code_hash and expires_at > p_now)
        or (short_hash = p_code_hash and expires_at > p_now)
        or (prev_token_hash = p_code_hash and prev_until > p_now);
    if v_consumer is null then
      return jsonb_build_object('ok', false, 'code', 'code_gone');
    end if;
  end if;

  perform public.pay_guest_lock(v_consumer);
  -- The waiter lost the page of a bill the guest accepted: the rescan is that
  -- bill, still waiting for Received (MESITA-4831).
  select pb.* into b from public.pay_bills pb
    join public.guest_pay_attempts ga on ga.id = pb.attempt_id
   where pb.consumer_id = v_consumer and pb.place_id = p_place_id and pb.livemode = p_livemode
     and pb.status = 'accepted' and ga.status in ('opening', 'due')
     and (ga.expires_at > p_now or ga.charging_at is not null)
   order by pb.updated_at desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'outcome', 'accepted', 'bill_id', b.id);
  end if;
  -- A rescan picks up this place's own session (and its typed bill).
  select * into b from public.pay_bills
   where consumer_id = v_consumer and place_id = p_place_id and livemode = p_livemode
     and status in ('open', 'sent', 'declined') and expires_at > p_now and not not_mine
   order by updated_at desc limit 1;
  if found then
    return jsonb_build_object('ok', true, 'outcome', 'reused', 'bill_id', b.id);
  end if;
  if (select count(*) from public.pay_bills where consumer_id = v_consumer and place_id = p_place_id
        and created_at > p_now - interval '1 hour') >= 10
     or (select count(*) from public.pay_bills where consumer_id = v_consumer
        and created_at > p_now - interval '1 hour') >= 20
     or (select count(*) from public.pay_bills where staff_key_hash = p_key_hash
        and created_at > p_now - interval '1 hour') >= 120 then
    return jsonb_build_object('ok', false, 'code', 'too_many');
  end if;
  insert into public.pay_bills (consumer_id, place_id, livemode, currency, staff_key_hash, expires_at, created_at, updated_at)
  values (v_consumer, p_place_id, p_livemode, lower(p_currency), p_key_hash, p_now + interval '15 minutes', p_now, p_now)
  returning * into b;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'bill_id', b.id);
end;
$function$;

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
  -- New credit is born only where Loyalty Cards is On (the signed agreement);
  -- a rate the guest accepted was frozen with that answer in it (MESITA-4823).
  if t.cashback_bps is null and not exists (select 1 from public.place_payment_settings s
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

  if t.cashback_bps is not null then
    v_line := coalesce(t.cashback_line, v_line);
  end if;
  select * into r from public.place_cashback_rates(t.place_id);
  v_bps := case v_line when 'welcome' then r.welcome_bps
                       when 'welcome_vip' then r.welcome_vip_bps
                       when 'returning_vip' then r.returning_vip_bps
                       else r.returning_bps end;
  v_bps := coalesce(t.cashback_bps, v_bps);
  if v_bps <= 0 then
    return 0;
  end if;
  -- The ceiling of one bill (MESITA-4831).
  v_amount := least((v_earn::bigint * v_bps / 10000)::integer, public.visit_cashback_cap_cents());
  if v_amount <= 0 then
    return 0;
  end if;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, tab_id, livemode, available_at, reason)
  values (t.consumer_id, t.place_id, 'cashback', v_amount, lower(t.currency), t.id, t.livemode,
          coalesce(t.paid_at, p_now) + interval '1 hour', v_line);
  return v_amount;
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
  c public.wallet_entries;
  v_credit integer;
  v_earn integer;
  v_take integer := 0;
  v_holds integer;
  v_reversed integer := 0;
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

  -- The bill's cashback, this payment's share of it (a split bill has more
  -- than one), up to the credit the guest still holds. While it is Pending
  -- the reversal lands with it, so it never eats other credit.
  if v.tab_id is not null then
    select * into c from public.wallet_entries where tab_id = v.tab_id and kind = 'cashback';
    if found then
      select coalesce(t.cash_bill_cents, 0) + coalesce(t.card_bill_cents, 0) into v_earn
        from public.pay_tabs t where t.id = v.tab_id;
      v_take := least(c.amount_cents,
        case when coalesce(v_earn, 0) <= 0 then c.amount_cents
             else (c.amount_cents::bigint * v.outside_cents / v_earn)::integer end);
      select greatest(available_cents + pending_cents - held_cents, 0) into v_holds
        from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode);
      v_reversed := least(v_take, v_holds);
      if v_reversed > 0 then
        insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at, reason)
        values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode,
                greatest(c.available_at, now()), 'refund');
      end if;
    end if;
  end if;

  v_uncovered := v.uncovered_cents + (v_take - v_reversed);
  v_status := case when v_uncovered > 0 then 'needs_review' else 'refunded' end;

  update public.wallet_payments
     set credit_refunded_cents = v.credit_cents, uncovered_cents = v_uncovered, status = v_status, updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'status', v_status,
    'credit_refunded_cents', v_credit, 'cashback_reversed_cents', v_reversed, 'uncovered_cents', v_uncovered);
end;
$function$;

revoke all on function public.visit_cashback_cap_cents() from public, anon, authenticated;
grant execute on function public.visit_cashback_cap_cents() to service_role;
revoke all on function public.pay_bill_quote(uuid, uuid, text, boolean, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_quote(uuid, uuid, text, boolean, integer, integer, timestamptz) to service_role;
revoke all on function public.pay_bill_open(text, uuid, uuid, text, boolean, text, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_bill_open(text, uuid, uuid, text, boolean, text, timestamptz) to service_role;
revoke all on function public.pay_tab_grant_cashback(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pay_tab_grant_cashback(uuid, timestamptz) to service_role;
revoke all on function public.wallet_refund_outside(uuid) from public, anon, authenticated;
grant execute on function public.wallet_refund_outside(uuid) to service_role;
