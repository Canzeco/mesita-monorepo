-- ============================================================================
-- admin_operator_events — operator lifecycle ledger (MESITA-2745).
--
-- One row per completed admin action (Create · Update · Enrich · Edit), written
-- AFTER the outcome is known and never blocking the action. EF-only
-- (service_role). admin_reset_database truncates it like place_open_events.
-- ============================================================================

create table if not exists public.admin_operator_events (
  id              bigint generated always as identity primary key,
  verb            text not null
    check (verb in ('create', 'update', 'enrich', 'edit')),
  outcome         text not null
    check (outcome in ('succeeded', 'failed')),
  place_id        uuid,
  actor_user_id   uuid references auth.users (id) on delete set null,
  source          text not null,
  detail          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.admin_operator_events is
  'Platform admin lifecycle actions (Create · Update · Enrich · Edit) for Activity › Logs and Analytics. EF-only (service_role).';

create index if not exists admin_operator_events_created_idx
  on public.admin_operator_events (created_at desc);
create index if not exists admin_operator_events_verb_created_idx
  on public.admin_operator_events (verb, created_at desc);

alter table public.admin_operator_events enable row level security;
revoke all on table public.admin_operator_events from public, anon, authenticated;
grant all on table public.admin_operator_events to service_role;
revoke all on sequence public.admin_operator_events_id_seq from public, anon, authenticated;
grant all on sequence public.admin_operator_events_id_seq to service_role;
