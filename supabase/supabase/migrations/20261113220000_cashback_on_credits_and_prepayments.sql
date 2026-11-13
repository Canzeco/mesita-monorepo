-- MESITA-3827 — Cashback-as-Credits on every way to pay (Pato, 2026-11-13:
-- "add the option to give cashback with credits too. why not???"; then
-- "Yes, build all": vouchers too).
--
-- Two new rates, Off (null) or one fixed value, like MESITA-3596:
--   credit_cashback_bps   Credits Payments Cashback, 2%, on the credit part of
--                         a bill (never the tip), paid when the credit is
--                         spent, or at the waiter's signature on a guest tab;
--                         a guest tab that ends unsigned pays none, as today.
--   prepay_cashback_bps   Mesita Prepayments Cashback, 5%, on a voucher's
--                         price (never its bonus), paid with the voucher's
--                         credit (a Story's at activation).
-- Each row stamps its rate when it is written (a BEFORE INSERT trigger reads
-- the place's switches), so a later change never reaches a payment already
-- made. Each part keeps its own amount: wallet_payments.cashback_cents stays
-- the card or cash part (the cash caps still read only that), the new
-- credit_cashback_cents holds the credit part; ONE 'cashback' entry per
-- payment is their sum, each part rounded down first. A refund takes back
-- only its own part's share: a card refund never counts the credit part's
-- reversals (reason 'credit_refund'), a credit refund reverses its share, an
-- outside refund (the whole bill) reverses both. A voucher's cashback is a
-- 'cashback' entry on its purchase; a voucher refund takes its share back.
--
--   wallet_grant_cashback(...)   the card + credit cashback of one payment row
--                                (internal; idempotent)
--   wallet_pay_credit            gains p_cashback (default false: the SQL
--                                callers, incl. an unsigned guest tab's close,
--                                pay none; the direct pay EF passes true)
--   wallet_settle_payment, pay_tab_card_cashback, pay_tab_open_parts,
--   wallet_confirm_outside, wallet_refund_payment, wallet_refund_credit,
--   wallet_refund_outside, wallet_credit_purchase, wallet_activate_story,
--   wallet_refund_purchase, place_money_summary   redefined
--
-- Past rows are not touched: both new rates start Off and no row is backfilled.

-- ── 1. The switches ────────────────────────────────────────────────────────
alter table public.place_payment_settings
  add column if not exists credit_cashback_bps integer
    constraint place_payment_settings_credit_cashback_bps_check check (credit_cashback_bps is null or credit_cashback_bps = 200),
  add column if not exists prepay_cashback_bps integer
    constraint place_payment_settings_prepay_cashback_bps_check check (prepay_cashback_bps is null or prepay_cashback_bps = 500);

comment on column public.place_payment_settings.credit_cashback_bps is
  'MESITA-3827: Credits Payments Cashback, null = Off, else exactly 200 bps (2%) on the credit part of a bill only (never the tip). Live only while House Credits is on.';
comment on column public.place_payment_settings.prepay_cashback_bps is
  'MESITA-3827: Mesita Prepayments Cashback, null = Off, else exactly 500 bps (5%) on a voucher''s price (never its bonus). Live only while House Credits and Mesita Prepayments are on; turning it on needs a Stripe Account taking cards.';

-- ── 2. The rows carry their own rate and amount ────────────────────────────
alter table public.wallet_payments
  add column if not exists credit_cashback_bps integer not null default 0
    constraint wallet_payments_credit_cashback_bps_max check (credit_cashback_bps between 0 and 2000),
  add column if not exists credit_cashback_cents integer not null default 0
    constraint wallet_payments_credit_cashback_cents_chk check (credit_cashback_cents >= 0);

alter table public.wallet_purchases
  add column if not exists cashback_bps integer not null default 0
    constraint wallet_purchases_cashback_bps_max check (cashback_bps between 0 and 2000),
  add column if not exists cashback_cents integer not null default 0
    constraint wallet_purchases_cashback_cents_chk check (cashback_cents >= 0);

comment on column public.wallet_payments.credit_cashback_bps is
  'MESITA-3827: the place''s Credits Payments Cashback when this row was written (0 = none); stamped by wallet_payments_stamp_credit_cashback, never re-read.';
comment on column public.wallet_payments.credit_cashback_cents is
  'MESITA-3827: the credit part''s cashback, floor(credit_cents * credit_cashback_bps / 10000), once written. cashback_cents stays the card or cash part.';
comment on column public.wallet_purchases.cashback_bps is
  'MESITA-3827: the place''s Mesita Prepayments Cashback when the purchase was opened (0 = none); stamped by wallet_purchases_stamp_cashback.';
comment on column public.wallet_purchases.cashback_cents is
  'MESITA-3827: the voucher''s cashback, floor(amount_cents * cashback_bps / 10000), written with its credit.';

create or replace function public.wallet_payments_stamp_credit_cashback()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.credit_cashback_bps = 0 then
    select coalesce(s.credit_cashback_bps, 0) into new.credit_cashback_bps
      from public.place_payment_settings s
     where s.place_id = new.place_id and s.house_credits;
    new.credit_cashback_bps := coalesce(new.credit_cashback_bps, 0);
  end if;
  return new;
end;
$function$;

create trigger wallet_payments_stamp_credit_cashback
  before insert on public.wallet_payments
  for each row execute function public.wallet_payments_stamp_credit_cashback();

create or replace function public.wallet_purchases_stamp_cashback()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.cashback_bps = 0 then
    select coalesce(s.prepay_cashback_bps, 0) into new.cashback_bps
      from public.place_payment_settings s
     where s.place_id = new.place_id and s.house_credits and s.prepayments;
    new.cashback_bps := coalesce(new.cashback_bps, 0);
  end if;
  return new;
end;
$function$;

create trigger wallet_purchases_stamp_cashback
  before insert on public.wallet_purchases
  for each row execute function public.wallet_purchases_stamp_cashback();

revoke all on function public.wallet_payments_stamp_credit_cashback() from public, anon, authenticated;
revoke all on function public.wallet_purchases_stamp_cashback() from public, anon, authenticated;

-- ── 3. Turning Prepayments Cashback on needs Stripe, like card cashback ────
create or replace function public.place_payment_settings_stripe_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  turning_on boolean;
begin
  if tg_op = 'INSERT' then
    turning_on := new.pay_cards or new.card_cashback_bps is not null or new.prepayments
               or new.prepay_cashback_bps is not null
               or new.voucher_200 or new.voucher_1000 or new.voucher_5000
               or new.voucher_welcome or new.voucher_story or new.voucher_vip;
  else
    turning_on := (new.pay_cards and not old.pay_cards)
               or (new.card_cashback_bps is not null and old.card_cashback_bps is null)
               or (new.prepayments and not old.prepayments)
               or (new.prepay_cashback_bps is not null and old.prepay_cashback_bps is null)
               or (new.voucher_200 and not old.voucher_200)
               or (new.voucher_1000 and not old.voucher_1000)
               or (new.voucher_5000 and not old.voucher_5000)
               or (new.voucher_welcome and not old.voucher_welcome)
               or (new.voucher_story and not old.voucher_story)
               or (new.voucher_vip and not old.voucher_vip);
  end if;
  if turning_on and not exists (
    select 1 from public.place_payment_accounts a
     where a.place_id = new.place_id and a.charges_enabled
  ) then
    raise exception 'needs_stripe: Mesita Payments, its cashback and Mesita Prepayments need a Stripe account that takes cards'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

drop trigger place_payment_settings_stripe_guard on public.place_payment_settings;
create trigger place_payment_settings_stripe_guard
  before insert or update of pay_cards, card_cashback_bps, prepayments, prepay_cashback_bps,
                             voucher_200, voucher_1000, voucher_5000, voucher_welcome, voucher_story, voucher_vip
  on public.place_payment_settings
  for each row execute function public.place_payment_settings_stripe_guard();

-- ── 4. Entries: a cashback names its payment OR its purchase ───────────────
alter table public.wallet_entries drop constraint if exists wallet_entries_kind_shape_chk;
alter table public.wallet_entries add constraint wallet_entries_kind_shape_chk check (
  case kind
    when 'prepay' then amount_cents > 0 and purchase_id is not null and payment_id is null and gift_id is null
    when 'voucher' then amount_cents > 0 and purchase_id is not null and payment_id is null and gift_id is null
    when 'bonus' then amount_cents > 0 and purchase_id is not null and payment_id is null and gift_id is null
    when 'cashback' then amount_cents > 0 and (payment_id is null) <> (purchase_id is null) and gift_id is null
    when 'spend' then amount_cents < 0 and payment_id is not null and purchase_id is null and gift_id is null
    when 'reversal' then amount_cents < 0 and (purchase_id is not null or payment_id is not null) and gift_id is null
    when 'refund' then amount_cents > 0 and payment_id is not null and purchase_id is null and gift_id is null
    when 'gift_out' then amount_cents < 0 and gift_id is not null and purchase_id is null and payment_id is null
    when 'gift_in' then amount_cents > 0 and gift_id is not null and purchase_id is null and payment_id is null
    when 'gift_back' then amount_cents > 0 and gift_id is not null and purchase_id is null and payment_id is null
    else false
  end
);

create unique index if not exists wallet_entries_purchase_cashback_once on public.wallet_entries (purchase_id)
  where kind = 'cashback';

alter table public.wallet_entries drop constraint if exists wallet_entries_reason_chk;
alter table public.wallet_entries add constraint wallet_entries_reason_chk check (
  reason is null or (kind = 'reversal' and reason in ('refund', 'dispute_lost', 'credit_refund'))
);

-- ── 5. One payment row's card + credit cashback ────────────────────────────
-- Under the caller's pair lock. A paid card or credit row (a cash row's
-- cashback is wallet_confirm_outside's, under its caps) with no cashback
-- entry yet, not on an unsigned guest tab: card part + credit part, each
-- rounded down, ONE entry an hour later. Answers what it wrote.
create or replace function public.wallet_grant_cashback(p_payment_id uuid, p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w public.wallet_payments;
  v_card integer;
  v_credit integer;
begin
  select * into w from public.wallet_payments where id = p_payment_id for update;
  if not found or w.paid_at is null or w.status not in ('paid', 'partly_refunded') or w.outside_cents > 0 then
    return 0;
  end if;
  if exists (select 1 from public.wallet_entries e where e.payment_id = w.id and e.kind = 'cashback') then
    return 0;
  end if;
  if w.tab_id is not null
     and exists (select 1 from public.pay_tabs t where t.id = w.tab_id and t.origin = 'guest' and t.verified_at is null) then
    return 0;
  end if;
  v_card := (w.card_cents * w.cashback_bps) / 10000;
  v_credit := (w.credit_cents * w.credit_cashback_bps) / 10000;
  if v_card + v_credit <= 0 then
    return 0;
  end if;
  update public.wallet_payments set cashback_cents = v_card, credit_cashback_cents = v_credit, updated_at = now()
   where id = w.id;
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
  values (w.consumer_id, w.place_id, 'cashback', v_card + v_credit, w.currency, w.id, w.livemode, p_now + interval '1 hour');
  return v_card + v_credit;
end;
$function$;

revoke all on function public.wallet_grant_cashback(uuid, timestamptz) from public, anon, authenticated;

-- ── 6. The redefined functions ─────────────────────────────────────────────
drop function public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text);

create or replace function public.wallet_pay_credit(
  p_consumer_id uuid, p_place_id uuid, p_amount_cents integer, p_currency text,
  p_livemode boolean, p_request_id uuid, p_proof_token text, p_ticket text default null,
  p_cashback boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_prior public.wallet_payments;
  v_spendable integer;
  v_id uuid;
  v_paid_at timestamptz;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    return jsonb_build_object('ok', false, 'code', 'amount_required');
  end if;
  if p_consumer_id is null or p_request_id is null then
    raise exception 'wallet_pay_credit: consumer and request_id are required';
  end if;
  -- The function is the last word on currency as on amounts: places store
  -- 'MXN', the ledger 'mxn'.
  p_currency := lower(p_currency);

  perform public.wallet_lock(p_consumer_id, p_place_id);

  select * into v_prior from public.wallet_payments
   where consumer_id = p_consumer_id and request_id = p_request_id;
  if found then
    if v_prior.place_id = p_place_id and v_prior.amount_cents = p_amount_cents
       and v_prior.livemode = p_livemode and v_prior.paid_at is not null then
      return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v_prior.id,
        'status', v_prior.status, 'credit_cents', v_prior.credit_cents, 'currency', v_prior.currency,
        'paid_at', v_prior.paid_at, 'proof_token', v_prior.proof_token);
    end if;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_prior.id);
  end if;

  select b.spendable_cents into v_spendable
    from public.wallet_balance(p_consumer_id, p_place_id, p_currency, p_livemode) b;
  v_spendable := coalesce(v_spendable, 0);
  if p_amount_cents > v_spendable then
    return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', v_spendable);
  end if;

  begin
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents,
                                        currency, status, stripe_account_id, paid_at, request_id, ticket,
                                        proof_token, livemode)
    values (p_consumer_id, p_place_id, p_amount_cents, p_amount_cents, 0, 0,
            p_currency, 'paid', null, now(), p_request_id, p_ticket,
            p_proof_token, p_livemode)
    returning id, paid_at into v_id, v_paid_at;
  exception when unique_violation then
    select id into v_id from public.wallet_payments
     where consumer_id = p_consumer_id and request_id = p_request_id;
    return jsonb_build_object('ok', false, 'code', 'taken', 'payment_id', v_id);
  end;

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
  values (p_consumer_id, p_place_id, 'spend', -p_amount_cents, p_currency, v_id, p_livemode, now());
  -- MESITA-3827: a direct credit payment earns its Credits Payments Cashback now.
  if p_cashback then
    perform public.wallet_grant_cashback(v_id, now());
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v_id, 'status', 'paid',
    'credit_cents', p_amount_cents, 'currency', p_currency, 'paid_at', v_paid_at, 'proof_token', p_proof_token);
