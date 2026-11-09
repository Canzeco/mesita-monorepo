-- MESITA-3307 — W3: the owner's money on Business › Payments and the
-- operator's refunds, close-out and needs_review list in the admin console.
--
--   wallet_entries kind `refund`      a positive entry naming a payment: the
--                                     credit part of a payment the operator
--                                     refunded, given back as credit at once.
--   wallet_payments.credit_refunded_cents
--                                     how much of the credit part came back.
--   wallet_refund_credit(attempt)     the credit part's refund, keyed by its
--                                     wallet_refund_attempts row (no Stripe).
--   place_money_summary(...)          the owner's totals and 50 rows a page.
--   wallet_needs_review_list(...)     the operator's needs_review rows.
--
-- Additive: one column with a default, one kind added to the two entry
-- constraints, three new functions. The EFs deploy about five minutes after
-- this applies; nothing calls these until they do.

-- ── 1. The credit part's refund ────────────────────────────────────────────
alter table public.wallet_payments
  add column credit_refunded_cents integer not null default 0 check (credit_refunded_cents >= 0);

alter table public.wallet_payments add constraint wallet_payments_credit_refunded_within_credit_chk
  check (credit_refunded_cents <= credit_cents);

comment on column public.wallet_payments.credit_refunded_cents is
  'MESITA-3307: the part of credit_cents an operator refunded; each refund is a positive `refund` entry naming the payment, Available at once.';

alter table public.wallet_entries drop constraint wallet_entries_kind_chk;
alter table public.wallet_entries add constraint wallet_entries_kind_chk
  check (kind in ('prepay', 'voucher', 'bonus', 'cashback', 'spend', 'reversal', 'refund'));

alter table public.wallet_entries drop constraint wallet_entries_kind_shape_chk;
alter table public.wallet_entries add constraint wallet_entries_kind_shape_chk check (
  case kind
    when 'prepay' then amount_cents > 0 and purchase_id is not null and payment_id is null
    when 'voucher' then amount_cents > 0 and purchase_id is not null and payment_id is null
    when 'bonus' then amount_cents > 0 and purchase_id is not null and payment_id is null
    when 'cashback' then amount_cents > 0 and payment_id is not null and purchase_id is null
    when 'spend' then amount_cents < 0 and payment_id is not null and purchase_id is null
    when 'reversal' then amount_cents < 0 and (purchase_id is not null or payment_id is not null)
    when 'refund' then amount_cents > 0 and payment_id is not null and purchase_id is null
    else false
  end
);

-- The attempt row is the key: the EF inserts it (payment_id, amount), then
-- calls this. A pending attempt applies once and reads done; a done one
-- answers already_applied, so a retry after a timeout never credits twice.
-- The payment reads refunded once its card + tip and its credit part are all
-- back, partly_refunded before that; an uncovered row stays needs_review.
create or replace function public.wallet_refund_credit(p_attempt_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  a public.wallet_refund_attempts;
  v public.wallet_payments;
  v_new integer;
  v_status text;
begin
  select * into a from public.wallet_refund_attempts where id = p_attempt_id for update;
  if not found or a.payment_id is null then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if a.status = 'done' then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied');
  end if;
  if a.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'not_pending');
  end if;
  select * into v from public.wallet_payments where id = a.payment_id for update;
  if v.paid_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  if a.amount_cents > v.credit_cents - v.credit_refunded_cents then
    return jsonb_build_object('ok', false, 'code', 'above_refundable',
      'refundable_cents', v.credit_cents - v.credit_refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
  values (v.consumer_id, v.place_id, 'refund', a.amount_cents, v.currency, v.id, v.livemode, now());

  v_new := v.credit_refunded_cents + a.amount_cents;
  v_status := case
    when v.uncovered_cents > 0 then 'needs_review'
    when v_new >= v.credit_cents and v.refunded_cents >= v.card_cents + v.tip_cents then 'refunded'
    else 'partly_refunded'
  end;
  update public.wallet_payments
     set credit_refunded_cents = v_new, status = v_status, updated_at = now()
   where id = v.id;
  update public.wallet_refund_attempts set status = 'done', updated_at = now() where id = a.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'credit_refunded_cents', v_new, 'status', v_status);
end;
$function$;

revoke all on function public.wallet_refund_credit(uuid) from public, anon, authenticated;
grant execute on function public.wallet_refund_credit(uuid) to service_role;

comment on function public.wallet_refund_credit(uuid) is
  'MESITA-3307 Wallet (operator): applies one wallet_refund_attempts row against a payment''s credit part: a positive refund entry, Available at once, credit_refunded_cents grows, the row reads refunded once every part is back. No Stripe. Replay-safe by the attempt''s status. Service role only.';

-- ── 2. The owner's money ───────────────────────────────────────────────────
-- Paid rows only (paid_at set: a given-up needs_review row took no money).
-- Totals over created_at in [p_from, p_to): money received is voucher
-- purchases and card parts net of refunds; Mesita's fee net of what followed
-- refunds; tips net of tip refunds, apart from both. Credit outstanding is
-- the place's whole ledger now (Available and Pending), not the range.
-- Rows: 50 newest first before the (p_before, p_before_id) cursor; a tie on
-- created_at is broken by id, so equal timestamps page once each.
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
  v_rows jsonb;
  v_next jsonb;
