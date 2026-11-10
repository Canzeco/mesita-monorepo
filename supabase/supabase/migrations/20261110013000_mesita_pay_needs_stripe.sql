-- MESITA-3599 — Mesita Pay, its Cashback-as-Credits and every Prepaid
-- Voucher need the place's Stripe account to take cards (Pato, 2026-11-10:
-- "neither Mesita Pay nor Mesita Payments can be enabled without the Stripe
-- Account").
--
-- Before this, `pay_cards` defaulted On: a place with no Stripe account
-- showed Mesita Pay On with "Needs Stripe". Now:
--   1. the column defaults Off (no row reads Off too: settingsFromRow);
--   2. every place without a charging Stripe account is turned Off once:
--      Mesita Pay, its card cashback and the six vouchers;
--   3. a guard refuses turning any of them On without a charging account.
--
-- SQL cannot see the server's payments mode (PAYMENTS_STRIPE_MODE), so the
-- guard asks for an account with charges_enabled in either mode; the set EF
-- (business-web-set-payment) asks for the exact mode. The guard checks only
-- the turn to On: turning Off, and an unrelated update, never re-check, and
-- Stripe later pausing charges never flips a stored switch (the read-time
-- gate, money-state, already shows guests nothing then).

alter table public.place_payment_settings alter column pay_cards set default false;

update public.place_payment_settings s
   set pay_cards = false,
       card_cashback_bps = null,
       voucher_200 = false, voucher_1000 = false, voucher_5000 = false,
       voucher_welcome = false, voucher_story = false, voucher_vip = false,
       updated_at = now()
 where not exists (
         select 1 from public.place_payment_accounts a
          where a.place_id = s.place_id and a.charges_enabled
       )
   and (pay_cards or card_cashback_bps is not null
        or voucher_200 or voucher_1000 or voucher_5000
        or voucher_welcome or voucher_story or voucher_vip);

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
    turning_on := new.pay_cards or new.card_cashback_bps is not null
               or new.voucher_200 or new.voucher_1000 or new.voucher_5000
               or new.voucher_welcome or new.voucher_story or new.voucher_vip;
  else
    turning_on := (new.pay_cards and not old.pay_cards)
               or (new.card_cashback_bps is not null and old.card_cashback_bps is null)
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
    raise exception 'needs_stripe: Mesita Pay, its cashback and the vouchers need a Stripe account that takes cards'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;

create trigger place_payment_settings_stripe_guard
  before insert or update of pay_cards, card_cashback_bps, voucher_200, voucher_1000, voucher_5000,
                             voucher_welcome, voucher_story, voucher_vip
  on public.place_payment_settings
  for each row execute function public.place_payment_settings_stripe_guard();

revoke all on function public.place_payment_settings_stripe_guard() from public, anon, authenticated;

comment on column public.place_payment_settings.pay_cards is
  'MESITA-3396/3599: the Mesita Pay switch (the key is never renamed). Default Off; On only while the place''s Stripe account has charges_enabled (place_payment_settings_stripe_guard, and the set EF in the server''s mode).';
