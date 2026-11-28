-- MESITA-5076 (Pato, 2026-11-27: "Yes, delete it"): the visit Discount is
-- gone (MESITA-5067 made it unreachable). This deletes what was left:
--   * the discount sum in pay_guest_begin and pay_bill_quote (the parts of a
--     bill now add up to the bill; 'discount_changed' is gone),
--   * pay_tab_grant_cashback's "bill recorded as discount" guard,
--   * place_monitor_list's discount_cents,
--   * the "no waiter code" option, which existed only for Discount places
--     (MESITA-4890): waiter_no_code, place_cashback_needs_code and
--     place_waiters.no_code; every bill needs the waiter code,
--   * place_visit_mechanism and the visit_mechanism / discount_* columns.
-- Bodies are the live ones (pg_get_functiondef) with only those parts cut.
-- Bills that recorded a discount were test data; their columns go with them.

-- An active no-code row is a zombie now; retire it before the index that
-- allows one code per place loses its no_code condition.
update public.place_waiters
   set removed_at = now(), lookup_hash = null, code = null, updated_at = now()
 where no_code and removed_at is null;

drop trigger if exists place_cashback_needs_code on public.place_cashback_settings;
drop function if exists public.place_cashback_needs_code();
drop function if exists public.waiter_no_code(text, uuid, timestamptz);

