-- MESITA-4682 (Pato: "The customers page must actually be a table … SOMEONE
-- BECOMES YOUR CUSTOMER IF THEY HAVE CREDIT WITH YOU (EVEN IF GIFTED) … IF
-- THEY HAVE SAVED YOUR PLACE BUT HAVEN'T VISITED YET"; "visits too, express
-- them in one table"; "so we have payments and we have payouts").
--
-- 1. place_visit_rows: the one rule for which bills are Visits (the desk's
--    bills, MESITA-4487). Visits, Customers' visit counts and the Visits
--    analytics all read it.
-- 2. place_monitor_list: Visits carries how each bill was settled from the
--    bill row (card, credit, outside = cash or the place's own terminal) and
--    marks split tables; Payments lists card charges only.
-- 3. place_customers: a customer is a guest with any money row here (gifted
--    credit included) or a save of the place (quiet saves excluded: they
--    were promised to stay in the browser; closed accounts excluded). Each
--    row on the page adds saved, visits, spent (net of refunds, split tables
--    never counted twice) and vouchers. Saves have no livemode: savers show
--    in both modes.

create or replace function public.place_visit_rows(p_place_id uuid, p_livemode boolean)
returns table (
  id uuid,
  consumer_id uuid,
  at timestamptz,
  status text,
  bill_cents integer,
  tip_cents integer,
  credit_cents integer,
  cash_bill_cents integer,
  cash_tip_cents integer,
  card_bill_cents integer,
  card_tip_cents integer,
  ticket text,
  waiter_name text,
  parent_tab_id uuid,
  split_at timestamptz,
  shares integer,
  shares_total_cents bigint,
  refunded_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.consumer_id, coalesce(t.paid_at, t.created_at),
         t.status, t.bill_cents, t.tip_cents,
         coalesce(t.credit_cents, 0), coalesce(t.cash_bill_cents, 0), coalesce(t.cash_tip_cents, 0),
         coalesce(t.card_bill_cents, 0), coalesce(t.card_tip_cents, 0),
         t.ticket, t.waiter_name, t.parent_tab_id, t.split_at,
         (select count(*)::int from public.pay_tabs s where s.parent_tab_id = t.id),
         (select coalesce(sum(coalesce(s.bill_cents, 0) + coalesce(s.tip_cents, 0)), 0)::bigint
            from public.pay_tabs s where s.parent_tab_id = t.id and s.status = 'paid'),
         (select coalesce(sum(p.refunded_cents + p.credit_refunded_cents), 0)::bigint
            from public.wallet_payments p where p.tab_id = t.id and p.paid_at is not null)
    from public.pay_tabs t
   where t.place_id = p_place_id and t.livemode = p_livemode
     and (
       (t.status = 'paid' and (t.origin <> 'guest' or t.verified_at is not null))
       or (t.status in ('waiting_bill', 'billed', 'paying') and t.origin <> 'guest')
     )
$$;

comment on function public.place_visit_rows(uuid, boolean) is
  'MESITA-4682: the one rule for which bills are Business Visits (paid, guest-opened only once verified; open bills only when staff opened them), with settlement, split shares and refunds. service_role only.';

revoke execute on function public.place_visit_rows(uuid, boolean) from public, anon, authenticated;
grant execute on function public.place_visit_rows(uuid, boolean) to service_role;

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
    -- Visits: the bills place_visit_rows keeps (MESITA-4682), with how each
    -- was settled read from the bill row itself; a split table carries its
    -- shares' total and count, and its shares are rows of their own.
    select t.id, t.at, 0 as rank,
           t.consumer_id, null::uuid as other_id,
           jsonb_build_object(
             'status', t.status,
             'bill_cents', t.bill_cents,
             'tip_cents', t.tip_cents,
             'card_cents', t.card_bill_cents + t.card_tip_cents,
             'credit_cents', t.credit_cents,
             'outside_cents', t.cash_bill_cents + t.cash_tip_cents,
             'split', t.split_at is not null,
             'shares', t.shares,
             'shares_total_cents', t.shares_total_cents,
             'share', t.parent_tab_id is not null,
             'ticket', t.ticket,
             'waiter_name', t.waiter_name) as payload,
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
    union all
    -- A save of the place makes a customer before any visit (MESITA-4682).
    select a.consumer_id, a.created_at
      from public.place_activity a
      join public.consumers c on c.id = a.consumer_id and c.deleted_at is null
     where a.place_id = p_place_id and a.kind = 'saved' and not a.quiet
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
  ), totals as (
    select count(*)::int as n, coalesce(sum(owed), 0)::bigint as owed from people
  ), page as (
    select p.*
      from people p
     where (p_customer is null or p.key = p_customer)
       and (p_before is null
            or p.owed < v_owed
            or (p.owed = v_owed and (p.last_seen, p.key) < (v_seen, v_key)))
     order by p.owed desc, p.last_seen desc, p.key desc
     limit 51
  ), visits as (
    select * from public.place_visit_rows(p_place_id, p_livemode)
  ), named as (
    select page.*,
           row_number() over (order by page.owed desc, page.last_seen desc, page.key desc) as n,
           coalesce(nullif(btrim(c.full_name), ''), nullif(btrim(c.first_name), '')) as guest_name,
           u.email as guest_email,
           exists (select 1 from public.place_activity a
                    where a.place_id = p_place_id and a.consumer_id = page.consumer_id
                      and a.kind = 'saved' and not a.quiet) as saved,
           -- A split table is never a visit: its shares are (MESITA-4682).
           (select count(*)::int from visits v
             where v.consumer_id = page.consumer_id and v.status = 'paid' and v.split_at is null) as visit_count,
           (select coalesce(sum(coalesce(v.bill_cents, 0) + coalesce(v.tip_cents, 0) - v.refunded_cents), 0)::bigint
              from visits v
             where v.consumer_id = page.consumer_id and v.status = 'paid' and v.split_at is null) as spent,
           (select count(*)::int from public.wallet_purchases w
             where w.place_id = p_place_id and w.livemode = p_livemode and w.consumer_id = page.consumer_id
               and w.paid_at is not null and w.status <> 'refunded') as vouchers
      from page
      left join public.consumers c on c.id = page.consumer_id
      left join auth.users u on u.id = page.consumer_id
  )
  select
    (select n from totals),
    (select owed from totals),
    coalesce(jsonb_agg(jsonb_build_object(
      'customer', n.key,
      'owed_cents', n.owed,
      'last_seen', n.last_seen,
      'guest_name', n.guest_name,
      'guest_email', n.guest_email,
      'face', public.place_guest_face(n.consumer_id),
      'saved', n.saved,
      'visits', n.visit_count,
      'spent_cents', greatest(n.spent, 0),
      'vouchers', n.vouchers
    ) order by n.n) filter (where n.n <= 50), '[]'::jsonb),
    (select jsonb_build_object('owed', x.owed, 'last_seen', x.last_seen, 'key', x.key)
       from named x where x.n = 50 and exists (select 1 from named y where y.n = 51))
    into v_count, v_total, v_rows, v_next
    from named n;

  return jsonb_build_object('count', v_count, 'owed_cents', v_total, 'rows', v_rows, 'next', v_next);
end;
$function$;
