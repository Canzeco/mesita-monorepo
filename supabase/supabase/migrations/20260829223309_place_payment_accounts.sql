-- Stripe Connect PLATFORM account layer (Pato gate 2026-08-29, all-A).
-- One connected account per place (1:1 — the reversible direction; a
-- restaurant group asking to share an account later means dropping the
-- unique, not un-sharing rows). The mirror of Stripe-derived capability:
-- the third leg of Pay-ready = places.mesita_pay_enabled (intent)
-- ∧ visits_config.payCard (global rail) ∧ charges_enabled+details_submitted
-- (THIS table). Law + literals: functions/_shared/stripe-connect.ts;
-- write door: functions/_shared/payment-account-doc.ts.
--
-- PLATFORM, not marketplace: typeless-Standard controller, requested
-- card_payments/transfers capabilities, DIRECT charges later — the place is
-- merchant of record, funds settle to the place, Mesita never holds funds
-- (the Ley Fintech IFPE shield). Discounts stay restaurant-funded bill
-- reductions, never platform-funded settlements.
--
-- Reset posture: wiped with places (FK cascade; admin_reset truncates with
-- cascade, so preservation is structurally impossible). Orphaned TEST-mode
-- Stripe accounts are accepted debris; resets do not exist in live mode.

create table public.place_payment_accounts (
  place_id uuid primary key references public.places(id) on delete cascade,
  stripe_account_id text not null unique,
  livemode boolean not null default false,
  charges_enabled boolean not null default false,
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  requirements_due jsonb not null default '[]'::jsonb,
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.place_payment_accounts is
  'Stripe Connect mirror, one row per place (PLATFORM posture: typeless-Standard controller + direct charges; place = merchant of record). EF-only (RLS, no policies; client privileges revoked). stripe_account_id is acct_... or mock_acct_<place_id>. livemode records which Stripe universe created the account - sourced from the key prefix or event.livemode, never from the Account object.';
comment on column public.place_payment_accounts.requirements_due is
  'Snapshot of the Stripe account requirements.currently_due array; [] when clear.';
comment on column public.place_payment_accounts.disabled_reason is
  'requirements.disabled_reason; null = not disabled.';

alter table public.place_payment_accounts enable row level security;
revoke all on table public.place_payment_accounts from public, anon, authenticated;
grant all on table public.place_payment_accounts to service_role;

create trigger place_payment_accounts_set_updated_at
  before update on public.place_payment_accounts
  for each row execute function public.set_updated_at();

-- Post-flight: the table must exist locked-down, or this apply aborts.
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'place_payment_accounts'
  ) then
    raise exception 'place_payment_accounts missing after apply';
  end if;
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'place_payment_accounts'
      and c.relrowsecurity
  ) then
    raise exception 'place_payment_accounts RLS not enabled after apply';
  end if;
end $$;

notify pgrst, 'reload schema';
