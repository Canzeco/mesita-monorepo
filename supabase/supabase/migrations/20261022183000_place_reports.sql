-- MESITA-2684 — a guest reports a place (Pato, 2026-10-22: "three dots is a
-- button to report"). The place screen's three dots open Report: one reason,
-- and for Something else an optional note.
--
-- One live report per member × place: a second report replaces the first
-- (consumer-web-report-place upserts and moves created_at forward).
--
-- EF-only, like place_activity: RLS on, no policies, client roles hold
-- nothing. admin_reset_database wipes it like every non-survivor table.

create table public.place_reports (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  reason text not null check (reason in (
    'closed',
    'wrong_info',
    'wrong_location',
    'inappropriate_photos',
    'duplicate',
    'other'
  )),
  note text check (note is null or char_length(note) between 1 and 500),
  created_at timestamptz not null default now(),
  primary key (consumer_id, place_id)
);

comment on table public.place_reports is
  'MESITA-2684: a guest''s report on a place (the three dots, Report), one per consumer × place; a second replaces the first. EF-only (RLS, no policies; client privileges revoked).';

create index place_reports_place_idx
  on public.place_reports (place_id, created_at desc);
create index place_reports_recent_idx
  on public.place_reports (created_at desc);

alter table public.place_reports enable row level security;
revoke all on table public.place_reports from public, anon, authenticated;
grant all on table public.place_reports to service_role;
