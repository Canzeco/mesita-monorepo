-- MESITA-4191 NO CASHBACKS (Pato, 2026-11-16: "I want to remove Cashbacks.
-- It complicates shit a lot. No cashbacks."). The guest side is Global
-- Discovery · Reservations Agent · Discounted Prepayments (MESITA-4190).
--
-- Every place's four Cashback-as-Credits rates go Off (null). Each writer of
-- a `cashback` entry reads its rate from these columns (stamped on the
-- payment or purchase row when it is written), so from here on every new
-- payment and voucher stamps 0 and mints nothing. business-web-set-payment
-- refuses to turn a rate back on (code cashback_gone).
--
-- decision: neutralise, don't drop. The columns, their CHECKs and the SQL
-- that reads them stay, so pgTAP keeps proving the ledger math on fixtures
-- and no money function is rewritten in the same change. Cashback entries
-- guests already hold stay spendable: credit never expires (2026-11-16).

update public.place_payment_settings
   set card_cashback_bps = null,
       cash_cashback_bps = null,
       credit_cashback_bps = null,
       prepay_cashback_bps = null,
       updated_at = now()
 where card_cashback_bps is not null
    or cash_cashback_bps is not null
    or credit_cashback_bps is not null
    or prepay_cashback_bps is not null;

comment on column public.place_payment_settings.card_cashback_bps is
  'MESITA-4191: always null (Off). Cashback is gone; business-web-set-payment refuses any rate. Kept so the ledger SQL and its pgTAP still read it.';
comment on column public.place_payment_settings.cash_cashback_bps is
  'MESITA-4191: always null (Off). Cashback is gone; business-web-set-payment refuses any rate. Kept so the ledger SQL and its pgTAP still read it.';
comment on column public.place_payment_settings.credit_cashback_bps is
  'MESITA-4191: always null (Off). Cashback is gone; business-web-set-payment refuses any rate. Kept so the ledger SQL and its pgTAP still read it.';
comment on column public.place_payment_settings.prepay_cashback_bps is
  'MESITA-4191: always null (Off). Cashback is gone; business-web-set-payment refuses any rate. Kept so the ledger SQL and its pgTAP still read it.';
