-- MESITA-3597 — Mesita Prepayments is its own product with its own switch
-- (Pato, 2026-11-10: "three different things: Stripe Account, Mesita
-- Payments, Mesita Prepayments ... Different products but with lots of
-- symmetries").
--
-- place_payment_settings.prepayments: Mesita Prepayments On/Off. A voucher
-- sells only when Prepayments AND its own switch are on (moneyState); the six
-- voucher switches keep their keys and stay the owner's choice of which
-- vouchers to sell. Prepayments On needs House Credits (the check below) and
-- a Stripe Account that takes cards (MESITA-3599's guard, widened below; the
-- set EF asks for the exact mode). House Credits Off and an ended contract
-- turn it Off with the vouchers.
--
-- Existing rows: a place that already sells any voucher keeps selling it
-- (prepayments = true there, so nothing a guest sees changes).
--
-- Order: the column lands before the EFs that select it are redeployed;
-- the old EFs never name it, so the window between the two is safe.

alter table public.place_payment_settings
  add column prepayments boolean not null default false;

update public.place_payment_settings
   set prepayments = true
 where house_credits
   and (voucher_200 or voucher_1000 or voucher_5000 or voucher_welcome or voucher_story or voucher_vip);

alter table public.place_payment_settings
  add constraint place_payment_settings_prepayments_needs_house_credits
    check (house_credits or not prepayments);

-- Ending a contract turns House Credits, Prepayments and the vouchers Off.
-- Credit guests already hold is untouched: the ledger never reads this.
create or replace function public.house_credits_contracts_end()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.ended_at is not null and old.ended_at is null then
    update public.place_payment_settings
       set house_credits = false,
           prepayments = false,
           voucher_200 = false, voucher_1000 = false, voucher_5000 = false,
           voucher_welcome = false, voucher_story = false, voucher_vip = false,
           updated_at = now()
     where place_id = new.place_id;
  end if;
  return new;
end;
$function$;

revoke all on function public.house_credits_contracts_end() from public, anon, authenticated;

-- MESITA-3599's Stripe guard also covers Mesita Prepayments turning On.
create or replace function public.place_payment_settings_stripe_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  turning_on boolean;
begin
  -- Born On, or any switch going Off -> On, needs the account.
  if tg_op = 'INSERT' then
    turning_on := new.pay_cards or new.card_cashback_bps is not null or new.prepayments
               or new.voucher_200 or new.voucher_1000 or new.voucher_5000
               or new.voucher_welcome or new.voucher_story or new.voucher_vip;
  else
    turning_on := (new.pay_cards and not old.pay_cards)
               or (new.card_cashback_bps is not null and old.card_cashback_bps is null)
               or (new.prepayments and not old.prepayments)
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
  before insert or update of pay_cards, card_cashback_bps, prepayments, voucher_200, voucher_1000, voucher_5000,
                             voucher_welcome, voucher_story, voucher_vip
  on public.place_payment_settings
  for each row execute function public.place_payment_settings_stripe_guard();

revoke all on function public.place_payment_settings_stripe_guard() from public, anon, authenticated;

comment on column public.place_payment_settings.prepayments is
  'MESITA-3597: Mesita Prepayments On/Off (Main §10). A voucher sells only when this AND its own voucher_* switch are on. On needs House Credits (check) and a Stripe Account taking cards (place_payment_settings_stripe_guard, and the set EF in the server''s mode).';