end;
$function$;

create or replace function public.wallet_settle_payment(p_payment_id uuid, p_payment_intent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_cashback integer;
  v_paid_at timestamptz := now();
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.paid_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v.id, 'status', v.status,
      'credit_cents', v.credit_cents, 'card_cents', v.card_cents, 'tip_cents', v.tip_cents,
      'cashback_cents', v.cashback_cents, 'currency', v.currency, 'paid_at', v.paid_at, 'proof_token', v.proof_token);
  end if;
  if v.status in ('failed', 'expired', 'needs_review') then
    update public.wallet_payments
       set stripe_error = 'late_completion',
           stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
           status = 'needs_review', updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'late_completion', 'payment_id', v.id, 'was', v.status);
  end if;

  perform public.wallet_lock(v.consumer_id, v.place_id);
  update public.wallet_payments
     set status = 'paid', paid_at = v_paid_at, updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
         cashback_cents = 0, stripe_error = null
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, v_paid_at);
  end if;
  -- MESITA-3827: card and credit parts, one entry; none on an unsigned guest tab.
  v_cashback := public.wallet_grant_cashback(v.id, v_paid_at);

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'card_cents', v.card_cents, 'tip_cents', v.tip_cents,
    'cashback_cents', v_cashback, 'currency', v.currency, 'paid_at', v_paid_at, 'proof_token', v.proof_token);
