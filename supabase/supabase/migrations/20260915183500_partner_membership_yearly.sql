-- Mesita Membership — the yearly subscription that makes an ORGANIZATION a
-- Partner (MESITA-1877, the Partner slice of MESITA-1868).
--
-- THE NAME. The thing you buy is the Membership; the thing you become is a
-- Partner. One purchase noun, one status noun — the badge, the pill and every
-- read stay `organizations.partnered`, and nothing below renames them.
--
-- THREE OBJECTS, and each one is the sibling of something that already exists:
--
--   org_plans                the third lookup table beside consumer_plans and
--                            place_plans. One row, `membership`. It gets its
--                            OWN row rather than borrowing place_plans.pro
--                            because stripe-billing.ts caches the provisioned
--                            price id back onto the lookup row: two catalog
--                            entries pointing at one row would each overwrite
--                            the other's id and re-provision on every call,
--                            forever, spawning a Stripe price per checkout.
--   partner_memberships      the Stripe mirror, shaped exactly like
--                            place_subscriptions down to the one-live partial
--                            index, so the webhook's reconcile reads the same.
--                            `partner_`, not `org_`: `organization_members`
--                            already means the PEOPLE in an organization, and
--                            an `organization_memberships` beside it would be
--                            read as its plural on sight.
--   organizations
--     .stripe_billing_customer_id
--                            the org's PLATFORM customer. NOT the Connect
--                            account in organization_payment_accounts: the org
--                            pays Mesita through this one and is paid by
--                            guests through that one, and conflating them
--                            would bill a restaurant on its own account.
--
-- RLS: enabled with NO policy — the deliberate EF-only lockdown every billing
-- table here already runs (place_subscriptions, consumer_plans, organizations).
-- Adding a policy would OPEN access; service-role EFs bypass RLS regardless.

-- ─── org_plans ──────────────────────────────────────────────────────────────

create table if not exists public.org_plans (
  key text primary key,
  label text not null,
  price_cents integer not null default 0,
  currency text not null default 'MXN',
  stripe_price_id text,
  created_at timestamptz not null default now()
);

comment on table public.org_plans is
  'Organization-level plan vocabulary, sibling of consumer_plans and place_plans. One row today: `membership`, the yearly Mesita Membership that makes the organization a Partner. price_cents is authoritative — stripe-billing.ts provisions the Stripe price from it and caches the id back into stripe_price_id.';
comment on column public.org_plans.stripe_price_id is
  'Cached Stripe price id, written by resolvePlanPrice. Re-verified against price_cents on every read, so a price change here self-heals in Stripe. Never hand-edit.';

-- MX$1,000 + IVA a year (Pato, 2026-09-15). The same number place_plans.pro
-- carries, because it is the same partnership — it just moved up to the org.
insert into public.org_plans (key, label, price_cents, currency)
values ('membership', 'Mesita Membership', 100000, 'MXN')
on conflict (key) do nothing;

alter table public.org_plans enable row level security;

-- A vocabulary table: a reset must not empty it (the registry is the door,
-- never a copy-paste into admin_reset_database's body).
insert into public.admin_reset_preserve (table_name, reason)
values (
  'org_plans',
  'organization plan vocabulary (membership) — the Stripe price is provisioned from it'
)
on conflict (table_name) do nothing;

-- ─── partner_memberships ───────────────────────────────────────────────

create table if not exists public.partner_memberships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  plan_key text not null references public.org_plans(key),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  state text not null check (
    state in ('incomplete', 'active', 'past_due', 'canceled', 'unpaid')
  ),
  price_cents integer,
  currency text not null default 'MXN',
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false
);

comment on table public.partner_memberships is
  'The Stripe mirror of an organization''s Mesita Membership. Billing, not entitlement: organizations.partnered is the fact every reader uses, and this table is what the webhook derives it from. Mirrors place_subscriptions exactly, including the one-live partial index.';

-- One live membership per organization — the invariant the webhook leans on
-- when it retires a leftover mock row before writing the real subscription.
create unique index if not exists partner_memberships_one_live
  on public.partner_memberships (organization_id)
  where state in ('active', 'past_due');

create index if not exists idx_partner_memberships_org
  on public.partner_memberships (organization_id);

alter table public.partner_memberships enable row level security;

-- ─── the organization's platform customer ───────────────────────────────────

alter table public.organizations
  add column if not exists stripe_billing_customer_id text;

comment on column public.organizations.stripe_billing_customer_id is
  'The organization''s customer on MESITA''s OWN Stripe account — how it pays us for the Membership. Distinct from organization_payment_accounts.stripe_account_id, the Connect account guests pay IT through. `mock_cus_*` is a placeholder written by MOCK_SUBSCRIPTION, never a real customer.';

create unique index if not exists organizations_stripe_billing_customer_id_key
  on public.organizations (stripe_billing_customer_id)
  where stripe_billing_customer_id is not null;

-- ─── shape assertions ───────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from public.org_plans where key = 'membership'
  ) then
    raise exception 'org_plans.membership missing after apply';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'organizations'
       and column_name = 'stripe_billing_customer_id'
  ) then
    raise exception 'organizations.stripe_billing_customer_id missing after apply';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'public'
       and indexname = 'partner_memberships_one_live'
  ) then
    raise exception 'partner_memberships_one_live missing after apply';
  end if;
end $$;
