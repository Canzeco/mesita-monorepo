-- MESITA-4487: Business Operations lists and analyzes the place's tickets.
--
-- Pato, 2026-11-20: Operations shows Views, Visits, Vouchers (prepayments),
-- Stories (in case of verification) and Gifts, and each page displays the
-- tickets and analyzes them. Views already has its own chart. This is the
-- other four, one read, service role only.
--
-- A visit ticket is the consumer rule: a paid tab, and a guest's own bill
-- only after the waiter Verified it; a waiter's bill still open counts too.
-- A voucher ticket is a purchase that was paid. A Story ticket is the Story
-- row. A gift ticket is a wallet_gifts link at this place. The chart is the
-- last 30 days in the place's timezone, empty days included. The log is 50
-- rows before a (rank, created_at, id) cursor. Stories sort a posted story
-- that nobody has looked at (found) first.

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
  if p_kind not in ('visits', 'vouchers', 'stories', 'gifts') then
    raise exception 'place_ticket_desk: kind must be visits, vouchers, stories or gifts';
  end if;

  with base as (
    select t.id,
           coalesce(t.paid_at, t.created_at) as at,
           0 as rank,
           t.consumer_id,
           null::uuid as other_id,
           coalesce(t.bill_cents, 0) + t.tip_cents as chart_cents,
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
    select s.id, s.created_at,
           case s.state when 'found' then 0 when 'waiting_post' then 1 when 'approved' then 2 else 3 end,
           s.consumer_id, null::uuid,
           case when s.state = 'released' then s.bonus_cents else 0 end,
           jsonb_build_object(
             'state', s.state,
             'void_reason', s.void_reason,
             'bonus_cents', s.bonus_cents,
             'deadline_at', s.deadline_at)
      from public.stories s
     where p_kind = 'stories'
       and s.place_id = p_place_id and s.livemode = p_livemode
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
  ), days as (
    select (today.d - n)::date as day
      from today, generate_series(0, 29) n
  ), chart as (
    select days.day,
           count(b.id) as count,
           coalesce(sum(b.chart_cents), 0) as amount_cents
      from days
      left join base b on (b.at at time zone v_tz)::date = days.day
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
          from base)
      when 'vouchers' then (
        select jsonb_build_object(
          'vouchers', count(*),
          'guests', count(distinct consumer_id),
          'paid_cents', coalesce(sum((payload ->> 'amount_cents')::bigint - (payload ->> 'refunded_cents')::bigint), 0),
          'bonus_cents', coalesce(sum((payload ->> 'bonus_cents')::bigint), 0),
          'refunded_cents', coalesce(sum((payload ->> 'refunded_cents')::bigint), 0))
          from base)
      when 'stories' then (
        select jsonb_build_object(
          'stories', count(*),
          'needs_look', count(*) filter (where payload ->> 'state' = 'found'),
          'waiting_post', count(*) filter (where payload ->> 'state' = 'waiting_post'),
          'approved', count(*) filter (where payload ->> 'state' = 'approved'),
          'released', count(*) filter (where payload ->> 'state' = 'released'),
          'void', count(*) filter (where payload ->> 'state' = 'void'),
          'bonus_released_cents', coalesce(sum((payload ->> 'bonus_cents')::bigint) filter (where payload ->> 'state' = 'released'), 0))
          from base)
      else (
        select jsonb_build_object(
          'gifts', count(*),
          'open', count(*) filter (where payload ->> 'status' = 'open'),
          'claimed', count(*) filter (where payload ->> 'status' = 'claimed'),
          'taken_back', count(*) filter (where payload ->> 'status' = 'taken_back'),
          'open_cents', coalesce(sum(chart_cents) filter (where payload ->> 'status' = 'open'), 0),
          'claimed_cents', coalesce(sum(chart_cents) filter (where payload ->> 'status' = 'claimed'), 0))
          from base)
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
    'days', v_days,
    'totals', v_totals,
    'rows', v_rows,
    'next', v_next);
end;
$function$;

revoke all on function public.place_ticket_desk(uuid, text, boolean, text, timestamptz, uuid, integer) from public, anon, authenticated;
grant execute on function public.place_ticket_desk(uuid, text, boolean, text, timestamptz, uuid, integer) to service_role;

comment on function public.place_ticket_desk(uuid, text, boolean, text, timestamptz, uuid, integer) is
  'MESITA-4487: one place''s ticket desk in one universe. kind is visits, vouchers, stories or gifts. Returns 30 local days (count and cents), all-time totals, and 50 rows before the (rank, created_at, id) cursor, with the guest''s name and email for the EF to mask. A visit is a paid tab (a guest bill only after Verify) or a waiter''s open bill. Stories with state found sort first. Service role only.';