end;
$function$;

create or replace function public.pay_tab_card_cashback(p_tab_id uuid, p_now timestamptz default now())
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  w public.wallet_payments;
  v_total integer := 0;
begin
  for w in
    select * from public.wallet_payments
     where tab_id = p_tab_id and outside_cents = 0 and paid_at is not null and status in ('paid', 'partly_refunded')
     order by created_at
  loop
    v_total := v_total + public.wallet_grant_cashback(w.id, p_now);
  end loop;
  return v_total;
end;
$function$;

create or replace function public.pay_tab_open_parts(
  p_tab_id uuid, p_consumer_id uuid, p_bill_version integer,
  p_credit_cents integer, p_cash_bill_cents integer, p_cash_tip_cents integer,
  p_card_bill_cents integer, p_card_tip_cents integer,
  p_request_id uuid, p_proof_token text, p_outside_cashback_bps integer, p_max_outside_per_day integer,
  p_now timestamptz default now(),
  p_stripe_account_id text default null, p_card_fee_cents integer default 0,
  p_card_cashback_bps integer default 0, p_card_proof_token text default null,
  p_card_expires_at timestamptz default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.pay_tabs;
  v_count integer;
  v_res jsonb;
  v_pay uuid;
  v_card uuid;
  v_status text;
  v_spendable integer;
  v_card_req uuid;
  v_has_card boolean := coalesce(p_card_bill_cents, 0) > 0 or coalesce(p_card_tip_cents, 0) > 0;
  v_expires timestamptz := p_now + interval '30 minutes';
begin
  if p_tab_id is null or p_consumer_id is null or p_request_id is null then
    raise exception 'pay_tab_open_parts: tab, consumer and request_id are required';
  end if;
  select * into v from public.pay_tabs where id = p_tab_id;
  if not found or v.consumer_id is distinct from p_consumer_id then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  perform public.wallet_lock(p_consumer_id, v.place_id);
  select * into v from public.pay_tabs where id = p_tab_id for update;

  if v.pay_request_id = p_request_id and v.status in ('paying', 'paid') then
    select id into v_card from public.wallet_payments where tab_id = v.id and part = 'card'
     order by created_at desc limit 1;
    return jsonb_build_object('ok', true, 'outcome', 'replayed', 'tab_id', v.id, 'status', v.status,
      'card_payment_id', v_card);
  end if;
  if v.status = 'billed' and v.expires_at <= p_now then
    update public.pay_tabs set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if v.status <> 'billed' then
    return jsonb_build_object('ok', false, 'code', case when v.status = 'waiting_bill' then 'not_billed'
      when v.status in ('paying', 'paid') then 'paying' else v.status end, 'status', v.status);
  end if;
  if p_bill_version is distinct from v.bill_version then
    return jsonb_build_object('ok', false, 'code', 'stale', 'bill_version', v.bill_version);
  end if;
  if coalesce(p_credit_cents, -1) < 0 or coalesce(p_cash_bill_cents, -1) < 0 or coalesce(p_cash_tip_cents, -1) < 0
     or coalesce(p_card_bill_cents, -1) < 0 or coalesce(p_card_tip_cents, -1) < 0
     or p_credit_cents + p_cash_bill_cents + p_card_bill_cents <> v.bill_cents
     or p_cash_tip_cents + p_card_tip_cents > 10000000 then
    return jsonb_build_object('ok', false, 'code', 'parts', 'bill_cents', v.bill_cents);
  end if;
  if v_has_card and (p_stripe_account_id is null or p_card_expires_at is null) then
    return jsonb_build_object('ok', false, 'code', 'card_unavailable');
  end if;
  if v_has_card and p_credit_cents + p_card_bill_cents = 0 then
    -- A card row carries the credit and the card bill part; a tip by card
    -- alone, with the whole bill in cash, has nothing to ride on.
    return jsonb_build_object('ok', false, 'code', 'card_tip_alone', 'bill_cents', v.bill_cents);
  end if;

  if p_cash_bill_cents > 0 then
    -- The guest's daily limit of outside bills here, counted under the lock.
    select count(*) into v_count from public.wallet_payments
     where consumer_id = p_consumer_id and place_id = v.place_id and livemode = v.livemode
       and outside_cents > 0 and created_at > p_now - interval '1 day'
       and status not in ('expired', 'failed');
    if v_count >= p_max_outside_per_day then
      return jsonb_build_object('ok', false, 'code', 'outside_limit', 'max_per_day', p_max_outside_per_day);
    end if;
  end if;

  if v_has_card then
    -- ONE card row: the credit (held: opening rows count in wallet_balance),
    -- the card bill part and the card tip. Its own request id, derived from
    -- the tap's, so the outside row keeps the tap's.
    select b.spendable_cents into v_spendable
      from public.wallet_balance(p_consumer_id, v.place_id, v.currency, v.livemode) b;
    if p_credit_cents > coalesce(v_spendable, 0) then
      return jsonb_build_object('ok', false, 'code', 'insufficient', 'spendable_cents', coalesce(v_spendable, 0));
    end if;
    v_card_req := md5(p_request_id::text || ':card')::uuid;
    if exists (select 1 from public.wallet_payments where consumer_id = p_consumer_id and request_id = v_card_req) then
      -- The same tap after its card part failed: a new tap starts over.
      return jsonb_build_object('ok', false, 'code', 'closed');
    end if;
    insert into public.wallet_payments (consumer_id, place_id, amount_cents, credit_cents, card_cents, tip_cents,
                                        currency, status, stripe_account_id, application_fee_cents, cashback_bps,
                                        request_id, ticket, proof_token, livemode, expires_at,
                                        tab_id, part, charge_amount_cents)
    values (p_consumer_id, v.place_id, p_credit_cents + p_card_bill_cents, p_credit_cents, p_card_bill_cents,
            p_card_tip_cents, v.currency, 'opening', p_stripe_account_id, greatest(coalesce(p_card_fee_cents, 0), 0),
            least(greatest(coalesce(p_card_cashback_bps, 0), 0), 10000), v_card_req, v.ticket, p_card_proof_token,
            v.livemode, p_card_expires_at, v.id, 'card', v.bill_cents)
    returning id into v_card;
    v_pay := v_card;
    v_status := 'paying';
  end if;

  if p_cash_bill_cents > 0 then
    -- The cash bill part (and any cash tip) is one outside row; with a card
    -- part the credit already rides on the card row.
    v_res := public.wallet_open_outside(p_consumer_id, v.place_id,
      case when v_has_card then 0 else p_credit_cents end, p_cash_bill_cents, p_cash_tip_cents,
      v.currency, v.livemode, p_request_id, p_proof_token, v.ticket, p_outside_cashback_bps, v_expires);
    if not coalesce((v_res ->> 'ok')::boolean, false) or v_res ->> 'outcome' <> 'opened' then
      -- Undo the card row of this call (no Stripe object exists yet).
      if v_card is not null then
        delete from public.wallet_payments where id = v_card and status = 'opening' and stripe_payment_intent_id is null;
      end if;
      return coalesce(v_res, '{}'::jsonb) || jsonb_build_object('ok', false);
    end if;
    update public.wallet_payments set tab_id = v.id, part = 'outside', charge_amount_cents = v.bill_cents
     where id = (v_res ->> 'payment_id')::uuid;
    v_pay := coalesce(v_card, (v_res ->> 'payment_id')::uuid);
    v_status := 'paying';
  elsif not v_has_card then
    -- Credits pay the whole bill now.
    v_res := public.wallet_pay_credit(p_consumer_id, v.place_id, p_credit_cents, v.currency, v.livemode,
      p_request_id, p_proof_token, v.ticket);
    if not coalesce((v_res ->> 'ok')::boolean, false) or v_res ->> 'outcome' <> 'paid' then
      return coalesce(v_res, '{}'::jsonb) || jsonb_build_object('ok', false);
    end if;
    v_pay := (v_res ->> 'payment_id')::uuid;
    update public.wallet_payments set tab_id = v.id, part = 'credit', charge_amount_cents = v.bill_cents
     where id = v_pay;
    perform public.wallet_grant_cashback(v_pay, p_now);
    -- A cash tip still waits for the waiter's Received.
    v_status := case when p_cash_tip_cents > 0 then 'paying' else 'paid' end;
  end if;

  update public.pay_tabs
     set status = v_status, pay_request_id = p_request_id, paying_at = p_now,
         paid_at = case when v_status = 'paid' then p_now end,
         credit_cents = p_credit_cents, cash_bill_cents = p_cash_bill_cents, cash_tip_cents = p_cash_tip_cents,
         card_bill_cents = p_card_bill_cents, card_tip_cents = p_card_tip_cents,
         expires_at = greatest(v.expires_at, v_expires), updated_at = now()
   where id = v.id;
  return jsonb_build_object('ok', true, 'outcome', 'opened', 'tab_id', v.id, 'status', v_status, 'payment_id', v_pay,
    'card_payment_id', v_card,
    'credit_cents', p_credit_cents, 'cash_bill_cents', p_cash_bill_cents, 'cash_tip_cents', p_cash_tip_cents,
    'card_bill_cents', p_card_bill_cents, 'card_tip_cents', p_card_tip_cents);
end;
$function$;

create or replace function public.wallet_confirm_outside(p_payment_id uuid, p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_cashback integer;
  v_today integer;
  v_mine integer;
  v_credit_back integer;
  c_ceiling constant integer := 50000;
  -- MESITA-3707: a guest tab's cash earns at most $100MX of cashback per
  -- guest per place per day, so one guest cannot take the place's whole day.
  c_guest_cap constant integer := 10000;
begin
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.outside_cents = 0 then
    return jsonb_build_object('ok', false, 'code', 'not_outside');
  end if;
  if v.paid_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid', 'payment_id', v.id, 'status', v.status,
      'credit_cents', v.credit_cents, 'outside_cents', v.outside_cents, 'tip_cents', v.tip_cents,
      'cashback_cents', v.cashback_cents, 'currency', v.currency, 'paid_at', v.paid_at, 'proof_token', v.proof_token);
  end if;
  if v.status not in ('opening', 'open') then
    if v.status = 'expired' and v.stripe_error = 'cancelled' then
      return jsonb_build_object('ok', false, 'code', 'closed', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
    end if;
    return jsonb_build_object('ok', false, 'code', 'expired', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
  end if;
  if v.expires_at is not null and v.expires_at <= p_now then
    update public.wallet_payments set status = 'expired', updated_at = now() where id = v.id;
    return jsonb_build_object('ok', false, 'code', 'expired', 'bill_cents', coalesce(v.charge_amount_cents, v.amount_cents));
  end if;

  perform public.wallet_lock(v.consumer_id, v.place_id);
  v_cashback := (v.outside_cents * v.outside_cashback_bps) / 10000;
  if v_cashback > 0 then
    select coalesce(sum(cashback_cents), 0) into v_today from public.wallet_payments
     where place_id = v.place_id and livemode = v.livemode and outside_cents > 0
       and paid_at is not null and paid_at > p_now - interval '1 day';
    v_cashback := least(v_cashback, greatest(c_ceiling - v_today, 0));
  end if;
  if v_cashback > 0 and v.tab_id is not null
     and exists (select 1 from public.pay_tabs t where t.id = v.tab_id and t.origin = 'guest') then
    select coalesce(sum(cashback_cents), 0) into v_mine from public.wallet_payments
     where consumer_id = v.consumer_id and place_id = v.place_id and livemode = v.livemode and outside_cents > 0
       and paid_at is not null and paid_at > p_now - interval '1 day';
    v_cashback := least(v_cashback, greatest(c_guest_cap - v_mine, 0));
  end if;

  -- MESITA-3827: the credit part's cashback, never under the cash caps.
  v_credit_back := (v.credit_cents * v.credit_cashback_bps) / 10000;

  update public.wallet_payments
     set status = 'paid', paid_at = p_now, confirmed_by = 'waiter', cashback_cents = v_cashback,
         credit_cashback_cents = v_credit_back, updated_at = now()
   where id = v.id;

  if v.credit_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'spend', -v.credit_cents, v.currency, v.id, v.livemode, p_now);
  end if;
  if v_cashback + v_credit_back > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'cashback', v_cashback + v_credit_back, v.currency, v.id, v.livemode, p_now + interval '1 hour');
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'paid', 'payment_id', v.id, 'status', 'paid',
    'credit_cents', v.credit_cents, 'outside_cents', v.outside_cents, 'tip_cents', v.tip_cents,
    'cashback_cents', v_cashback + v_credit_back, 'currency', v.currency, 'paid_at', p_now, 'proof_token', v.proof_token);
