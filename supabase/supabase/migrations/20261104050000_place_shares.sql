-- MESITA-3206 — Business Views counts shares (Pato, 2026-11-03: "how many times someone
-- viewed and liked your profile and if they shared the profile").
--
-- One row per guest × place, like views and likes in place_activity: the count
-- is people, not taps, and a repeat share only moves shared_at. Its own table,
-- not a new place_activity kind, because Social's feed and history read that
-- table and a new kind could surface there. EF-only: RLS on, no policies, client
-- roles hold nothing. Shares made before this are not known, so it starts at 0.

create table public.place_shares (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  shared_at timestamptz not null default now(),
  primary key (consumer_id, place_id)
);

comment on table public.place_shares is
  'MESITA-3206: a guest shared this place. One row per guest per place; Business Views counts them. EF-only.';

create index place_shares_place_idx on public.place_shares (place_id);

alter table public.place_shares enable row level security;
revoke all on table public.place_shares from public, anon, authenticated;
grant all on table public.place_shares to service_role;
