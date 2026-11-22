-- MESITA-4642 — THE STORY BACKEND IS GONE. Pato, 2026-11-22: "REMOVE STORIES
-- FROM EVERYWHERE". MESITA-4641 stopped every sale (voucher_story forced off,
-- story_create raising, the recheck cron unscheduled); this migration removes
-- what is left in the database:
--   1. asserts no guest is owed anything by a Story;
--   2. rewrites the readers that branched on Stories (the Business ticket
--      desk and monitor lists, the customers list) and the ledger's credit;
--   3. drops every Story function and the money_config story_* keys and the
--      models_config `stories` model.
-- Kept on purpose: the stories / story_mentions tables and the
-- wallet_purchases.story_* columns (dropped 2026-11-29, rollback rows); the
-- dead place_payment_settings.voucher_story column and its no_story check,
-- like voucher_welcome's; wallet_refund_purchase's ledger math for a Story
-- purchase, so a refund of one paid before today reverses only what it
-- credited. Storage buckets go through supabase/scripts/delete-story-buckets.ts
-- (Storage API, never SQL). The last code with Stories is the tag
-- `stories-final`.

-- 1. Nothing is owed: every Story is released (bonus paid) or void.
do $$
declare
  r record;
begin
  select s.id, s.purchase_id, s.state into r
    from public.stories s
   where s.state not in ('released', 'void')
   limit 1;
  if found then
    raise exception 'story_unsettled: story % purchase % state %; settle it, then re-apply', r.id, r.purchase_id, r.state;
  end if;
end;
$$;

