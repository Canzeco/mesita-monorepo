-- MESITA-4752 (Pato, 2026-11-23: "not ask about accept prepayments or accept
-- cash or accept credits in visit checkout. It's obvious they should. It's
-- all in."): cash is always accepted at the visit. Business Offers no longer
-- has an Accept Cash Payments switch, so every place takes cash, and a new
-- place starts with it on.

alter table public.place_payment_settings alter column cash_payments set default true;

update public.place_payment_settings set cash_payments = true where not cash_payments;

comment on column public.place_payment_settings.cash_payments is
  'MESITA-4752: always true; Business Offers has no switch for it (cash is always accepted at the visit). Kept as a column for the readers that check it.';