end;
$function$;

create or replace function public.wallet_refund_payment(p_payment_id uuid, p_amount_refunded integer, p_reason text default 'refund')
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_ceiling integer;
  v_new_refunded integer;
  v_delta integer;
  v_card_refunded integer;
  v_tip_refunded integer;
  v_target integer := 0;
  v_done integer;
  v_to_reverse integer := 0;
  v_unspent integer;
  v_reversed integer := 0;
  v_status text;
  v_fee_refunded integer;
begin
  if p_amount_refunded is null or p_amount_refunded < 0 then
    return jsonb_build_object('ok', false, 'code', 'bad_amount');
  end if;
  if p_reason is null or p_reason not in ('refund', 'dispute_lost') then
    return jsonb_build_object('ok', false, 'code', 'bad_reason');
  end if;
  select * into v from public.wallet_payments where id = p_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.paid_at is null then
    return jsonb_build_object('ok', false, 'code', 'not_paid');
  end if;
  v_ceiling := v.card_cents + v.tip_cents;
  v_new_refunded := least(p_amount_refunded, v_ceiling);
  v_delta := v_new_refunded - v.refunded_cents;
  if v_delta <= 0 then
    return jsonb_build_object('ok', true, 'outcome', 'already_applied', 'refunded_cents', v.refunded_cents);
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  v_card_refunded := least(v_new_refunded, v.card_cents);
  v_tip_refunded := v_new_refunded - v_card_refunded;

  if v.cashback_cents > 0 and v.card_cents > 0 then
    v_target := case when v_card_refunded >= v.card_cents then v.cashback_cents
                     else (v.cashback_cents * v_card_refunded) / v.card_cents end;
    v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                         where payment_id = v.id and kind = 'reversal'
                           and reason is distinct from 'credit_refund'), 0) + v.uncovered_cents;
    v_to_reverse := greatest(v_target - v_done, 0);
    if v_to_reverse > 0 then
      select greatest(available_cents + pending_cents, 0) into v_unspent
        from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode, now());
      v_reversed := least(v_to_reverse, v_unspent);
      if v_reversed > 0 then
        insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at, reason)
        values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, now(), p_reason);
      end if;
    end if;
  end if;

  -- MESITA-3461: the refunded share of the card part owes no fee; a full
  -- card refund owes none. Never shrinks (a replay cannot bill it again).
  v_fee_refunded := case
    when v.card_cents <= 0 or v_card_refunded >= v.card_cents then v.application_fee_cents
    else (v.application_fee_cents * v_card_refunded) / v.card_cents end;
  v_fee_refunded := least(greatest(v.fee_refunded_cents, v_fee_refunded), v.application_fee_cents);

  v_status := case
    when v.uncovered_cents + (v_to_reverse - v_reversed) > 0 then 'needs_review'
    when v_new_refunded >= v_ceiling then 'refunded'
    else 'partly_refunded'
  end;

  update public.wallet_payments
     set refunded_cents = v_new_refunded,
         tip_refunded_cents = v_tip_refunded,
         uncovered_cents = uncovered_cents + (v_to_reverse - v_reversed),
         fee_refunded_cents = v_fee_refunded,
         status = v_status,
         updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
    'card_refunded_cents', v_card_refunded, 'tip_refunded_cents', v_tip_refunded,
    'reversed_cents', v_reversed, 'uncovered_cents', v_to_reverse - v_reversed, 'status', v_status);
