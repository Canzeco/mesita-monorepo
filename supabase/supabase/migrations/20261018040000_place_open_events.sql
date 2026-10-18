-- ============================================================================
-- place_open_events — one row per explicit open of a Google-only result
-- (MESITA-2323).
--
-- consumer-web-create-place is get-or-create (MESITA-2298): a guest who taps
-- a Google-only card or a gray pin opens it through this one call. Until now
-- only a NEW create left a trace (place_creation_attempts, the quota ledger),
-- so nobody could count how many Google-only taps end in a Mesita profile,
-- or which places guests keep tapping. This ledger records every open with
-- its outcome:
--   existing  Mesita already held the google_place_id (incl. a lost race)
--   created   this open minted the place
--   refused   Creation's switch is off, or the guest's create quota is spent
--   failed    the create core answered an error
-- A row is written AFTER the outcome is known and never blocks the open.
-- Nothing here runs on a render, a prefetch or a pin tap.
--
-- EF-only table (service_role): RLS on, zero policies, the deliberate
-- lockdown pattern of place_creation_attempts. admin_reset_database's dynamic
-- wipe truncates it like every non-survivor table.
-- ============================================================================

create table if not exists public.place_open_events (
  id              bigint generated always as identity primary key,
  google_place_id text not null,
  consumer_id     uuid references auth.users(id) on delete set null,
  outcome         text not null
    check (outcome in ('existing', 'created', 'refused', 'failed')),
  -- The Mesita place the open landed on (existing or created); no FK, so a
  -- later delete keeps the history.
  place_id        uuid,
  -- Why a refused or failed open stopped (create_on_open_off, quota, …).
  code            text,
  caller          text not null,
  created_at      timestamptz not null default now()
);

comment on table public.place_open_events is
  'One row per explicit open of a Google-only result through consumer-web-create-place, with its outcome (existing · created · refused · failed). Read by admin-web-list-place-opens for Configurations › Creation. EF-only (service_role).';

create index if not exists place_open_events_created_idx
  on public.place_open_events (created_at desc);
create index if not exists place_open_events_gid_created_idx
  on public.place_open_events (google_place_id, created_at desc);

alter table public.place_open_events enable row level security;
revoke all on table public.place_open_events from public, anon, authenticated;
grant all on table public.place_open_events to service_role;
revoke all on sequence public.place_open_events_id_seq from public, anon, authenticated;
grant all on sequence public.place_open_events_id_seq to service_role;
