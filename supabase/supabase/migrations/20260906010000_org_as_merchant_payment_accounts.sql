-- MESITA-1545 — the merchant is the ORGANIZATION (decided 2026-09-05), and the
-- Stripe Connect mirror follows: place_payment_accounts (zero rows in every
-- environment — nothing to migrate) is re-keyed to the organization. One row
-- per organization; a place carries no money relationship of its own, so
-- releasing a place from an org no longer touches settlement at all.

alter table public.place_payment_accounts rename to organization_payment_accounts;
alter table public.organization_payment_accounts rename column place_id to organization_id;

alter table public.organization_payment_accounts
  rename constraint place_payment_accounts_pkey to organization_payment_accounts_pkey;
alter table public.organization_payment_accounts
  rename constraint place_payment_accounts_stripe_account_id_key
  to organization_payment_accounts_stripe_account_id_key;
alter table public.organization_payment_accounts
  rename constraint place_payment_accounts_country_iso
  to organization_payment_accounts_country_iso;

alter table public.organization_payment_accounts
  drop constraint place_payment_accounts_place_id_fkey;
alter table public.organization_payment_accounts
  add constraint organization_payment_accounts_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter trigger place_payment_accounts_set_updated_at
  on public.organization_payment_accounts
  rename to organization_payment_accounts_set_updated_at;

comment on table public.organization_payment_accounts is
  'Stripe Connect mirror for an ORGANIZATION — the merchant of record (MESITA-1545). One row per organization; stripe_account_id unique. EF-only (RLS enabled, no policies, on purpose).';