end;
$function$;

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
  v_target integer;
  v_done integer;
  v_back integer;
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

  -- MESITA-3827: the refunded share of the credit part's cashback goes back.
  -- The refund entry above always covers it (2% of what it returns).
  if v.credit_cashback_cents > 0 and v.credit_cents > 0 then
    v_target := case when v_new >= v.credit_cents then v.credit_cashback_cents
                     else (v.credit_cashback_cents * v_new) / v.credit_cents end;
    v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                         where payment_id = v.id and kind = 'reversal' and reason = 'credit_refund'), 0);
    v_back := greatest(v_target - v_done, 0);
    if v_back > 0 then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at, reason)
      values (v.consumer_id, v.place_id, 'reversal', -v_back, v.currency, v.id, v.livemode, now(), 'credit_refund');
    end if;
  end if;
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

create or replace function public.wallet_refund_outside(p_payment_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_payments;
  v_credit integer;
  v_owed integer;
  v_holds integer;
  v_take integer := 0;
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

  select v.cashback_cents + v.credit_cashback_cents + coalesce(sum(amount_cents), 0) into v_owed
    from public.wallet_entries where payment_id = v.id and kind = 'reversal';
  v_owed := greatest(coalesce(v_owed, 0), 0);
  if v_owed > 0 then
    select greatest(b.spendable_cents + b.pending_cents, 0) into v_holds
      from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode) b;
    v_take := least(v_owed, coalesce(v_holds, 0));
    if v_take > 0 then
      insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, payment_id, livemode, available_at)
      values (v.consumer_id, v.place_id, 'reversal', -v_take, v.currency, v.id, v.livemode, now());
    end if;
  end if;
  v_uncovered := v.uncovered_cents + (v_owed - v_take);
  v_status := case when v_uncovered > 0 then 'needs_review' else 'refunded' end;

  update public.wallet_payments
     set credit_refunded_cents = v.credit_cents, uncovered_cents = v_uncovered, status = v_status, updated_at = now()
   where id = v.id;

  return jsonb_build_object('ok', true, 'outcome', 'applied', 'status', v_status,
    'credit_refunded_cents', v_credit, 'cashback_reversed_cents', v_take, 'uncovered_cents', v_uncovered);
