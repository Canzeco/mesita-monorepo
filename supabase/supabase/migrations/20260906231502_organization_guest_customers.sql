-- MESITA-1414: Mesita Pay direct-charge gateway.
--
-- A guest's saved card lives on the PLATFORM Stripe account (consumers.
-- stripe_customer_id). Stripe's Direct-charge posture requires it CLONED
-- onto the place's organization's connected account first ("Share payment
-- methods across multiple accounts for direct charges": PaymentMethods.
-- create + Stripe-Account header). A bare clone is single-use — Stripe
-- consumes it on the first charge unless it's attached to a Customer on the
-- connected account first. Pato's decision (2026-09-02) accepts that
-- tradeoff deliberately: the guest gets one visible Customer record in the
-- restaurant's own Stripe dashboard (disclosed once in the consumer app),
-- so every visit reuses the SAME connected-account customer instead of
-- minting a fresh one and cluttering the dashboard with duplicates. A new
-- PaymentMethod is cloned and attached on every charge (clones can't be
-- reused once consumed), but the CUSTOMER they attach to is the durable,
-- cached identity this table exists to hold.

create table public.organization_guest_customers (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  consumer_id uuid not null references public.consumers(id) on delete cascade,
  -- Customer id on the CONNECTED (organization) Stripe account — distinct
  -- from consumers.stripe_customer_id, the PLATFORM customer this clones
  -- from.
  stripe_customer_id text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, consumer_id)
);

comment on table public.organization_guest_customers is
  'Cache of the connected-account (organization) Stripe Customer a guest was cloned onto, one per (organization, consumer) — repeat Mesita Pay charges reuse it instead of minting a new dashboard customer per visit. MESITA-1414.';
comment on column public.organization_guest_customers.stripe_customer_id is
  'Customer id on the ORGANIZATION''s connected Stripe account — not the platform customer (see consumers.stripe_customer_id).';

alter table public.organization_guest_customers enable row level security;
revoke all on table public.organization_guest_customers from public, anon, authenticated;
grant all on table public.organization_guest_customers to service_role;

create index organization_guest_customers_consumer_idx
  on public.organization_guest_customers (consumer_id);

-- Widen the ticket payment-method door: 'mesita' (MESITA-1114) stays
-- retired and 410s in the EF; 'mesita_pay' is the real gateway this issue
-- ships. Widening a CHECK, never narrowing — safe to drop and recreate
-- since the retired value was never written past its own cutover.
alter table public.visit_tickets drop constraint if exists visit_tickets_paid_method_kind;
alter table public.visit_tickets
  add constraint visit_tickets_paid_method_kind
  check (paid_method is null or paid_method in ('at_place', 'mesita', 'mesita_pay'));
