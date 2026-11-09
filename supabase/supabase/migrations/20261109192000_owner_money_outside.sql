-- MESITA-3548 — Payments Flow v2, step D: the owner's view counts the cash
-- side (MESITA-3541). place_money_summary (MESITA-3307) learns outside bills:
-- the waiter's code (MESITA-3545) and Pay at the table (pay_tabs, MESITA-3559).
--
--   received_cents   card parts net of card refunds PLUS outside parts (the
--                    cash the waiter marked Received). An outside bill an
--                    operator refunded (wallet_refund_outside: status
--                    refunded or needs_review) counts 0: that refund says the
--                    Received should not have happened. refunded_cents stays
--                    0 on outside rows (only the credit part comes back, as
--                    credit_refunded_cents), so the card arithmetic is
--                    unchanged.
--   tips_cents       tips paid by card only. An outside row's tip was cash
--                    collected in person: never counted.
--   rows[]           each payment row adds confirmed_by (stripe · waiter ·
--                    credit), outside_cents, charge_amount_cents (the
--                    waiter's bill), tab_id, part (credit · outside · card),
--                    cashback_cents and outside_cashback_bps (so the page can
--                    tell a cashback the daily ceiling cut). Vouchers answer
--                    null or 0.
--   received_share   {received, total}: over the window, the paid bills with
--                    a waiter's bill (a charge or a tab; a tab's rows count
--                    once) and how many of them ended in a waiter's Received
--                    (the cash-path usage metric, CEO F5).
--   outside_cashback_today_cents
--                    the place's outside cashback over the rolling day, the
--                    same sum wallet_confirm_outside caps (window-free).
--
-- The return stays jsonb, so create or replace keeps the signature and its
-- grants; they are restated anyway. The EF reads every new field by name with
-- a default, so the minutes between this and its redeploy are safe either way.

