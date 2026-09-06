-- RECOVERED FROM THE CLOUD (MESITA-1594). This file did not exist in the repo.
--
-- The change below was applied to the singleton on 2026-08-23 09:21:28 and has
-- been live ever since, recorded only in supabase_migrations.schema_migrations.
-- `supabase/` never carried it, so the repo has not been the source of truth
-- for this change for two weeks — I-5 in name only.
--
-- The body is reproduced verbatim from the ledger row, and the filename carries
-- that row's exact version so the CLI matches the two and never re-applies it.
-- Nothing here runs again; this file exists so the schema's history is readable
-- from the repo, and so `db push` stops refusing on a missing local file.
--
-- Cause, for the record: this was applied ad-hoc through the MCP
-- `apply_migration` tool, which stamps its own timestamp and writes a NAMED
-- ledger row. `supabase db push` writes rows with a null name. That is how the
-- two halves of this ledger tell each other apart, and how the drift is
-- diagnosable at all.

-- Membership go-live v1 prep (MESITA-1154), P1 items 2-4. Go-live itself
-- (the real Stripe yearly product, live mode) stays human-gated — nothing
-- here touches Stripe or MOCK_SUBSCRIPTION.
--
-- Deliberately does NOT touch public.profiles (the projects join places view +
-- its two INSTEAD OF triggers) — that surface has already caused one outage
-- from a stale-snapshot rewrite (20260823074536) and every read of
-- PLACE_PUBLIC_COLUMNS/PLACE_BUSINESS_COLUMNS fails at plan time if the view
-- and _shared/place-columns.ts disagree. New columns below are read either
-- straight off public.projects (business-web-update-cfdi,
-- membership-enforcement.ts's loadMembershipRow, which already bypasses the
-- view) or off new standalone tables. Consequence: the CFDI fields and the
-- reward-lane pending-review hold do not appear in MyPlace / the consumer
-- wire payload yet -- ticket creation is still hard-gated (see
-- assessPromoLane), only the business Promos UI / consumer badge staleness
-- is deferred. Follow-up to thread both through profiles, mirroring how
-- MESITA-1150 fixed the same staleness class for strikes/pauses.

-- item 2: CFDI intake (RFC / razon social / CP)
-- Intake only -- no invoice generation, no Facturama integration. Founding
-- cohort gets facturas manual; automate later.
alter table public.projects
  add column if not exists cfdi_rfc text,
  add column if not exists cfdi_razon_social text,
  add column if not exists cfdi_cp text;

alter table public.projects
  add constraint projects_cfdi_rfc_shape
    check (cfdi_rfc is null or cfdi_rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$');
alter table public.projects
  add constraint projects_cfdi_razon_social_len
    check (cfdi_razon_social is null or length(cfdi_razon_social) between 1 and 200);
alter table public.projects
  add constraint projects_cfdi_cp_shape
    check (cfdi_cp is null or cfdi_cp ~ '^[0-9]{5}$');

comment on column public.projects.cfdi_rfc is
  'MESITA-1154 item 2: RFC for CFDI billing, shape-validated only (not SAT-verified). Intake for manual invoicing.';
comment on column public.projects.cfdi_razon_social is
  'MESITA-1154 item 2: razon social for CFDI billing.';
comment on column public.projects.cfdi_cp is
  'MESITA-1154 item 2: billing postal code (5 digits) for CFDI.';

-- item 3: ghost-partner detection consequence
-- consumer-web-report-ticket + admin-web-list-notifications already carry the
-- REPORT half (guest files "discount not honored", operator sees it as
-- evidence, MESITA-851). What was missing: a verified-refusal consequence.
-- The warn-first strike ladder (membership_strikes / project_strikes) is
-- calibrated for nuisance, not the fatal ghost-partner risk -- this is a
-- SEPARATE, instant hold, cleared only by admin review, layered in front of
-- that ladder (assessPromoLane checks it first).
alter table public.projects
  add column if not exists reward_lane_pending_review_at timestamptz;

comment on column public.projects.reward_lane_pending_review_at is
  'MESITA-1154 item 3: instant reward-lane removal pending admin review, set by admin-web-review-ticket-report on a confirmed guest refusal report. Checked first in assessPromoLane, ahead of the strike ladder. Cleared by the same EFs restore action once admin finishes investigating.';

alter table public.ticket_reports
  add column if not exists outcome text
    check (outcome is null or outcome in ('confirmed_refusal', 'not_confirmed'));

comment on column public.ticket_reports.outcome is
  'MESITA-1154 item 3: admin verdict once reviewed. confirmed_refusal triggers reward_lane_pending_review_at + a guest_make_goods row; not_confirmed is a plain dismissal.';

-- Guest make-good: an OBLIGATION ledger, not a payment rail. Mesita-funded
-- (never the place's money) compensation for a guest whose refusal report
-- was confirmed. Fulfillment is a manual ops action for now (same
-- "automate later" posture as CFDI invoicing) -- this table exists so the
-- promise is tracked and auditable rather than a comment nobody checks.
create table if not exists public.guest_make_goods (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ticket_report_id uuid not null references public.ticket_reports(id) on delete cascade,
  consumer_id uuid not null references public.consumers(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'fulfilled')),
  fulfilled_at timestamptz,
  fulfilled_by uuid,
  notes text check (notes is null or length(notes) <= 1000)
);

comment on table public.guest_make_goods is
  'MESITA-1154 item 3: Mesita-funded guest make-good obligations from a confirmed ghost-partner refusal. One per ticket_reports row. Written only by admin-web-review-ticket-report; fulfillment is a manual ops action, not automated.';

create unique index if not exists guest_make_goods_one_per_report
  on public.guest_make_goods (ticket_report_id);

create index if not exists guest_make_goods_project_idx
  on public.guest_make_goods (project_id, created_at desc);

alter table public.guest_make_goods enable row level security;
-- EF-only lockdown (no policies) -- same pattern as project_strikes / ticket_reports.

-- item 4: founding guarantee (90-day pro-rata refund, admin-adjudicated)
-- Refund ENDS the membership (plan -> free); never comps to free. Actual
-- Stripe refund issuance stays a manual admin action via the Stripe
-- dashboard -- this table tracks the request/approval/downgrade, never calls
-- Stripe. Rule 11: no automatic refund execution.
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_by uuid not null,
  reason text check (reason is null or length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_notes text check (admin_notes is null or length(admin_notes) <= 1000),
  -- Ops stamps this manually after issuing the refund by hand in the Stripe
  -- dashboard. Nothing in this codebase writes it automatically.
  stripe_refund_completed_at timestamptz
);

comment on table public.refund_requests is
  'MESITA-1154 item 4: founding-guarantee pro-rata refund requests. Admin-adjudicated; approval downgrades plan to free via the same code path as a voluntary drop. Never comps to free. Stripe refund issuance is a manual dashboard action, tracked here, never called from this codebase.';

create unique index if not exists refund_requests_one_pending_per_project
  on public.refund_requests (project_id)
  where status = 'pending';

create index if not exists refund_requests_project_idx
  on public.refund_requests (project_id, created_at desc);

alter table public.refund_requests enable row level security;
-- EF-only lockdown (no policies) -- same pattern as ticket_reports.

notify pgrst, 'reload schema';