end;
$function$;

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
  v_back integer;
begin
  select * into v from public.wallet_purchases where id = p_purchase_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v.status in ('paid', 'refunded', 'partly_refunded', 'needs_review') then
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  -- An expired or failed purchase that Stripe nevertheless paid is still
  -- credited: the guest's money arrived.
  update public.wallet_purchases
     set status = 'paid', paid_at = now(), updated_at = now(),
         stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id)
   where id = p_purchase_id;

  -- A Story waits for staff (MESITA-3507): paid, its activation key minted,
  -- no credit until wallet_activate_story writes it.
  if v.voucher = 'voucher_story' then
    update public.wallet_purchases
       set story_token = coalesce(story_token, replace(gen_random_uuid()::text, '-', ''))
     where id = p_purchase_id;
    return jsonb_build_object('ok', true, 'outcome', 'credited', 'held', true);
  end if;

  v_kind := case when v.voucher is null then 'prepay' else 'voucher' end;
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, v_at);
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  -- MESITA-3827: Mesita Prepayments Cashback, on the price, never the bonus.
  v_back := (v.amount_cents * v.cashback_bps) / 10000;
  if v_back > 0 then
    update public.wallet_purchases set cashback_cents = v_back where id = v.id;
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'cashback', v_back, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
end;
$function$;