-- 2a. Business › Operations ticket desk: visits, vouchers, gifts. A Story
--     purchase stays a voucher row (wallet_purchases.voucher is text).
create or replace function public.place_ticket_desk(
  p_place_id uuid,
  p_kind text,
  p_livemode boolean,
  p_timezone text,
  p_before timestamptz default null,
  p_before_id uuid default null,
  p_before_rank integer default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_tz text := case
    when p_timezone ~ '^[A-Za-z_][A-Za-z0-9_/+-]{0,63}$' then p_timezone
    else 'America/Mexico_City'
  end;
  v_rank integer := coalesce(p_before_rank, 0);
  v_days jsonb;
  v_totals jsonb;
  v_rows jsonb;
  v_next jsonb;
begin
  if p_kind not in ('visits', 'vouchers', 'gifts') then
    raise exception 'place_ticket_desk: kind must be visits, vouchers or gifts';
  end if;

  with base as (
    select t.id,
           coalesce(t.paid_at, t.created_at) as at,
           0 as rank,
           t.consumer_id,
           null::uuid as other_id,
           case when t.status = 'paid' then coalesce(t.bill_cents, 0) + t.tip_cents else 0 end as chart_cents,
           jsonb_build_object(
             'status', t.status,
             'open', t.status in ('waiting_bill', 'billed', 'paying'),
             'origin', t.origin,
             'bill_cents', t.bill_cents,
             'tip_cents', t.tip_cents,
             'ticket', t.ticket,
             'waiter_name', t.waiter_name) as payload
      from public.pay_tabs t
     where p_kind = 'visits'
       and t.place_id = p_place_id and t.livemode = p_livemode
       and (
         (t.status = 'paid' and (t.origin <> 'guest' or t.verified_at is not null))
         or (t.status in ('waiting_bill', 'billed', 'paying') and t.origin <> 'guest')
       )
    union all
    select p.id, p.paid_at, 0, p.consumer_id, null::uuid,
           p.amount_cents,
           jsonb_build_object(
             'status', p.status,
             'voucher', p.voucher,
             'amount_cents', p.amount_cents,
             'bonus_cents', p.bonus_cents,
             'refunded_cents', p.refunded_cents)
      from public.wallet_purchases p
     where p_kind = 'vouchers'
       and p.place_id = p_place_id and p.livemode = p_livemode and p.paid_at is not null
    union all
    select g.id, g.created_at, 0, g.sender_id, g.recipient_id, g.amount_cents,
           jsonb_build_object(
             'status', g.status,
             'amount_cents', g.amount_cents,
             'currency', g.currency)
      from public.wallet_gifts g
     where p_kind = 'gifts'
       and g.place_id = p_place_id and g.livemode = p_livemode
  ), today as (
    select (now() at time zone v_tz)::date as d
  ), recent as (
    select b.*
      from base b
      cross join today
     where (b.at at time zone v_tz)::date between today.d - 29 and today.d
  ), days as (
    select (today.d - n)::date as day
      from today, generate_series(0, 29) n
  ), chart as (
    select days.day,
           count(b.id) as count,
           coalesce(sum(b.chart_cents), 0) as amount_cents
      from days
      left join recent b on (b.at at time zone v_tz)::date = days.day
     group by days.day
  ), page as (
    select b.*
      from base b
     where p_before is null
        or b.rank > v_rank
        or (b.rank = v_rank and b.at < p_before)
        or (p_before_id is not null and b.rank = v_rank and b.at = p_before and b.id < p_before_id)
     order by b.rank, b.at desc, b.id desc
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
    (select coalesce(jsonb_agg(jsonb_build_object(
              'day', chart.day, 'count', chart.count, 'amount_cents', chart.amount_cents)
              order by chart.day), '[]'::jsonb) from chart),
    case p_kind
      when 'visits' then (
        select jsonb_build_object(
          'visits', count(*),
          'guests', count(distinct consumer_id),
          'open', count(*) filter (where (payload ->> 'open')::boolean),
          'paid_cents', coalesce(sum(chart_cents) filter (where payload ->> 'status' = 'paid'), 0))
          from recent)
      when 'vouchers' then (
        select jsonb_build_object(
          'vouchers', count(*),
          'guests', count(distinct consumer_id),
          'paid_cents', coalesce(sum((payload ->> 'amount_cents')::bigint - (payload ->> 'refunded_cents')::bigint), 0),
          'bonus_cents', coalesce(sum((payload ->> 'bonus_cents')::bigint), 0),
          'refunded_cents', coalesce(sum((payload ->> 'refunded_cents')::bigint), 0))
          from recent)
      else (
        select jsonb_build_object(
          'gifts', count(*),
          'open', count(*) filter (where payload ->> 'status' = 'open'),
          'claimed', count(*) filter (where payload ->> 'status' = 'claimed'),
          'taken_back', count(*) filter (where payload ->> 'status' = 'taken_back'),
          'open_cents', coalesce(sum(chart_cents) filter (where payload ->> 'status' = 'open'), 0),
          'claimed_cents', coalesce(sum(chart_cents) filter (where payload ->> 'status' = 'claimed'), 0))
          from recent)
    end,
    (select coalesce(jsonb_agg(jsonb_build_object(
              'id', id, 'at', at, 'rank', rank,
              'guest_name', guest_name, 'guest_email', guest_email,
              'other_name', other_name, 'other_email', other_email)
              || payload
              order by rank, at desc, id desc) filter (where n <= 50), '[]'::jsonb) from named),
    (select jsonb_build_object('rank', x.rank, 'created_at', x.at, 'id', x.id)
       from named x where x.n = 50 and exists (select 1 from named y where y.n = 51))
    into v_days, v_totals, v_rows, v_next;

  return jsonb_build_object(
    'kind', p_kind,
    'timezone', v_tz,
    'days', v_days,
    'totals', v_totals,
    'rows', v_rows,
    'next', v_next);
end;
$function$;

-- 2b. Business › Monitor lists: no stories kind, no story links.
create or replace function public.place_monitor_list(
  p_place_id uuid,
  p_livemode boolean,
  p_kind text,
  p_customer text default null,
  p_id uuid default null,
  p_before jsonb default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
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
    -- Visits: the same bills today's desk lists (MESITA-4487).
    select t.id, coalesce(t.paid_at, t.created_at) as at, 0 as rank,
           t.consumer_id, null::uuid as other_id,
           jsonb_build_object(
             'status', t.status,
             'bill_cents', t.bill_cents,
             'tip_cents', t.tip_cents,
             'ticket', t.ticket,
             'waiter_name', t.waiter_name) as payload,
           coalesce((select jsonb_agg(jsonb_build_object('kind', 'payment', 'id', p.id) order by p.created_at)
                       from public.wallet_payments p
                      where p.tab_id = t.id and p.paid_at is not null), '[]'::jsonb) as links
      from public.pay_tabs t
     where p_kind = 'visits'
       and t.place_id = p_place_id and t.livemode = p_livemode
       and (
         (t.status = 'paid' and (t.origin <> 'guest' or t.verified_at is not null))
         or (t.status in ('waiting_bill', 'billed', 'paying') and t.origin <> 'guest')
       )
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
    -- Payments: every bill paid with Mesita, card, credit or cash (outside).
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
    union all
    -- Credits: every wallet_entries row, the ledger itself.
    select e.id, e.created_at, 0, e.consumer_id,
           case e.kind when 'gift_out' then g.recipient_id
                       when 'gift_in' then g.sender_id
                       when 'gift_back' then g.recipient_id end,
           jsonb_build_object(
             'kind', e.kind,
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
$function$;

-- 2c. Business › Monitor customers: seen through bills, payments, vouchers
--     and credits (every Story had a paid voucher row).
create or replace function public.place_customers(
  p_place_id uuid,
  p_livemode boolean,
  p_customer text default null,
  p_before jsonb default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_owed bigint := (p_before ->> 'owed')::bigint;
  v_seen timestamptz := (p_before ->> 'last_seen')::timestamptz;
  v_key text := p_before ->> 'key';
  v_count integer;
  v_total bigint;
  v_rows jsonb;
  v_next jsonb;
begin
  with seen as (
    select t.consumer_id, coalesce(t.paid_at, t.created_at) as at
      from public.pay_tabs t
     where t.place_id = p_place_id and t.livemode = p_livemode and t.consumer_id is not null
    union all
    select p.consumer_id, coalesce(p.paid_at, p.created_at)
      from public.wallet_payments p
     where p.place_id = p_place_id and p.livemode = p_livemode and p.consumer_id is not null and p.paid_at is not null
    union all
    select v.consumer_id, v.paid_at
      from public.wallet_purchases v
     where v.place_id = p_place_id and v.livemode = p_livemode and v.consumer_id is not null and v.paid_at is not null
    union all
    select e.consumer_id, e.created_at
      from public.wallet_entries e
     where e.place_id = p_place_id and e.livemode = p_livemode and e.consumer_id is not null
  ), people as (
    select s.consumer_id,
           public.place_customer_key(p_place_id, s.consumer_id) as key,
           max(s.at) as last_seen,
           coalesce((select sum(e.amount_cents)
                       from public.wallet_entries e
                      where e.place_id = p_place_id and e.livemode = p_livemode
                        and e.consumer_id = s.consumer_id), 0)::bigint as owed
      from seen s
     group by s.consumer_id
  )
  select count(*), coalesce(sum(owed), 0)
    into v_count, v_total
    from people;

  with seen as (
    select t.consumer_id, coalesce(t.paid_at, t.created_at) as at
      from public.pay_tabs t
     where t.place_id = p_place_id and t.livemode = p_livemode and t.consumer_id is not null
    union all
    select p.consumer_id, coalesce(p.paid_at, p.created_at)
      from public.wallet_payments p
     where p.place_id = p_place_id and p.livemode = p_livemode and p.consumer_id is not null and p.paid_at is not null
    union all
    select v.consumer_id, v.paid_at
      from public.wallet_purchases v
     where v.place_id = p_place_id and v.livemode = p_livemode and v.consumer_id is not null and v.paid_at is not null
    union all
    select e.consumer_id, e.created_at
      from public.wallet_entries e
     where e.place_id = p_place_id and e.livemode = p_livemode and e.consumer_id is not null
  ), people as (
    select s.consumer_id,
           public.place_customer_key(p_place_id, s.consumer_id) as key,
           max(s.at) as last_seen,
           coalesce((select sum(e.amount_cents)
                       from public.wallet_entries e
                      where e.place_id = p_place_id and e.livemode = p_livemode
                        and e.consumer_id = s.consumer_id), 0)::bigint as owed
      from seen s
     group by s.consumer_id
  ), page as (
    select p.*
      from people p
     where (p_customer is null or p.key = p_customer)
       and (p_before is null
            or p.owed < v_owed
            or (p.owed = v_owed and (p.last_seen, p.key) < (v_seen, v_key)))
     order by p.owed desc, p.last_seen desc, p.key desc
     limit 51
  ), named as (
    select page.*,
           row_number() over (order by page.owed desc, page.last_seen desc, page.key desc) as n,
           coalesce(nullif(btrim(c.full_name), ''), nullif(btrim(c.first_name), '')) as guest_name,
           u.email as guest_email
      from page
      left join public.consumers c on c.id = page.consumer_id
      left join auth.users u on u.id = page.consumer_id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'customer', n.key,
      'owed_cents', n.owed,
      'last_seen', n.last_seen,
      'guest_name', n.guest_name,
      'guest_email', n.guest_email,
      'face', public.place_guest_face(n.consumer_id)
    ) order by n.n) filter (where n.n <= 50), '[]'::jsonb),
    (select jsonb_build_object('owed', x.owed, 'last_seen', x.last_seen, 'key', x.key)
       from named x where x.n = 50 and exists (select 1 from named y where y.n = 51))
    into v_rows, v_next
    from named n;

  return jsonb_build_object('count', v_count, 'owed_cents', v_total, 'rows', v_rows, 'next', v_next);
end;
$function$;

-- 2d. Crediting a paid purchase: no Story record is born (story_create is
--     dropped below).
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

  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  v_kind := case when v.voucher is null then 'prepay' else 'voucher' end;
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, least(v_at, now()));
  -- A retired Story purchase (MESITA-4642) earned its bonus only through a
  -- verified story; one paid now gets what the guest paid, never the bonus.
  if v.bonus_cents > 0 and v.voucher is distinct from 'voucher_story' then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;

-- 2e. Refunds: the open-Story void is gone (no open Story exists, step 1).
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
  v_story boolean;
  v_voucher_held boolean;
  v_bonus_held integer := 0;
  v_story_void integer := 0;
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

  -- What should be gone in total once this refund is applied, minus what is
  -- already gone. A STORY counts only what its ledger holds (MESITA-4264):
  -- kept after MESITA-4642 so a refund or lost dispute of a historical Story
  -- purchase never reverses a bonus that was never credited.
  v_story := v.voucher = 'voucher_story';
  if v_story then
    v_voucher_held := exists (select 1 from public.wallet_entries where purchase_id = v.id and kind = 'voucher');
    select coalesce(sum(amount_cents), 0) into v_bonus_held from public.wallet_entries
     where purchase_id = v.id and kind = 'bonus';
    select coalesce(-sum(amount_cents), 0) into v_story_void from public.wallet_entries
     where purchase_id = v.id and kind = 'reversal' and reason = 'story_void';
    v_target := (case when v_voucher_held then v_new_refunded else 0 end)
      + (greatest(v_bonus_held - v_story_void, 0) * v_new_refunded) / v.amount_cents
      + v_story_void;
  else
    v_target := v_new_refunded + (v.bonus_cents * v_new_refunded) / v.amount_cents;
  end if;
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

-- 3a. Triggers on the Story tables, if any are left.
do $$
declare
  t record;
begin
  for t in
    select tg.tgname, tg.tgrelid::regclass as rel
      from pg_trigger tg
     where not tg.tgisinternal
       and tg.tgrelid in (
         select c.oid from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname in ('stories', 'story_mentions'))
  loop
    execute format('drop trigger if exists %I on %s', t.tgname, t.rel);
  end loop;
end;
$$;

-- 3b. Every Story function, whatever its signature today (found by name).
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = any (array[
         'money_config_merge_story',
         'stories_move_legacy',
         'story_ai_candidates', 'story_ai_claim', 'story_ai_desk_sweep', 'story_ai_fail',
         'story_ai_media_due', 'story_ai_probe_due', 'story_ai_stale_sweep',
         'story_ai_unclaim', 'story_ai_verdict',
         'story_bind', 'story_bind_handle', 'story_claim', 'story_create', 'story_detect',
         'story_drop', 'story_emulator_on', 'story_expire_one', 'story_expire_sweep',
         'story_norm', 'story_post_window_for', 'story_review', 'story_review_open',
         'story_rules', 'story_settle', 'story_settle_emulated_due', 'story_wait_for',
         'wallet_activate_story', 'wallet_expire_stories', 'wallet_override_story',
         'wallet_purge_story_mentions', 'wallet_record_story_mention',
         'wallet_review_story', 'wallet_settle_story_recheck'])
  loop
    execute format('drop function if exists %s', f.sig);
  end loop;
end;
$$;

-- 3c. The Story config: money_config's story_* keys, the Story bot's model.
update public.app_config
   set money_config = (
         select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
           from jsonb_each(money_config) e
          where e.key not like 'story\_%')
 where id = 1 and jsonb_typeof(money_config) = 'object'
   and exists (select 1 from jsonb_object_keys(money_config) k where k like 'story\_%');

update public.app_config
   set models_config = models_config - 'stories'
 where id = 1 and jsonb_typeof(models_config) = 'object' and models_config ? 'stories';

-- 3d. The recheck cron, in case it was ever re-created after MESITA-4641.
select cron.unschedule(jobid) from cron.job where jobname = 'recheck-stories';

-- Post-flight: no Story function is left, and no function still calls one.
do $$
declare
  v text;
begin
  select p.proname into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proname like 'story\_%' or p.proname like 'stories\_%'
          or p.proname in ('money_config_merge_story', 'wallet_override_story',
                           'wallet_purge_story_mentions', 'wallet_record_story_mention',
                           'wallet_settle_story_recheck'))
   limit 1;
  if found then
    raise exception 'stories_backend_gone: function % is still here', v;
  end if;
  select p.proname into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prosrc ~ '\m(story_(create|bind|bind_handle|claim|settle|rules|review|drop|detect|norm|wait_for|post_window_for|expire_one|expire_sweep|emulator_on|settle_emulated_due|ai_[a-z_]+)|wallet_override_story|money_config_merge_story)\s*\('
   limit 1;
  if found then
    raise exception 'stories_backend_gone: function % still calls a Story function', v;
  end if;
end;
$$;