CREATE OR REPLACE FUNCTION public.pay_bill_quote(p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_bill_cents integer, p_tip_cents integer, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_vip boolean := public.consumer_is_vip_for_money(p_consumer_id, p_livemode);
  v_line text;
  v_bps integer;
  r record;
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
  if exists (select 1 from public.place_payment_settings s
                 where s.place_id = p_place_id and s.loyalty_cards) then
    v_back_bps := v_bps;
  end if;
  v_due := p_bill_cents;
  select least(coalesce(b.spendable_cents, 0), v_due) into v_credit
    from public.wallet_balance(p_consumer_id, p_place_id, lower(p_currency), p_livemode, p_now) b;
  v_credit := greatest(coalesce(v_credit, 0), 0);
  v_back := ((v_due - v_credit)::bigint * v_back_bps / 10000)::integer;
  return jsonb_build_object(
    'line', v_line,
    'credit_cents', v_credit, 'outside_bill_cents', v_due - v_credit,
    'tip_cents', p_tip_cents, 'outside_cents', v_due - v_credit + p_tip_cents,
    'cashback_bps', v_back_bps,
    'cashback_cents', least(v_back, public.visit_cashback_cap_cents()),
    'cashback_capped', v_back > public.visit_cashback_cap_cents());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pay_guest_begin(p_consumer_id uuid, p_place_id uuid, p_currency text, p_livemode boolean, p_token_hash text, p_bill_cents integer, p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer, p_card_bill_cents integer, p_card_tip_cents integer, p_request_id uuid, p_stripe_account_id text, p_card_fee_cents integer, p_window_minutes integer DEFAULT 15, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.guest_pay_attempts;
  v_open public.guest_pay_attempts;
  v_spendable integer;
  v_pay uuid;
  v_label text;
  v_tender text;
  v_expires timestamptz := p_now + make_interval(mins => greatest(least(coalesce(p_window_minutes, 15), 120), 5));
  v_cur text := lower(p_currency);
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
      'expires_at', a.expires_at, 'cash_cents', a.cash_cents, 'guest_label', a.guest_label);
  end if;

  v_due := p_bill_cents;

  if p_credit_cents + p_cash_bill_cents + p_card_bill_cents <> v_due then
    raise exception 'guest_refused:%', jsonb_build_object(
      'code', 'parts', 'to_pay_cents', v_due);
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
$function$
;

CREATE OR REPLACE FUNCTION public.pay_bill_accept(p_bill_id uuid, p_consumer_id uuid, p_version integer, p_token_hash text, p_window_minutes integer DEFAULT 60, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b public.pay_bills;
  a public.guest_pay_attempts;
  q jsonb;
  r jsonb;
  v_msg text;
  v_why jsonb;
  v_ready boolean;
begin
  select * into b from public.pay_bills where id = p_bill_id and consumer_id = p_consumer_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'gone'); end if;
  perform public.pay_guest_lock(p_consumer_id);
  perform public.wallet_lock(p_consumer_id, b.place_id);
  select * into b from public.pay_bills where id = p_bill_id for update;

  if b.status = 'accepted' then
    select * into a from public.guest_pay_attempts where id = b.attempt_id;
    if a.status = 'released' then return jsonb_build_object('ok', false, 'code', 'already_final', 'end_reason', a.end_reason); end if;
    return jsonb_build_object('ok', true, 'outcome', 'replayed', 'attempt_id', a.id, 'status', a.status, 'tab_id', a.tab_id);
  end if;
  if b.status <> 'sent' then return jsonb_build_object('ok', false, 'code', b.status); end if;
  if b.expires_at <= p_now then
    update public.pay_bills set status = 'expired', updated_at = p_now where id = b.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if b.version is distinct from p_version then
    return jsonb_build_object('ok', false, 'code', 'quote_changed', 'version', b.version);
  end if;

  q := public.pay_bill_quote(b.consumer_id, b.place_id, b.currency, b.livemode, b.bill_cents, b.tip_cents, p_now);
  if q is distinct from b.quote then
    update public.pay_bills set quote = q, version = b.version + 1, updated_at = p_now,
           received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
     where id = b.id;
    return jsonb_build_object('ok', false, 'code', 'quote_changed', 'version', b.version + 1);
  end if;

  -- The waiter's Receive on these same numbers (MESITA-4889), while their
  -- code still works here.
  v_ready := b.received_version is not distinct from b.version
    and (b.received_waiter_id is null or exists (
      select 1 from public.place_waiters w where w.id = b.received_waiter_id and w.removed_at is null));

  begin
    r := public.pay_guest_begin(
      b.consumer_id, b.place_id, b.currency, b.livemode, p_token_hash,
      b.bill_cents, (q->>'credit_cents')::integer, (q->>'outside_bill_cents')::integer, b.tip_cents,
      0, 0, b.id, null, 0, p_window_minutes, p_now);
    update public.guest_pay_attempts
       set cashback_line = q->>'line', cashback_bps = (q->>'cashback_bps')::integer
     where id = (r->>'attempt_id')::uuid
     returning * into a;
    if v_ready then
      -- Both sides coincide: paid, here and now.
      r := public.pay_guest_claim_confirm(a.id, b.place_id, b.received_key_hash, p_now);
      if (r->>'ok')::boolean is not true then raise exception 'accept_claim:%', r->>'code'; end if;
      r := public.pay_guest_close(a.id, p_now);
      if (r->>'ok')::boolean is not true then raise exception 'accept_close:%', r->>'code'; end if;
    end if;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'too_many_open');
    when raise_exception then
      v_msg := sqlerrm;
      if v_msg not like 'guest_refused:%' then raise; end if;
      v_why := substr(v_msg, length('guest_refused:') + 1)::jsonb;
      if v_why->>'code' in ('insufficient', 'parts') then
        update public.pay_bills
           set version = b.version + 1, updated_at = p_now,
               quote = public.pay_bill_quote(b.consumer_id, b.place_id, b.currency, b.livemode, b.bill_cents, b.tip_cents, p_now),
               received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
         where id = b.id;
        return jsonb_build_object('ok', false, 'code', 'quote_changed', 'version', b.version + 1);
      end if;
      return v_why || jsonb_build_object('ok', false);
  end;

  update public.pay_bills set status = 'accepted', attempt_id = a.id, updated_at = p_now,
         received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
   where id = b.id;
  select * into a from public.guest_pay_attempts where id = a.id;
  return jsonb_build_object('ok', true, 'outcome', 'accepted', 'attempt_id', a.id, 'status', a.status, 'tab_id', a.tab_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.place_monitor_list(p_place_id uuid, p_livemode boolean, p_kind text, p_customer text DEFAULT NULL::text, p_id uuid DEFAULT NULL::uuid, p_before jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rank integer := coalesce((p_before ->> 'rank')::integer, 0);
  v_at timestamptz := (p_before ->> 'at')::timestamptz;
  v_id uuid := (p_before ->> 'id')::uuid;
  v_rows jsonb;
  v_next jsonb;
begin
  if p_kind not in ('visits', 'vouchers', 'gifts', 'payments', 'credits') then
    raise exception 'place_monitor_list: kind must be visits, vouchers, gifts, payments or credits';
  end if;

  with base as (
    -- Visits: the bills place_visit_rows keeps (MESITA-4682), with how each
    -- was settled read from the bill row itself; a split table carries its
    -- shares' total and count, and its shares are rows of their own.
    select t.id, t.at, 0 as rank,
           t.consumer_id, null::uuid as other_id,
           jsonb_build_object(
             'status', t.status,
             'bill_cents', t.bill_cents,
             'tip_cents', t.tip_cents,
             'card_cents', t.card_bill_cents,
             'credit_cents', t.credit_cents,
             'outside_cents', t.cash_bill_cents,
             'split', t.split_at is not null,
             'shares', t.shares,
             'shares_total_cents', t.shares_total_cents,
             'share', t.parent_tab_id is not null,
             'ticket', t.ticket,
             'waiter_name', t.waiter_name,
             -- MESITA-4703: the cashback this bill earned (MESITA-4698), 0 when none.
             'cashback_cents', coalesce((select sum(e.amount_cents) from public.wallet_entries e
                                          where e.tab_id = t.id and e.kind = 'cashback'), 0)) as payload,
           coalesce((select jsonb_agg(jsonb_build_object('kind', 'payment', 'id', p.id) order by p.created_at)
                       from public.wallet_payments p
                      where p.tab_id = t.id and p.paid_at is not null), '[]'::jsonb) as links
      from public.place_visit_rows(p_place_id, p_livemode) t
     where p_kind = 'visits'
    union all
    -- Vouchers: paid prepayments.
    select v.id, v.paid_at, 0, v.consumer_id, null::uuid,
           jsonb_build_object(
             'status', v.status,
             'voucher', v.voucher,
             'amount_cents', v.amount_cents,
             'bonus_cents', v.bonus_cents,
             'refunded_cents', v.refunded_cents,
             'currency', v.currency),
           coalesce((select jsonb_agg(jsonb_build_object('kind', 'credit', 'id', e.id) order by e.created_at)
                       from public.wallet_entries e where e.purchase_id = v.id), '[]'::jsonb)
      from public.wallet_purchases v
     where p_kind = 'vouchers'
       and v.place_id = p_place_id and v.livemode = p_livemode and v.paid_at is not null
    union all
    -- Payments (MESITA-4682, Pato: "just mention the Stripe Payments
    -- events"): card charges only. Cash and credit live on Visits.
    select p.id, p.paid_at, 0, p.consumer_id, null::uuid,
           jsonb_build_object(
             'status', p.status,
             'amount_cents', p.amount_cents,
             'credit_cents', p.credit_cents,
             'card_cents', p.card_cents,
             'outside_cents', p.outside_cents,
             'tip_cents', p.tip_cents,
             'refunded_cents', p.refunded_cents,
             'credit_refunded_cents', p.credit_refunded_cents,
             'currency', p.currency),
           (case when p.tab_id is not null then jsonb_build_array(jsonb_build_object('kind', 'visit', 'id', p.tab_id)) else '[]'::jsonb end)
           || coalesce((select jsonb_agg(jsonb_build_object('kind', 'credit', 'id', e.id) order by e.created_at)
                          from public.wallet_entries e where e.payment_id = p.id), '[]'::jsonb)
      from public.wallet_payments p
     where p_kind = 'payments'
       and p.place_id = p_place_id and p.livemode = p_livemode and p.paid_at is not null
       and p.card_cents > 0
    union all
    -- Credits: every wallet_entries row, the ledger itself.
    select e.id, e.created_at, 0, e.consumer_id,
           case e.kind when 'gift_out' then g.recipient_id
                       when 'gift_in' then g.sender_id
                       when 'gift_back' then g.recipient_id end,
           jsonb_build_object(
             'kind', e.kind,
             'reason', e.reason,
             'amount_cents', e.amount_cents,
             'currency', e.currency,
             'gift_status', g.status,
             'voucher', pu.voucher),
           (case when e.purchase_id is not null then jsonb_build_array(jsonb_build_object('kind', 'voucher', 'id', e.purchase_id)) else '[]'::jsonb end)
           || (case when e.payment_id is not null then jsonb_build_array(jsonb_build_object('kind', 'payment', 'id', e.payment_id)) else '[]'::jsonb end)
           || (case when pay.tab_id is not null then jsonb_build_array(jsonb_build_object('kind', 'visit', 'id', pay.tab_id)) else '[]'::jsonb end)
      from public.wallet_entries e
      left join public.wallet_gifts g on g.id = e.gift_id
      left join public.wallet_purchases pu on pu.id = e.purchase_id
      left join public.wallet_payments pay on pay.id = e.payment_id
     where p_kind = 'credits'
       and e.place_id = p_place_id and e.livemode = p_livemode
    union all
    -- Gifts (MESITA-4555): one row per gift link at the place: the sender is
    -- the row's guest, the friend who took it the other guest.
    select g.id, g.created_at, 0, g.sender_id, g.recipient_id,
           jsonb_build_object(
             'status', g.status,
             'amount_cents', g.amount_cents,
             'currency', g.currency,
             'claimed_at', g.claimed_at,
             'taken_back_at', g.taken_back_at),
           '[]'::jsonb
      from public.wallet_gifts g
     where p_kind = 'gifts'
       and g.place_id = p_place_id and g.livemode = p_livemode
  ), filtered as (
    select b.*
      from base b
     where (p_id is null or b.id = p_id
            or b.links @> jsonb_build_array(jsonb_build_object('id', p_id::text)))
       and (p_customer is null
            or public.place_customer_key(p_place_id, b.consumer_id) = p_customer
            or public.place_customer_key(p_place_id, b.other_id) = p_customer)
  ), page as (
    select f.*
      from filtered f
     where p_before is null
        or f.rank > v_rank
        or (f.rank = v_rank and (f.at, f.id) < (v_at, v_id))
     order by f.rank, f.at desc, f.id desc
     limit 51
  ), named as (
    select page.*,
           row_number() over (order by page.rank, page.at desc, page.id desc) as n,
           coalesce(nullif(btrim(c.full_name), ''), nullif(btrim(c.first_name), '')) as guest_name,
           u.email as guest_email,
           coalesce(nullif(btrim(oc.full_name), ''), nullif(btrim(oc.first_name), '')) as other_name,
           ou.email as other_email
      from page
      left join public.consumers c on c.id = page.consumer_id
      left join auth.users u on u.id = page.consumer_id
      left join public.consumers oc on oc.id = page.other_id
      left join auth.users ou on ou.id = page.other_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id,
      'at', n.at,
      'rank', n.rank,
      'customer', public.place_customer_key(p_place_id, n.consumer_id),
      'other_customer', public.place_customer_key(p_place_id, n.other_id),
      'guest_name', n.guest_name,
      'guest_email', n.guest_email,
      'other_name', n.other_name,
      'other_email', n.other_email,
      'face', public.place_guest_face(n.consumer_id),
      'other_face', public.place_guest_face(n.other_id),
      'payload', n.payload,
      'links', n.links
    ) order by n.n) filter (where n.n <= 50), '[]'::jsonb),
    (select jsonb_build_object('rank', x.rank, 'at', x.at, 'id', x.id)
       from named x where x.n = 50 and exists (select 1 from named y where y.n = 51))
    into v_rows, v_next
    from named n;

  return jsonb_build_object('rows', v_rows, 'next', v_next);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pay_guest_insert_closed(p_attempt guest_pay_attempts, p_now timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_waiter uuid;
  v_waiter_name text;
  v_key constant text := 'cc873e0cc5c6d9a278d6804d17e2b06e46cd1e68701b86cbe7a87675f6121775';
begin
  -- The name typed with the code, when the place asks for one (MESITA-4904). A waiter-led
  -- attempt's request id is its bill.
  select w.id, b.waiter_name into v_waiter, v_waiter_name
    from public.pay_bills b join public.place_waiters w on w.id = b.waiter_id
   where b.id = p_attempt.request_id and b.consumer_id = p_attempt.consumer_id and b.place_id = p_attempt.place_id;
  insert into public.pay_tabs (
    place_id, consumer_id, token_hash, status, currency, livemode,
    bill_cents, tip_cents, bill_version, billed_at, pay_request_id,
    credit_cents, cash_bill_cents, cash_tip_cents, card_bill_cents, card_tip_cents,
    cash_received_cents, paying_at, paid_at, verified_at, verified_key_hash,
    expires_at, origin, cashback_line, cashback_bps, waiter_id, waiter_name)
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
    p_attempt.cashback_line, p_attempt.cashback_bps, v_waiter, v_waiter_name)
  returning id into v_id;
  if p_attempt.payment_id is not null then
    update public.wallet_payments set tab_id = v_id, updated_at = now() where id = p_attempt.payment_id;
  end if;
  update public.guest_pay_attempts
     set status = 'closed', tab_id = v_id
   where id = p_attempt.id;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pay_tab_grant_cashback(p_tab_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.waiter_code_try(p_token_hash text, p_bill_id uuid, p_addr_hash text, p_code text, p_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c_window constant interval := interval '10 minutes';
  c_guest_limit constant integer := 15;
  c_addr_limit constant integer := 30;
  c_day constant interval := interval '24 hours';
  c_guest_day constant integer := 15;
  c_addr_day constant integer := 100;
  v_consumer uuid;
  v_guest_key text;
  v_at uuid;
  v_place uuid;
  v_waiter uuid;
  v_until timestamptz;
  c_ticket_limit constant integer := 3;
  v_wrong integer;
begin
  if p_token_hash is not null then
    select consumer_id, place_id into v_consumer, v_at from public.pay_guest_codes
     where (token_hash = p_token_hash and expires_at > p_now)
        or (prev_token_hash = p_token_hash and prev_until > p_now);
  else
    select consumer_id, place_id into v_consumer, v_at from public.pay_bills
     where id = p_bill_id and created_at > p_now - interval '3 hours';
  end if;
  if v_consumer is null then
    return jsonb_build_object('ok', false, 'code', 'code_gone');
  end if;
  -- A PIN is its place's own: the place is the QR's (or the bill's).
  if v_at is null then
    return jsonb_build_object('ok', false, 'code', 'place_needed');
  end if;
  v_guest_key := encode(sha256(convert_to('waiter-code-guest:' || v_consumer::text, 'UTF8')), 'hex');
  -- The guest's lock first, as every bill call: a close here never meets a Pay.
  perform public.pay_guest_lock(v_consumer);
  perform pg_advisory_xact_lock(hashtextextended('waiter-code:' || v_guest_key, 0));
  perform pg_advisory_xact_lock(hashtextextended('waiter-code:' || p_addr_hash, 0));

  select max(u) into v_until from (
    (select tried_at + c_window as u from public.place_charge_tries
      where place_id is null and kind = 'guest' and addr_hash = v_guest_key and tried_at > p_now - c_window
      order by tried_at desc offset c_guest_limit - 1 limit 1)
    union all
    (select tried_at + c_window from public.place_charge_tries
      where place_id is null and kind = 'staff' and addr_hash = p_addr_hash and tried_at > p_now - c_window
      order by tried_at desc offset c_addr_limit - 1 limit 1)
    union all
    (select tried_at + c_day from public.place_charge_tries
      where place_id is null and kind = 'guest' and addr_hash = v_guest_key and tried_at > p_now - c_day
      order by tried_at desc offset c_guest_day - 1 limit 1)
    union all
    (select tried_at + c_day from public.place_charge_tries
      where place_id is null and kind = 'staff' and addr_hash = p_addr_hash and tried_at > p_now - c_day
      order by tried_at desc offset c_addr_day - 1 limit 1)) locks;
  if v_until is not null then
    return jsonb_build_object('ok', false, 'code', 'locked',
      'retry_after_s', greatest(ceil(extract(epoch from v_until - p_now))::integer, 1));
  end if;

  select w.place_id, w.id into v_place, v_waiter from public.place_waiters w
    join public.places p on p.id = w.place_id and p.state = 'active'
   where w.place_id = v_at and w.code = p_code and w.removed_at is null;
  if v_place is null then
    insert into public.place_charge_tries (place_id, kind, addr_hash, tried_at)
    values (null, 'guest', v_guest_key, p_now), (null, 'staff', p_addr_hash, p_now);
    -- The third wrong one ends the ticket (MESITA-4898): the QR, or a bill the
    -- guest has not accepted.
    if p_token_hash is not null then
      update public.pay_guest_codes set wrong_codes = wrong_codes + 1
       where consumer_id = v_consumer returning wrong_codes into v_wrong;
      if v_wrong >= c_ticket_limit then
        update public.pay_guest_codes
           set closed_at = p_now, expires_at = p_now, prev_token_hash = null, prev_until = null,
               draft_bill_cents = null, draft_tip_cents = null, draft_step = null, draft_at = null
         where consumer_id = v_consumer;
      end if;
    else
      update public.pay_bills set wrong_codes = wrong_codes + 1 where id = p_bill_id returning wrong_codes into v_wrong;
      if v_wrong >= c_ticket_limit then
        update public.pay_bills
           set status = 'cancelled', updated_at = p_now,
               received_version = null, received_at = null, received_key_hash = null, received_waiter_id = null
         where id = p_bill_id and status in ('open', 'sent', 'declined');
        if not found then
          return jsonb_build_object('ok', false, 'code', 'staff_only', 'left', 0);
        end if;
      end if;
    end if;
    if v_wrong >= c_ticket_limit then
      perform public.guest_ticket_closed(v_consumer, v_at, p_now);
      return jsonb_build_object('ok', false, 'code', 'ticket_closed');
    end if;
    return jsonb_build_object('ok', false, 'code', 'staff_only', 'left', c_ticket_limit - v_wrong);
  end if;
  update public.pay_guest_codes set wrong_codes = 0 where p_token_hash is not null and consumer_id = v_consumer and wrong_codes > 0;
  update public.pay_bills set wrong_codes = 0 where id = p_bill_id and wrong_codes > 0;
  return jsonb_build_object('ok', true, 'place_id', v_place, 'waiter_id', v_waiter);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.waiter_name_required(p_token_hash text, p_bill_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.place_waiters w
     where w.name_required and w.removed_at is null
       and w.place_id = case when p_token_hash is not null
         then (select c.place_id from public.pay_guest_codes c
                where (c.token_hash = p_token_hash and c.expires_at > p_now)
                   or (c.prev_token_hash = p_token_hash and c.prev_until > p_now))
         else (select b.place_id from public.pay_bills b where b.id = p_bill_id and b.created_at > p_now - interval '3 hours') end);
$function$
;

CREATE OR REPLACE FUNCTION public.place_staff_code_start(p_place_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform pg_advisory_xact_lock(hashtextextended('staff-code:' || p_place_id::text, 0));
  if exists (select 1 from public.place_waiters where place_id = p_place_id and removed_at is null) then return; end if;
  insert into public.place_waiters (place_id, name, code, lookup_hash)
  values (p_place_id, 'Staff',
    lpad((('x' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 7))::bit(28)::integer % 1000000)::text, 6, '0'),
    encode(extensions.gen_random_bytes(32), 'hex'));
end;
$function$;

drop function if exists public.place_visit_mechanism(uuid);

alter table public.pay_tabs
  drop column if exists visit_mechanism,
  drop column if exists discount_bps,
  drop column if exists discount_cents;
alter table public.guest_pay_attempts
  drop column if exists visit_mechanism,
  drop column if exists discount_bps,
  drop column if exists discount_cents;
alter table public.place_cashback_settings drop column if exists visit_mechanism;
alter table public.cashback_defaults drop column if exists visit_mechanism;

alter table public.place_waiters drop column if exists no_code;
create unique index if not exists place_waiters_one_code
  on public.place_waiters (place_id) where removed_at is null;
