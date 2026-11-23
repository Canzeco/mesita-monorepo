-- MESITA-4720 — DELETE THE ZOMBIES. Pato, 2026-11-23: "IS OKEY IF YOU DELETE
-- ZOMBIE CODE AND ZOMBIE TABLES AND COLUMNS AND ROWS IN THE DATABASE. I ONLY
-- CARE ABOUT THE LATEST VERSION. WE ARE IN DEVELOPING STAGE."
--
-- What the Story voucher (retired MESITA-4641/4642, tag stories-final) and
-- the legacy "extra" credit (no writer since MESITA-4194) left behind, every
-- one empty on live when this was written:
--   wallet_purchases: 11 story_* columns, their 3 indexes and 2 checks;
--     voucher no longer allows 'voucher_story'.
--   place_payment_settings.voucher_story and its check; the two triggers
--     that named it.
--   wallet_entries: kind 'extra' and reason 'story_void'.
--   wallet_credit_purchase / wallet_refund_purchase: their Story branches.
-- Rows that still carry any of it are deleted first (dev stage: losing them
-- is fine), so the new checks always validate.

-- ── Rows ────────────────────────────────────────────────────────────────────
delete from public.wallet_entries where kind = 'extra' or (kind = 'reversal' and reason = 'story_void');
delete from public.wallet_entries e using public.wallet_purchases p
 where e.purchase_id = p.id and p.voucher = 'voucher_story';
delete from public.wallet_purchases where voucher = 'voucher_story';

-- ── place_payment_settings.voucher_story ──────────────────────────────────
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
    turning_on := new.pay_cards or new.prepayments
               or new.voucher_200 or new.voucher_1000 or new.voucher_5000
               or new.voucher_welcome or new.voucher_vip;
  else
    turning_on := (new.pay_cards and not old.pay_cards)
               or (new.prepayments and not old.prepayments)
               or (new.voucher_200 and not old.voucher_200)
               or (new.voucher_1000 and not old.voucher_1000)
               or (new.voucher_5000 and not old.voucher_5000)
               or (new.voucher_welcome and not old.voucher_welcome)
               or (new.voucher_vip and not old.voucher_vip);
  end if;
  if turning_on and not exists (
    select 1 from public.place_payment_accounts a
     where a.place_id = new.place_id and a.charges_enabled
  ) then
    raise exception 'needs_stripe: Mesita Payments and Mesita Prepayments need a Stripe account that takes cards'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

drop trigger if exists place_payment_settings_stripe_guard on public.place_payment_settings;
create trigger place_payment_settings_stripe_guard
  before insert or update of pay_cards, prepayments, voucher_200, voucher_1000, voucher_5000, voucher_welcome, voucher_vip
  on public.place_payment_settings
  for each row execute function public.place_payment_settings_stripe_guard();

create or replace function public.loyalty_cards_contracts_end()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.ended_at is not null and old.ended_at is null then
    update public.place_payment_settings
       set loyalty_cards = false,
           prepayments = false,
           voucher_200 = false, voucher_1000 = false, voucher_5000 = false,
           voucher_welcome = false, voucher_vip = false,
           updated_at = now()
     where place_id = new.place_id;
  end if;
  return new;
end;
$function$;

-- Dropping the column would silently drop every check that names it, so the
-- vouchers-need-Loyalty-Cards check is restated without it first.
alter table public.place_payment_settings drop constraint if exists place_payment_settings_no_story;
alter table public.place_payment_settings drop constraint if exists place_payment_settings_prepay_needs_loyalty_cards;
alter table public.place_payment_settings drop column if exists voucher_story;
alter table public.place_payment_settings add constraint place_payment_settings_prepay_needs_loyalty_cards
  check (loyalty_cards or not (voucher_200 or voucher_1000 or voucher_5000 or voucher_welcome or voucher_vip));

-- ── wallet_purchases: the Story columns ────────────────────────────────────
drop index if exists public.wallet_purchases_story_mention_live_idx;
drop index if exists public.wallet_purchases_story_recheck_idx;
alter table public.wallet_purchases
  drop constraint if exists wallet_purchases_story_token_chk,
  drop constraint if exists wallet_purchases_story_review_check,
  drop constraint if exists wallet_purchases_story_token_key,
  drop column if exists story_mention_id,
  drop column if exists story_activated_at,
  drop column if exists story_reviewed_at,
  drop column if exists story_recheck_at,
  drop column if exists story_recheck_tries,
  drop column if exists story_bonus_decided_at,
  drop column if exists story_token,
  drop column if exists story_review,
  drop column if exists story_bonus,
  drop column if exists story_reviewed_by_device,
  drop column if exists story_bonus_void_reason;

