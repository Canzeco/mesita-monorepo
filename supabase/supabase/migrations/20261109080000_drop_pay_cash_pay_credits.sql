-- MESITA-3409: drop place_payment_settings.pay_cash and pay_credits.
--
-- MESITA-3396 (20261107220000_pay_ways.sql) added three Ways to pay switches.
-- MESITA-3408 took two of them off Business › Payments: no switch may refuse a
-- guest's credit, and cash is not Mesita's to show. Since then no Edge Function
-- reads or writes either column (`_shared/payments.ts` drops them from every
-- row it reads; `dropped-column-refs.test.ts` now pins that no EF names them).
-- Every EF importing `_shared/payments.ts` was checked live before this
-- merged. No function, view or policy body names either column.
--
-- `pay_cards` stays: it is the Mesita Pay switch. `cashback` stays (MESITA-3411).
alter table public.place_payment_settings
  drop column if exists pay_cash,
  drop column if exists pay_credits;

comment on table public.place_payment_settings is
  'MESITA-3296/3396/3409: which money products a place has on (Payments Cashback, the six Prepaid Vouchers) and the Mesita Pay switch (pay_cards, default on). No row means products off, Mesita Pay on. EF-only.';
