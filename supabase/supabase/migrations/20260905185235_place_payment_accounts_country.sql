-- MESITA-1532 — Connect onboarding stops hardcoding country.
--
-- `accounts.create` was pinned to country: "MX", which was merely narrow while
-- the platform was Mexican and became WRONG once the platform account became
-- Canzeco, Inc. (US): Stripe enables cross-country onboarding per country in
-- Connect Settings, so the platform's country and the connected account's
-- country are two different questions.
--
-- Deliberately NOT NULL-able-with-a-default: a default would silently label
-- the first US account "MX". The column is nullable instead, and null means
-- "written before this migration" — which classifyExistingAccount treats as
-- "cannot mismatch" rather than "wrong". The table is empty today (zero rows),
-- so nothing is being backfilled or guessed.
--
-- The value stored is STRIPE's answer (account.country), never our request.

alter table public.place_payment_accounts
  add column if not exists country text;

alter table public.place_payment_accounts
  drop constraint if exists place_payment_accounts_country_iso;

alter table public.place_payment_accounts
  add constraint place_payment_accounts_country_iso
  check (country is null or country ~ '^[A-Z]{2}$');

comment on column public.place_payment_accounts.country is
  'ISO-3166-1 alpha-2 as Stripe reports it on the Account. Per-account PERMANENT: a later onboarding request naming a different country returns the existing row (use_country_mismatch) instead of minting a second account. Null = row predates MESITA-1532.';
