-- MESITA-4703 — Business › Visits shows each bill's cashback (Pato,
-- 2026-11-22: "Visits (this table) (credits or cash, but never mesita pay,
-- mesita pay only for vouchers)"). place_monitor_list's visits rows carry
-- cashback_cents: the wallet_entries kind 'cashback' written on that bill
-- (MESITA-4698), 0 when none. Everything else is as 20261122240000 defined it.

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

