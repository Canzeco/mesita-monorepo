-- MESITA-3296 — Business › Payments (Pato, 2026-11-06: "connect the Stripe
-- account with the Sandbox for the moment... make the website functional,
-- not payments yet").
--
--   place_payment_accounts  the place's Stripe Connect account, one per place:
--                           what Stripe says about it, mirrored on every read.
--                           Test mode until Pato flips STRIPE_MODE; agents
--                           never do. The place is the merchant of record and
--                           pays Stripe's fees; Stripe bears losses; Mesita
--                           never holds the money.
--   place_payment_settings  what the owner switched on: Payments Cashback, one
--                           switch, and the six Prepaid Vouchers, one each. No
--                           row = everything off. Rates, bonuses and prices are
--                           not here: they are still open with owners
--                           (MESITA-3272), so nothing charges yet.
--
-- EF-only tables: RLS on, no policies, client roles hold nothing.

create table public.place_payment_accounts (
  place_id uuid primary key references public.places (id) on delete cascade,
  stripe_account_id text not null unique,
  livemode boolean not null default false,
  -- As Stripe reports it; set for good when the account is created.
  account_country text,
  charges_enabled boolean not null default false,
  details_submitted boolean not null default false,
  payouts_enabled boolean not null default false,
  requirements_due jsonb not null default '[]'::jsonb,
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.place_payment_accounts is
  'MESITA-3296: the place''s Stripe Connect account, one per place, as Stripe last reported it. livemode is the key''s universe, never the Account object''s. EF-only.';

create table public.place_payment_settings (
  place_id uuid primary key references public.places (id) on delete cascade,
  cashback boolean not null default false,
  voucher_200 boolean not null default false,
  voucher_1000 boolean not null default false,
  voucher_5000 boolean not null default false,
  voucher_welcome boolean not null default false,
  voucher_story boolean not null default false,
  voucher_vip boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.place_payment_settings is
  'MESITA-3296: which money products a place has on: Payments Cashback and each of the six Prepaid Vouchers. No row means all off. Nothing charges yet. EF-only.';

alter table public.place_payment_accounts enable row level security;
alter table public.place_payment_settings enable row level security;
revoke all on table public.place_payment_accounts from public, anon, authenticated;
revoke all on table public.place_payment_settings from public, anon, authenticated;
grant all on table public.place_payment_accounts to service_role;
grant all on table public.place_payment_settings to service_role;

create trigger place_payment_accounts_set_updated_at
  before update on public.place_payment_accounts
  for each row execute function public.set_updated_at();

-- Post-flight: both tables exist locked down, or this apply aborts.
do $$
declare
  t text;
begin
  foreach t in array array['place_payment_accounts', 'place_payment_settings'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relrowsecurity
    ) then
      raise exception '% missing or RLS off after apply', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t) then
      raise exception '% must have no policies', t;
    end if;
  end loop;
end $$;
