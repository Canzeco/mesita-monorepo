-- MESITA-5060 — a share link says who shared it, so a share's new guests can
-- be counted (Pato, 2026-11-27: Share is "the cheapest CAC we will ever have").
--
-- Three EF-only tables (RLS on, no policy, client roles hold nothing):
--
--   share_codes    one opaque code per guest, carried as ?s=<code> on every
--                  share link. Not the member number: a member number finds
--                  a guest, and a link is handed to strangers.
--   share_opens    someone opened a link carrying a code. One row per code ×
--                  place × visitor (people, not taps). The visitor is a random
--                  id the browser made; no location, no account.
--   share_signups  a NEW account that arrived through a code. One row per new
--                  guest: the first code it opened wins, never its own.

create table public.share_codes (
  consumer_id uuid primary key references public.consumers (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{8}$'),
  created_at timestamptz not null default now()
);

comment on table public.share_codes is
  'MESITA-5060: a guest''s share code, ?s=<code> on their share links. EF-only.';

create table public.share_opens (
  id bigint generated always as identity primary key,
  code text not null references public.share_codes (code) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  visitor text not null check (visitor ~ '^[A-Za-z0-9_-]{8,64}$'),
  opened_at timestamptz not null default now()
);

-- One row per code × place × visitor; a link to the app itself has no place.
create unique index share_opens_once_idx
  on public.share_opens (code, coalesce(place_id, '00000000-0000-0000-0000-000000000000'::uuid), visitor);

comment on table public.share_opens is
  'MESITA-5060: a share link was opened. One row per code, place and browser. EF-only.';

create table public.share_signups (
  consumer_id uuid primary key references public.consumers (id) on delete cascade,
  sharer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid references public.places (id) on delete set null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  check (consumer_id <> sharer_id)
);

create index share_signups_sharer_idx on public.share_signups (sharer_id);

comment on table public.share_signups is
  'MESITA-5060: a new account that came through a share link; the first code wins. EF-only.';

alter table public.share_codes enable row level security;
alter table public.share_opens enable row level security;
alter table public.share_signups enable row level security;
revoke all on table public.share_codes, public.share_opens, public.share_signups from public, anon, authenticated;
grant all on table public.share_codes, public.share_opens, public.share_signups to service_role;
