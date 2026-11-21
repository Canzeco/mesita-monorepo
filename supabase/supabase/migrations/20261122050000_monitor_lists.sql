-- MESITA-4538: Business Monitor is plain linked lists (Pato, 2026-11-21:
-- "REMOVE THE STUPID ANALYTICS … JUST DISPLAY LISTS … the lists have ids
-- and those ids redirect to other tickets across the Monitor subpages").
--
-- place_monitor_list(kind): one page of visits, vouchers, payments, credits
-- (wallet_entries, the credit ledger) or stories at one place in one
-- universe, newest first, each row with the ids of the rows it relates to.
-- place_customers: one row per guest with any money row at the place, what
-- the place owes them, and when they were last seen.
-- place_views_log gains an optional customer filter.
--
-- A guest is named to the place by a per-place key, md5(place_id:consumer_id),
-- never by their member id (MESITA-3213: the member id stops at the server).

create or replace function public.place_customer_key(p_place_id uuid, p_consumer_id uuid)
returns text
language sql
immutable
set search_path = public
as $$
  select case when p_consumer_id is null then null
              else md5(p_place_id::text || ':' || p_consumer_id::text) end
$$;

comment on function public.place_customer_key(uuid, uuid) is
  'MESITA-4538: the key a place sees for one of its guests. Stable per place, not reversible to the member id. service_role only.';

revoke execute on function public.place_customer_key(uuid, uuid) from public, anon, authenticated;
grant execute on function public.place_customer_key(uuid, uuid) to service_role;

-- ── place_monitor_list ─────────────────────────────────────────────────────
-- Row shape: { id, at, rank, customer, other_customer, payload, links,
--              guest_name, guest_email, other_name, other_email }
-- links: [{ kind: visit|payment|voucher|credit|story, id }]
-- Cursor: { rank, at, id }; order rank, at desc, id desc; 50 per page.
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
  if p_kind not in ('visits', 'vouchers', 'payments', 'credits', 'stories') then
    raise exception 'place_monitor_list: kind must be visits, vouchers, payments, credits or stories';
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
           || coalesce((select jsonb_agg(jsonb_build_object('kind', 'story', 'id', s.id))
                          from public.stories s where s.purchase_id = v.id), '[]'::jsonb)
      from public.wallet_purchases v
     where p_kind = 'vouchers'
       and v.place_id = p_place_id and v.livemode = p_livemode and v.paid_at is not null
    union all
    -- Payments: bills paid with Mesita (card, credit or outside parts).
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
             'story', st.id is not null),
           (case when e.purchase_id is not null then jsonb_build_array(jsonb_build_object('kind', 'voucher', 'id', e.purchase_id)) else '[]'::jsonb end)
           || (case when e.payment_id is not null then jsonb_build_array(jsonb_build_object('kind', 'payment', 'id', e.payment_id)) else '[]'::jsonb end)
           || (case when st.id is not null and e.kind = 'bonus' then jsonb_build_array(jsonb_build_object('kind', 'story', 'id', st.id)) else '[]'::jsonb end)
      from public.wallet_entries e
      left join public.wallet_gifts g on g.id = e.gift_id
      left join public.stories st on st.purchase_id = e.purchase_id
     where p_kind = 'credits'
       and e.place_id = p_place_id and e.livemode = p_livemode
    union all
    -- Stories: a posted story nobody has looked at comes first, as today.
    select s.id, s.created_at,
           case s.state when 'found' then 0 else 1 end,
           s.consumer_id, null::uuid,
           jsonb_build_object(
             'state', s.state,
             'void_reason', s.void_reason,
             'bonus_cents', s.bonus_cents,
             'deadline_at', s.deadline_at),
           (case when s.purchase_id is not null then jsonb_build_array(jsonb_build_object('kind', 'voucher', 'id', s.purchase_id)) else '[]'::jsonb end)
           || coalesce((select jsonb_agg(jsonb_build_object('kind', 'credit', 'id', e.id))
                          from public.wallet_entries e
                         where e.purchase_id = s.purchase_id and e.kind = 'bonus' and s.state = 'released'), '[]'::jsonb)
      from public.stories s
     where p_kind = 'stories'
       and s.place_id = p_place_id and s.livemode = p_livemode
  ), filtered as (
    select b.*
      from base b
     where (p_id is null or b.id = p_id)
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

comment on function public.place_monitor_list(uuid, boolean, text, text, uuid, jsonb) is
  'MESITA-4538: one page of a Business Monitor list (visits, vouchers, payments, credits, stories) with related row ids. Guests are per-place keys; names and emails go to the EF to mask. service_role only.';

revoke execute on function public.place_monitor_list(uuid, boolean, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.place_monitor_list(uuid, boolean, text, text, uuid, jsonb) to service_role;

-- ── place_customers ────────────────────────────────────────────────────────
-- One row per guest with a visit, payment, voucher, credit entry or story at
-- the place in this universe. owed = the sum of their wallet_entries here
-- (pending included, as wallet_balances). Order owed desc, last_seen desc, key.
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
    select s.consumer_id, s.created_at
      from public.stories s
     where s.place_id = p_place_id and s.livemode = p_livemode and s.consumer_id is not null
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
    union all
    select s.consumer_id, s.created_at
      from public.stories s
     where s.place_id = p_place_id and s.livemode = p_livemode and s.consumer_id is not null
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
      'guest_email', n.guest_email
    ) order by n.n) filter (where n.n <= 50), '[]'::jsonb),
    (select jsonb_build_object('owed', x.owed, 'last_seen', x.last_seen, 'key', x.key)
       from named x where x.n = 50 and exists (select 1 from named y where y.n = 51))
    into v_rows, v_next
    from named n;

  return jsonb_build_object('count', v_count, 'owed_cents', v_total, 'rows', v_rows, 'next', v_next);