create or replace function public.wallet_activate_story(p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.wallet_purchases;
  v_at timestamptz := now();
  v_back integer;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  select * into v from public.wallet_purchases
   where story_token = p_token and voucher = 'voucher_story'
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  if v.story_activated_at is not null then
    return jsonb_build_object('ok', true, 'outcome', 'already_active', 'activated_at', v.story_activated_at, 'purchase_id', v.id);
  end if;
  if v.status <> 'paid' then
    return jsonb_build_object('ok', false, 'code', 'gone');
  end if;
  perform public.wallet_lock(v.consumer_id, v.place_id);

  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, 'voucher', v.amount_cents, v.currency, v.id, v.livemode, v_at);
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;
  -- MESITA-3827: Mesita Prepayments Cashback, on the price, never the bonus.
  v_back := (v.amount_cents * v.cashback_bps) / 10000;
  if v_back > 0 then
    update public.wallet_purchases set cashback_cents = v_back where id = v.id;
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'cashback', v_back, v.currency, v.id, v.livemode, v_at);
  end if;
  update public.wallet_purchases
     set story_activated_at = v_at, updated_at = now()
   where id = v.id;
  v.story_activated_at := v_at;

  return jsonb_build_object('ok', true, 'outcome', 'activated', 'activated_at', v.story_activated_at, 'purchase_id', v.id);
