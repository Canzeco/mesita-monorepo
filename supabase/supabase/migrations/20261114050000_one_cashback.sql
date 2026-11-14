-- MESITA-3836 (Pato, 2026-11-13: "Should I also offer Cashback for credits
-- and cash or not really? because 2% is just nothing" → "okey, go"): ONE
-- CASHBACK, 5% on the card part paid with Mesita Payments. Cash Payments
-- Cashback, Credits Payments Cashback and Mesita Prepayments Cashback are
-- switched off at every place; the wallet SQL reads these columns and writes
-- nothing when they are null. business-web-set-payment refuses switching them
-- back on (409 not_offered). The columns, their CHECKs and the SQL that reads
-- them stay; cashback already earned stays.
update public.place_payment_settings
   set cash_cashback_bps = null,
       credit_cashback_bps = null,
       prepay_cashback_bps = null
 where cash_cashback_bps is not null
    or credit_cashback_bps is not null
    or prepay_cashback_bps is not null;