create or replace function public.place_money_summary(
  p_place_id uuid, p_from timestamptz, p_to timestamptz, p_livemode boolean,
  p_before timestamptz default null, p_before_id uuid default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_received bigint;
  v_fee bigint;
  v_tips bigint;
  v_available bigint;
  v_pending bigint;
  v_share jsonb;
  v_outside_today bigint;
  v_rows jsonb;
  v_next jsonb;
begin
  with pu as (
    select amount_cents - refunded_cents as received, application_fee_cents - fee_refunded_cents as fee, 0 as tips
      from public.wallet_purchases
     where place_id = p_place_id and livemode = p_livemode and paid_at is not null
       and created_at >= p_from and created_at < p_to
  ), py as (
    select card_cents - (refunded_cents - tip_refunded_cents)
             + case when outside_cents > 0 and status not in ('refunded', 'needs_review') then outside_cents else 0 end
             as received,
           application_fee_cents - fee_refunded_cents as fee,
           case when outside_cents > 0 or part = 'outside' then 0 else tip_cents - tip_refunded_cents end as tips
      from public.wallet_payments
     where place_id = p_place_id and livemode = p_livemode and paid_at is not null
       and created_at >= p_from and created_at < p_to
  ), al as (select * from pu union all select * from py)
  select coalesce(sum(received), 0), coalesce(sum(fee), 0), coalesce(sum(tips), 0)
    into v_received, v_fee, v_tips
    from al;

  select coalesce(sum(amount_cents) filter (where available_at <= now()), 0),
         coalesce(sum(amount_cents) filter (where available_at > now()), 0)
    into v_available, v_pending
    from public.wallet_entries
   where place_id = p_place_id and livemode = p_livemode;

  -- One bill per charge or tab: a tab's card row and outside row are one bill.
  with bills as (
    select coalesce(tab_id, id) as bill, bool_or(confirmed_by = 'waiter') as received
      from public.wallet_payments
     where place_id = p_place_id and livemode = p_livemode and paid_at is not null
       and (charge_amount_cents is not null or tab_id is not null)
       and created_at >= p_from and created_at < p_to
     group by coalesce(tab_id, id)
  )
  select jsonb_build_object('received', count(*) filter (where received), 'total', count(*))
    into v_share
    from bills;

  select coalesce(sum(cashback_cents), 0) into v_outside_today
    from public.wallet_payments
   where place_id = p_place_id and livemode = p_livemode and outside_cents > 0
     and paid_at is not null and paid_at > now() - interval '1 day';

  with r as (
    select 'voucher'::text as kind, p.id, p.created_at, p.paid_at, p.status, p.voucher, null::text as ticket,
           p.amount_cents as amount_cents, 0 as credit_cents, p.amount_cents as card_cents, 0 as tip_cents,
           p.refunded_cents, p.consumer_id,
           null::text as confirmed_by, 0 as outside_cents, null::integer as charge_amount_cents,
           null::uuid as tab_id, null::text as part, 0 as cashback_cents, 0 as outside_cashback_bps
      from public.wallet_purchases p
     where p.place_id = p_place_id and p.livemode = p_livemode and p.paid_at is not null
       and p.created_at >= p_from and p.created_at < p_to
    union all
    select 'payment'::text, y.id, y.created_at, y.paid_at, y.status, null::text, y.ticket,
           y.amount_cents + y.tip_cents, y.credit_cents, y.card_cents, y.tip_cents,
           y.refunded_cents + y.credit_refunded_cents, y.consumer_id,
           y.confirmed_by, y.outside_cents, y.charge_amount_cents,
           y.tab_id, y.part, y.cashback_cents, y.outside_cashback_bps
      from public.wallet_payments y
     where y.place_id = p_place_id and y.livemode = p_livemode and y.paid_at is not null
       and y.created_at >= p_from and y.created_at < p_to
  ), page as (
    select r.* from r
     where p_before is null
        or r.created_at < p_before
        or (p_before_id is not null and r.created_at = p_before and r.id < p_before_id)
     order by r.created_at desc, r.id desc
     limit 51
  ), named as (
    select page.*,
           row_number() over (order by page.created_at desc, page.id desc) as n,
           coalesce(nullif(btrim(c.full_name), ''), nullif(btrim(c.first_name), '')) as guest_name,
           u.email as guest_email
      from page
      left join public.consumers c on c.id = page.consumer_id
      left join auth.users u on u.id = page.consumer_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', kind, 'id', id, 'created_at', created_at, 'paid_at', paid_at, 'status', status,
           'voucher', voucher, 'ticket', ticket, 'amount_cents', amount_cents, 'credit_cents', credit_cents,
           'card_cents', card_cents, 'tip_cents', tip_cents, 'refunded_cents', refunded_cents,
           'confirmed_by', confirmed_by, 'outside_cents', outside_cents, 'charge_amount_cents', charge_amount_cents,
           'tab_id', tab_id, 'part', part, 'cashback_cents', cashback_cents,
           'outside_cashback_bps', outside_cashback_bps,
           'guest_name', guest_name, 'guest_email', guest_email)
           order by created_at desc, id desc) filter (where n <= 50), '[]'::jsonb),
         (select jsonb_build_object('created_at', x.created_at, 'id', x.id)
            from named x where x.n = 50 and exists (select 1 from named y where y.n = 51))
    into v_rows, v_next
    from named;

  return jsonb_build_object(
    'received_cents', v_received, 'fee_cents', v_fee, 'tips_cents', v_tips,
    'available_cents', v_available, 'pending_cents', v_pending,
    'received_share', v_share, 'outside_cashback_today_cents', v_outside_today,
    'rows', v_rows, 'next', v_next);
end;
$function$;

revoke all on function public.place_money_summary(uuid, timestamptz, timestamptz, boolean, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.place_money_summary(uuid, timestamptz, timestamptz, boolean, timestamptz, uuid) to service_role;

comment on function public.place_money_summary(uuid, timestamptz, timestamptz, boolean, timestamptz, uuid) is
  'MESITA-3307, MESITA-3548: one place''s money in one universe (p_livemode): money received (vouchers, card parts net of refunds, and outside parts the waiter marked Received unless refunded), Mesita''s fee net of fee refunds, card tips net of tip refunds (cash tips left out), credit outstanding (Available and Pending, now), received_share {received, total} over bills with a waiter''s bill (a tab counts once), the place''s outside cashback over the rolling day, and 50 paid rows newest first before the (created_at, id) cursor, each with its confirmer, outside part, waiter''s bill, tab and part, with the guest''s name and email for the EF to mask. Service role only.';