begin
  with pu as (
    select amount_cents - refunded_cents as received, application_fee_cents - fee_refunded_cents as fee, 0 as tips
      from public.wallet_purchases
     where place_id = p_place_id and livemode = p_livemode and paid_at is not null
       and created_at >= p_from and created_at < p_to
  ), py as (
    select card_cents - (refunded_cents - tip_refunded_cents) as received,
           application_fee_cents - fee_refunded_cents as fee,
           tip_cents - tip_refunded_cents as tips
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

  with r as (
    select 'voucher'::text as kind, p.id, p.created_at, p.paid_at, p.status, p.voucher, null::text as ticket,
           p.amount_cents as amount_cents, 0 as credit_cents, p.amount_cents as card_cents, 0 as tip_cents,
           p.refunded_cents, p.consumer_id
      from public.wallet_purchases p
     where p.place_id = p_place_id and p.livemode = p_livemode and p.paid_at is not null
       and p.created_at >= p_from and p.created_at < p_to
    union all
    select 'payment'::text, y.id, y.created_at, y.paid_at, y.status, null::text, y.ticket,
           y.amount_cents + y.tip_cents, y.credit_cents, y.card_cents, y.tip_cents,
           y.refunded_cents + y.credit_refunded_cents, y.consumer_id
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
           'guest_name', guest_name, 'guest_email', guest_email)
           order by created_at desc, id desc) filter (where n <= 50), '[]'::jsonb),
         (select jsonb_build_object('created_at', x.created_at, 'id', x.id)
            from named x where x.n = 50 and exists (select 1 from named y where y.n = 51))
    into v_rows, v_next
    from named;

  return jsonb_build_object(
    'received_cents', v_received, 'fee_cents', v_fee, 'tips_cents', v_tips,
    'available_cents', v_available, 'pending_cents', v_pending,
    'rows', v_rows, 'next', v_next);
end;
$function$;

revoke all on function public.place_money_summary(uuid, timestamptz, timestamptz, boolean, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.place_money_summary(uuid, timestamptz, timestamptz, boolean, timestamptz, uuid) to service_role;

comment on function public.place_money_summary(uuid, timestamptz, timestamptz, boolean, timestamptz, uuid) is
  'MESITA-3307: one place''s money in one universe (p_livemode): money received (vouchers and card parts net of refunds), Mesita''s fee net of fee refunds, tips net of tip refunds, credit outstanding (Available and Pending, now), and 50 paid rows newest first before the (created_at, id) cursor, with the guest''s name and email for the EF to mask. Service role only.';

-- ── 3. The operator's needs_review list ───────────────────────────────────
-- Purchases and payments in needs_review, newest first, 50 a page by the
-- same (created_at, id) cursor. reopenable = never paid (wallet_reopen_settle
-- takes only those); a paid one is an uncovered refund, the refund's business.
create or replace function public.wallet_needs_review_list(
  p_before timestamptz default null, p_before_id uuid default null)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with r as (
    select 'purchase'::text as kind, p.id, p.place_id, p.created_at, p.paid_at, p.amount_cents,
           p.refunded_cents, p.uncovered_cents, p.stripe_error, p.livemode, p.voucher
      from public.wallet_purchases p where p.status = 'needs_review'
    union all
    select 'payment'::text, y.id, y.place_id, y.created_at, y.paid_at, y.amount_cents + y.tip_cents,
           y.refunded_cents, y.uncovered_cents, y.stripe_error, y.livemode, null::text
      from public.wallet_payments y where y.status = 'needs_review'
  ), page as (
    select r.* from r
     where p_before is null
        or r.created_at < p_before
        or (p_before_id is not null and r.created_at = p_before and r.id < p_before_id)
     order by r.created_at desc, r.id desc
     limit 50
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', page.kind, 'id', page.id, 'place_id', page.place_id,
           'place_name', coalesce(nullif(pp.name, ''), pp.google_name),
           'created_at', page.created_at, 'paid_at', page.paid_at, 'amount_cents', page.amount_cents,
           'refunded_cents', page.refunded_cents, 'uncovered_cents', page.uncovered_cents,
           'stripe_error', page.stripe_error, 'livemode', page.livemode, 'voucher', page.voucher,
           'reopenable', page.paid_at is null)
           order by page.created_at desc, page.id desc), '[]'::jsonb)
    from page
    left join public.place_profiles pp on pp.id = page.place_id;
$function$;

revoke all on function public.wallet_needs_review_list(timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.wallet_needs_review_list(timestamptz, uuid) to service_role;

comment on function public.wallet_needs_review_list(timestamptz, uuid) is
  'MESITA-3307 (operator): purchases and payments in needs_review with uncovered_cents and stripe_error, newest first, 50 a page by the (created_at, id) cursor; reopenable when never paid. Service role only.';

-- ── 4. Post-flight ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wallet_entries_kind_shape_chk'
                 and pg_get_constraintdef(oid) like '%refund%') then
    raise exception 'the refund kind is missing from wallet_entries_kind_shape_chk';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('wallet_refund_credit', 'place_money_summary', 'wallet_needs_review_list')) <> 3 then
    raise exception 'the W3 functions are missing after apply';
  end if;
end $$;
