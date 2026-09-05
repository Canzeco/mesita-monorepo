-- The Account / Organization / Place hierarchy (Pato gate, 2026-09-05).
--
--   managers ──M:N── organizations ──1:N── projects
--            organization_members          projects.organization_id
--
-- One place belongs to at most ONE organization. organization_id IS NULL
-- means the place sits in the PUBLIC POOL: any organization may claim it.
-- One account may be in many organizations; one organization holds many
-- accounts. Ownership verification is deliberately out for now, so a claim
-- is an assertion, not a proof — which is why claimed_by/claimed_at exist
-- below: release erases the link, and without provenance a squat would be
-- indistinguishable from a good-faith claim when verification arrives.
--
-- Why an organization and not just project_members: membership today is
-- Account ↔ PLACE (project_members, born as venue_members). That cannot
-- express "one organization holds many accounts" — two accounts would each
-- hold their own set of places, never a shared one.
--
-- ORGANIZATION IS THE LEGAL PERSON. legal_name/rfc/currency are here from
-- the start because the product already models it that way (the console's
-- Finances and Commercial both read the org as one RFC, one account); a
-- name-only table would be re-migrated within weeks.
--
-- ACCESS: checkMembership (functions/_shared/auth-membership.ts) resolves
-- project_members OR (organization_members ∧ projects.organization_id), and
-- the org path CAPS AT EDITOR. It must never resolve `owner`, because
-- place-ownership.ts isLastOwnerOfPlace counts project_members owner rows —
-- an org-derived owner counts 0 and would break ownership transfer and
-- member removal — and business-web-get-overview attaches the Staff Check
-- PIN on the owner branch.
--
-- Data at apply time: 23 places, 0 project_members rows, 1 manager, 0
-- payment accounts (verified 2026-09-05). Every place starts public with no
-- backfill, which is exactly the intended starting state.
--
-- LEDGER: applied through MCP apply_migration (the CLI could not reach the
-- pooler from the authoring sandbox). MCP stamps its own server-side
-- timestamp, so this FILENAME was renamed to match the stamped version
-- 20260905222953 rather than writing to schema_migrations by hand — repo
-- and ledger agree, and the next db push will not re-run it.

-- ── organizations ───────────────────────────────────────────────────────

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  legal_name  text,
  rfc         text,
  currency    text not null default 'MXN',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.organizations is
  'The legal person a business operates as: one organization = one RFC = one merchant. Holds many places (projects.organization_id) and many accounts (organization_members). EF-only (RLS, no policies; client privileges revoked).';
comment on column public.organizations.rfc is
  'Mexican tax ID. Nullable while ownership verification is out of scope; required before an organization can be paid.';

alter table public.organizations enable row level security;
revoke all on table public.organizations from public, anon, authenticated;
grant all on table public.organizations to service_role;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ── organization_members (Account ↔ Organization, many-to-many) ─────────

create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  manager_id      uuid not null references public.managers(id) on delete cascade,
  role            public.member_role not null default 'editor',
  created_at      timestamptz not null default now(),
  unique (organization_id, manager_id)
);

comment on table public.organization_members is
  'Account ↔ Organization. Unlike project_members (Account ↔ PLACE) there is no one-owner constraint: an organization may hold several owners. Place access derived from this table CAPS AT EDITOR — see auth-membership.ts.';

create index organization_members_org_idx     on public.organization_members (organization_id);
create index organization_members_manager_idx on public.organization_members (manager_id);

alter table public.organization_members enable row level security;
revoke all on table public.organization_members from public, anon, authenticated;
grant all on table public.organization_members to service_role;

-- ── projects.organization_id (NULL = public pool) ───────────────────────

alter table public.projects
  add column if not exists organization_id uuid
    references public.organizations(id) on delete restrict,
  add column if not exists claimed_by uuid
    references public.managers(id) on delete set null,
  add column if not exists claimed_at timestamptz;

comment on column public.projects.organization_id is
  'The organization that holds this place, or NULL for the PUBLIC POOL. on delete restrict on purpose: set null would dump a deleted organization''s whole portfolio into the claimable pool in one statement.';
comment on column public.projects.claimed_by is
  'Who claimed the place out of the public pool. Provenance, not authorization — ownership verification is a separate future gate.';

create index if not exists projects_organization_idx
  on public.projects (organization_id);

-- Post-flight: the shape must exist before any EF starts reading it.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name = 'organization_id'
  ) then
    raise exception 'projects.organization_id missing after migration';
  end if;
  if not exists (select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'organization_members') then
    raise exception 'organization_members missing after migration';
  end if;
end $$;

notify pgrst, 'reload schema';
