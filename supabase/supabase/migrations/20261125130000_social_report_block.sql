-- MESITA-4942: a guest reports or blocks another guest from Social.
-- The client names the event (place, kind, time). The function resolves
-- the member. EF-only, like place_reports.

create table public.social_reports (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  reported_id uuid not null references public.consumers (id) on delete cascade,
  reason text not null check (reason in ('harassment', 'spam', 'inappropriate', 'other')),
  note text check (note is null or char_length(note) between 1 and 500),
  created_at timestamptz not null default now()
);

comment on table public.social_reports is
  'MESITA-4942: a guest''s report on another guest, one row per send. EF-only.';

create index social_reports_recent_idx on public.social_reports (created_at desc);

alter table public.social_reports enable row level security;
revoke all on table public.social_reports from public, anon, authenticated;
grant all on table public.social_reports to service_role;

create table public.social_blocks (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  blocked_id uuid not null references public.consumers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (consumer_id, blocked_id),
  check (consumer_id <> blocked_id)
);

comment on table public.social_blocks is
  'MESITA-4942: guests this member no longer sees in Social. EF-only.';

alter table public.social_blocks enable row level security;
revoke all on table public.social_blocks from public, anon, authenticated;
grant all on table public.social_blocks to service_role;
