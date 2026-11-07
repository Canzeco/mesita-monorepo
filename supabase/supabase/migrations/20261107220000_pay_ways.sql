-- MESITA-3396: Ways to pay are the owner's switches (Pato, 2026-11-07, on
-- Business › Payments: "Update the fields asked here then"; the fields came
-- from the Wallet mock, MESITA-3391). Three more booleans on the place's
-- money switches, DEFAULT ON so no place changes behaviour when this lands:
--   pay_cash     informational: the place takes cash at the table (Mesita
--                never touches cash; nothing reads it beyond the page)
--   pay_cards    Digital Payments: a guest may pay by card here once the
--                Stripe account can charge
--   pay_credits  a guest may spend credit here; off also keeps every
--                voucher off sale (selling credit nobody can spend is wrong)
-- moneyState (_shared/money-state.ts) reads the last two; the table stays
-- EF-only (RLS on, no policy, service_role only).
alter table public.place_payment_settings
  add column if not exists pay_cash boolean not null default true,
  add column if not exists pay_cards boolean not null default true,
  add column if not exists pay_credits boolean not null default true;

comment on table public.place_payment_settings is
  'MESITA-3296/3396: which money products a place has on (Payments Cashback, the six Prepaid Vouchers) and its ways to pay (pay_cash, pay_cards, pay_credits, default on). No row means products off, ways on. EF-only.';
