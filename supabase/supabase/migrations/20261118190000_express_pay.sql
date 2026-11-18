-- MESITA-4384: Apple Pay and Google Pay for prepayments (express pay).
--
-- wallet_purchases.pay_source: how a purchase is paid. 'card' = a saved card
-- copied to the place's account and confirmed by the server (MESITA-3552);
-- 'express' = Stripe's Express Checkout Element (Apple Pay / Google Pay):
-- the server opens a PaymentIntent with no payment method and the browser
-- confirms it. Set at open on the basket lead and every follower; a replay
-- reads the lead's. Every existing row reads 'card'.
--
-- wallet_purchases.pay_with: which wallet paid an express purchase.
-- 'express' from open until the settle path reads the charge and rewrites
-- it to 'apple_pay' | 'google_pay' (one writer: _shared/purchase-pi.ts).
-- An abandoned express purchase keeps 'express'. Null on card purchases.
--
-- place_payment_accounts: whether mesita.ai is an active payment method
-- domain on the place's connected account, per wallet (Stripe needs each
-- domain registered per connected account and per environment for direct
-- charges). pm_domains_checked_at throttles the guest-path re-check to once
-- every 6 hours.

alter table public.wallet_purchases
  add column pay_source text not null default 'card',
  add column pay_with text;

alter table public.wallet_purchases
  add constraint wallet_purchases_pay_source_check check (pay_source in ('card', 'express')),
  add constraint wallet_purchases_pay_with_check check (
    pay_with is null or (pay_source = 'express' and pay_with in ('express', 'apple_pay', 'google_pay'))
  );

comment on column public.wallet_purchases.pay_source is
  'MESITA-4384: card (saved card, server confirms) | express (Apple Pay / Google Pay, browser confirms). Lead and followers alike.';
comment on column public.wallet_purchases.pay_with is
  'MESITA-4384: express | apple_pay | google_pay on an express purchase (express until settled); null on a card purchase.';

alter table public.place_payment_accounts
  add column apple_pay_domain_at timestamptz,
  add column google_pay_domain_at timestamptz,
  add column pm_domains_checked_at timestamptz;

comment on column public.place_payment_accounts.apple_pay_domain_at is
  'MESITA-4384: when Stripe first said mesita.ai is an active Apple Pay domain on this account; null = not (yet).';
comment on column public.place_payment_accounts.google_pay_domain_at is
  'MESITA-4384: when Stripe first said mesita.ai is an active Google Pay domain on this account; null = not (yet).';
comment on column public.place_payment_accounts.pm_domains_checked_at is
  'MESITA-4384: the last payment-method-domain check from the guest path (at most every 6 h).';

-- The kill switch: app_config.money_config.express_wallets (default both
-- wallets; [] turns express off; a list narrows it).
update public.app_config
  set money_config = money_config || '{"express_wallets": ["apple_pay", "google_pay"]}'::jsonb
  where not (money_config ? 'express_wallets');
