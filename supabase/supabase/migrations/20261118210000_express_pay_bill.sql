-- MESITA-4386: Apple Pay and Google Pay on Pay Bill.
--
-- wallet_payments.pay_source: how a card part is paid. 'card' = a saved card
-- copied to the place's account and confirmed by the server (MESITA-3563);
-- 'express' = Stripe's Express Checkout Element (Apple Pay / Google Pay): the
-- server opens a manual-capture PaymentIntent with no payment method, the
-- browser confirms it with Face ID / Google (the hold), and the waiter's code
-- captures it like a held card (MESITA-3856). Every existing row reads 'card'.
--
-- wallet_payments.pay_with: 'express' from open until the hold or the
-- capture reads the charge and writes 'apple_pay' | 'google_pay'. Null on a
-- card part.

alter table public.wallet_payments
  add column pay_source text not null default 'card',
  add column pay_with text;

alter table public.wallet_payments
  add constraint wallet_payments_pay_source_check check (pay_source in ('card', 'express')),
  add constraint wallet_payments_pay_with_check check (
    pay_with is null or (pay_source = 'express' and pay_with in ('express', 'apple_pay', 'google_pay'))
  );

comment on column public.wallet_payments.pay_source is
  'MESITA-4386: card (saved card, server confirms) | express (Apple Pay / Google Pay, the browser confirms the hold).';
comment on column public.wallet_payments.pay_with is
  'MESITA-4386: express | apple_pay | google_pay on an express card part (express until held); null on a card part.';