end;
$function$;

comment on function public.place_customers(uuid, boolean, text, jsonb) is
  'MESITA-4538: Business Monitor › Customers. Guests with any money row at the place in this universe, what the place owes each (sum of their wallet_entries), last seen; plus the count and the total owed. service_role only.';

revoke execute on function public.place_customers(uuid, boolean, text, jsonb) from public, anon, authenticated;
grant execute on function public.place_customers(uuid, boolean, text, jsonb) to service_role;

-- ── place_views_log: optional customer filter, customer key out ────────────
drop function public.place_views_log(uuid, timestamptz, integer);

create function public.place_views_log(
  p_place_id uuid,
  p_before timestamptz default null,
  p_limit integer default 31,
  p_customer text default null
) returns table (
  consumer_id uuid,
  kind text,
  created_at timestamptz,
  first_name text,
  avatar_url text,
  instagram_handle text,
  instagram_followers_count integer,
  guest_class text,
  plan text,
  anonymous boolean,
  instagram boolean,
  customer text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.consumer_id, e.kind, e.created_at,
         c.first_name,
         case when v.shown then c.avatar_url end,
         case when v.named then c.instagram_handle end,
         case when v.named then c.instagram_followers_count end,
         c.guest_class,
         c.plan,
         not v.named,
         v.shown
           and c.instagram_handle is not null
           and c.instagram_verified_at is not null,
         public.place_customer_key(p_place_id, e.consumer_id)
    from public.place_views_events(p_place_id) e
    join public.consumers c on c.id = e.consumer_id
    cross join lateral (
      select public.place_activity_visible(c) as named,
             not c.appear_anonymous as shown
    ) v
   where (p_before is null or e.created_at < p_before)
     and (p_customer is null or public.place_customer_key(p_place_id, e.consumer_id) = p_customer)
   order by e.created_at desc, e.kind
   limit least(greatest(p_limit, 1), 200)
$$;

comment on function public.place_views_log(uuid, timestamptz, integer, text) is
  'MESITA-3213: Business Views'' log, newest first. Who is named follows place_activity_feed. MESITA-4538: the per-place customer key out, an optional customer filter in. service_role only.';

revoke execute on function public.place_views_log(uuid, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.place_views_log(uuid, timestamptz, integer, text) to service_role;