end;
$function$;

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

  -- A Story refunded before staff activated it was never credited
  -- (MESITA-3507): nothing to reverse, nothing uncovered. It can no longer be
  -- activated (wallet_activate_story needs status paid).
  if v.voucher = 'voucher_story' and v.story_activated_at is null then
    v_status := case when v_new_refunded >= v.amount_cents then 'refunded' else 'partly_refunded' end;
    update public.wallet_purchases
       set refunded_cents = v_new_refunded, fee_refunded_cents = v_fee_refunded, status = v_status, updated_at = now()
     where id = v.id;
    return jsonb_build_object('ok', true, 'outcome', 'applied', 'delta_cents', v_delta,
      'reversed_cents', 0, 'uncovered_cents', 0, 'status', v_status);
  end if;

  -- What should be gone in total once this refund is applied: the refunded
  -- principal plus the bonus's share of it (all of the bonus on a full
  -- refund). What is already gone: earlier reversals plus what could not be
  -- reversed. The difference is this call's reversal, whatever order the
  -- events arrived in.
  v_target := v_new_refunded + (v.bonus_cents * v_new_refunded) / v.amount_cents
            + (v.cashback_cents * v_new_refunded) / v.amount_cents;
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
           null::uuid as tab_id, null::text as part, p.cashback_cents as cashback_cents, 0 as outside_cashback_bps
      from public.wallet_purchases p
     where p.place_id = p_place_id and p.livemode = p_livemode and p.paid_at is not null
       and p.created_at >= p_from and p.created_at < p_to
    union all
    select 'payment'::text, y.id, y.created_at, y.paid_at, y.status, null::text, y.ticket,
           y.amount_cents + y.tip_cents, y.credit_cents, y.card_cents, y.tip_cents,
           y.refunded_cents + y.credit_refunded_cents, y.consumer_id,
           y.confirmed_by, y.outside_cents, y.charge_amount_cents,
           y.tab_id, y.part, y.cashback_cents + y.credit_cashback_cents, y.outside_cashback_bps
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

revoke all on function public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text, boolean) to service_role;

comment on function public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text, boolean) is
  'MESITA-3305, MESITA-3827 Wallet: pays a bill from credit alone, under the pair lock, idempotent by request_id; with p_cashback it writes the Credits Payments Cashback now (the direct pay); SQL callers leave it false. Service role only.';
comment on function public.wallet_grant_cashback(uuid, timestamptz) is
  'MESITA-3827: one paid card or credit payment row''s cashback, card part + credit part, each rounded down, one entry an hour later; none on an unsigned guest tab or a row that already has one. Internal.';
comment on function public.wallet_settle_payment(uuid, text) is
  'MESITA-3305, MESITA-3772, MESITA-3827 Wallet: marks a mixed payment paid, turns the hold into its spend entry and writes its card + credit cashback through wallet_grant_cashback (none on an unsigned guest tab: the signature writes it); idempotent; a failed, expired or needs_review row gets stripe_error late_completion and no credit. Service role only.';

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'place_payment_settings' and column_name = 'credit_cashback_bps')
     or not exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'wallet_purchases' and column_name = 'cashback_cents')
     or not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'wallet_entries_purchase_cashback_once')
     or to_regprocedure('public.wallet_pay_credit(uuid, uuid, integer, text, boolean, uuid, text, text, boolean)') is null
     or to_regprocedure('public.wallet_grant_cashback(uuid, timestamptz)') is null then
    raise exception 'MESITA-3827 objects missing after apply';
  end if;
end $$;
