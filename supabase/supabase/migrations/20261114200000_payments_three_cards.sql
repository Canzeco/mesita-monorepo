-- MESITA-3946 (Pato, 2026-11-14): Business › Payments in three cards —
-- Stripe Account, Credits Account, Payments & Cashbacks — and "prepayments is
-- 2% or off, not 5%".
--
-- 1. App Prepayments Cashback-as-Credits: Off or 2% of a voucher's price (Off
--    or 5% under MESITA-3827/3928). A place left at 5% is switched Off; its
--    owner turns it on again at 2%. Vouchers already bought keep the rate they
--    stamped.
-- 2. Accept Stripe Payments: one switch over everything paid by card in the
--    app (App Payments and App Prepayments). Default On, so no place changes
--    until its owner switches it off. The Edge Functions read it through
--    _shared/money-state.ts; nothing here charges.

update public.place_payment_settings
   set prepay_cashback_bps = null
 where prepay_cashback_bps is not null and prepay_cashback_bps <> 200;

alter table public.place_payment_settings
  drop constraint if exists place_payment_settings_prepay_cashback_bps_check,
  add constraint place_payment_settings_prepay_cashback_bps_check
    check (prepay_cashback_bps is null or prepay_cashback_bps = 200);

comment on column public.place_payment_settings.prepay_cashback_bps is
  'MESITA-3827, MESITA-3946: App Prepayments Cashback, null = Off, else exactly 200 bps (2%) of a voucher''s price. Needs House Credits, App Prepayments and the Stripe Account.';

alter table public.place_payment_settings
  add column if not exists stripe_payments boolean not null default true;

comment on column public.place_payment_settings.stripe_payments is
  'MESITA-3946: Accept Stripe Payments. Off stops App Payments (pay_cards) and App Prepayments (prepayments) without touching either switch; credit and cash are unaffected.';
