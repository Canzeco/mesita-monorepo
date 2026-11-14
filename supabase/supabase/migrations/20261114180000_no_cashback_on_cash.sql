-- MESITA-3928 (Pato, 2026-11-14): "App Payments: 5% Fee. 5% Back to user.
-- Cash Payments: 0% Fee. 0% Back to user. App Prepayment. 5% Fee. 5% Back to
-- user." Cashback only where Mesita's fee is: Cash Payments Cashback goes off
-- at every place (it was 3% under MESITA-3837), and business-web-set-payment
-- refuses switching it back on (409 not_offered). App Prepayments Cashback
-- (5% of a voucher's price) can be switched on again; no place is switched on
-- here. The column, its CHECK and the SQL that reads it stay; cashback already
-- earned stays.
update public.place_payment_settings
   set cash_cashback_bps = null
 where cash_cashback_bps is not null;