alter table public.wallet_purchases drop constraint if exists wallet_purchases_voucher_check;
alter table public.wallet_purchases add constraint wallet_purchases_voucher_check
  check (voucher is null or voucher in ('voucher_200', 'voucher_1000', 'voucher_5000', 'voucher_welcome', 'voucher_vip'));

-- ── wallet_entries: no 'extra', no 'story_void' ────────────────────────────
alter table public.wallet_entries drop constraint wallet_entries_kind_chk;
alter table public.wallet_entries drop constraint wallet_entries_kind_shape_chk;
alter table public.wallet_entries add constraint wallet_entries_kind_chk check (kind = any (array[
  'prepay', 'voucher', 'bonus', 'cashback', 'story', 'spend', 'reversal', 'refund', 'gift_out', 'gift_in', 'gift_back']));
alter table public.wallet_entries add constraint wallet_entries_kind_shape_chk check (
case kind
    when 'prepay' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'voucher' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'bonus' then ((amount_cents > 0) and (purchase_id is not null) and (payment_id is null) and (gift_id is null))
    when 'cashback' then ((amount_cents > 0) and (tab_id is not null) and (purchase_id is null) and (payment_id is null) and (gift_id is null))
    when 'story' then ((amount_cents > 0) and (story_mention_id is not null) and (tab_id is null) and (purchase_id is null) and (payment_id is null) and (gift_id is null))
    when 'spend' then ((amount_cents < 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'reversal' then ((amount_cents < 0) and ((purchase_id is not null) or (payment_id is not null)) and (gift_id is null))
    when 'refund' then ((amount_cents > 0) and (payment_id is not null) and (purchase_id is null) and (gift_id is null))
    when 'gift_out' then ((amount_cents < 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_in' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    when 'gift_back' then ((amount_cents > 0) and (gift_id is not null) and (purchase_id is null) and (payment_id is null))
    else false
end);

alter table public.wallet_entries drop constraint if exists wallet_entries_reason_chk;
alter table public.wallet_entries add constraint wallet_entries_reason_chk check (
  reason is null
  or (kind = 'reversal' and reason in ('refund', 'dispute_lost', 'credit_refund'))
  or (kind = 'cashback' and reason in ('welcome', 'returning'))
);

-- ── The writers, without their Story branches ──────────────────────────────
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
  -- MESITA-4717: what the guest paid lands with the bonus, at p_available_at
  -- (paid time + 3 hours): "Pay X, wait 3 hours, receive Y".
  insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
  values (v.consumer_id, v.place_id, v_kind, v.amount_cents, v.currency, v.id, v.livemode, v_at);
  if v.bonus_cents > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at)
    values (v.consumer_id, v.place_id, 'bonus', v.bonus_cents, v.currency, v.id, v.livemode, v_at);
  end if;

  return jsonb_build_object('ok', true, 'outcome', 'credited');
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
  v_lands timestamptz;
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
  -- already gone.
  v_target := v_new_refunded + (v.bonus_cents * v_new_refunded) / v.amount_cents;
  v_done := coalesce((select -sum(amount_cents) from public.wallet_entries
                       where purchase_id = v.id and kind = 'reversal'), 0) + v.uncovered_cents;
  v_to_reverse := greatest(v_target - v_done, 0);

  select greatest(available_cents + pending_cents, 0) into v_unspent
    from public.wallet_balance(v.consumer_id, v.place_id, v.currency, v.livemode, now());
  v_reversed := least(v_to_reverse, v_unspent);

  -- MESITA-4717: while nothing of this purchase has landed yet, the reversal
  -- lands with it, so a refund inside the 3 hours never eats other credit.
  -- Once any of it is available, the reversal is available now.
  v_lands := now();
  if not exists (select 1 from public.wallet_entries
                  where purchase_id = v.id and amount_cents > 0 and available_at <= now()) then
    select coalesce(max(available_at), now()) into v_lands from public.wallet_entries
     where purchase_id = v.id and amount_cents > 0;
    v_lands := greatest(v_lands, now());
  end if;
  if v_reversed > 0 then
    insert into public.wallet_entries (consumer_id, place_id, kind, amount_cents, currency, purchase_id, livemode, available_at, reason)
    values (v.consumer_id, v.place_id, 'reversal', -v_reversed, v.currency, v.id, v.livemode, v_lands, p_reason);
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
