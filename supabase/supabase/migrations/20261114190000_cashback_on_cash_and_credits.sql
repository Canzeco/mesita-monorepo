-- MESITA-3944 (Pato, 2026-11-14): "CASHBACK AS CREDITS FOR CASH PAYMENTS IS
-- FUCKING OFF OR 3", then "enable Cashback as Credits for Credits Payments
-- ... 5% Recycle that shit".
--
-- Cash Payments Cashback: Off or 3% again, the place's choice
-- (business-web-set-payment accepts it; MESITA-3928 had refused it). Its
-- column and CHECK (null or 300) never changed, so nothing here.
--
-- Credits Payments Cashback: Off or 5% (it was Off or 2% under MESITA-3827,
-- then not offered). Only the CHECK moves; the insert trigger already stamps
-- the place's rate on each payment, and every place is Off today, so no row
-- needs a backfill. Any stray 2% left on is switched off rather than raised.
update public.place_payment_settings
   set credit_cashback_bps = null
 where credit_cashback_bps is not null and credit_cashback_bps <> 500;

alter table public.place_payment_settings
  drop constraint if exists place_payment_settings_credit_cashback_bps_check,
  add constraint place_payment_settings_credit_cashback_bps_check
    check (credit_cashback_bps is null or credit_cashback_bps = 500);

comment on column public.place_payment_settings.credit_cashback_bps is
  'MESITA-3827, MESITA-3944: Credits Payments Cashback, null = Off, else exactly 500 bps (5%) on the credit part of a bill only (never the tip). Live only while House Credits is on.';
