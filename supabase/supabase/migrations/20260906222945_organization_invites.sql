-- organization_invites (MESITA-1550) — email invites for the Organization
-- screen's Members box, mirroring project_invites structurally.
--
-- Unlike project_invites, `role` may be 'owner' here: organizations allow
-- several owners (organization_members' own comment), so there is no
-- transfer ceremony to protect against the way business-web-invite-member's
-- `invite_owner_forbidden` protects places. The guard that DOES matter —
-- never letting the org drop to zero owners — lives on organization_members
-- itself (see the companion migration, organization_members_owner_backstop).

create table public.organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  role            public.member_role not null default 'editor',
  token           text not null unique,
  created_by      uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '14 days'),
  claimed_at      timestamptz,
  claimed_by      uuid references auth.users(id) on delete set null
);

comment on table public.organization_invites is
  'Pending email invites into an organization. EF-only (RLS, no policies; client privileges revoked) — the token is the caller''s only access, never a row read. Mirrors project_invites; see business-web-accept-org-invite for the expiry/claim rules.';

create index organization_invites_org_idx on public.organization_invites (organization_id);

alter table public.organization_invites enable row level security;
revoke all on table public.organization_invites from public, anon, authenticated;
grant all on table public.organization_invites to service_role;

do $$
begin
  if not exists (select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'organization_invites') then
    raise exception 'organization_invites missing after migration';
  end if;
end $$;

notify pgrst, 'reload schema';
