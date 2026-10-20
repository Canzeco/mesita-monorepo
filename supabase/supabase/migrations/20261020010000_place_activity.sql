-- MESITA-2442 — Social v1: activity, not reviews (Pato, 2026-10-19).
--
-- Three events, one row per member × place × kind:
--   saved   the heart (Saved moves server-side; the browser keeps a cache)
--   viewed  opened the place profile (a re-open bumps created_at)
--   went    tapped "I went" on the profile
--
-- EF-only, like place_requests: RLS on, no policies, client roles hold
-- nothing. consumer-web-track-activity writes it; consumer-web-list-activity
-- reads it through the two functions below, which carry the one visibility
-- rule (Instagram connected + show_activity + not deleted) so no EF can
-- forget it.

create table public.place_activity (
  consumer_id uuid not null references public.consumers (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  kind text not null check (kind in ('saved', 'viewed', 'went')),
  created_at timestamptz not null default now(),
  primary key (consumer_id, place_id, kind)
);

comment on table public.place_activity is
  'Social v1 (MESITA-2442): saved · viewed · went, one row per consumer × place × kind. EF-only (RLS, no policies; client privileges revoked).';

create index place_activity_place_idx
  on public.place_activity (place_id, created_at desc);
create index place_activity_recent_idx
  on public.place_activity (created_at desc);

alter table public.place_activity enable row level security;
revoke all on table public.place_activity from public, anon, authenticated;
grant all on table public.place_activity to service_role;

-- "Show my activity" (Me › Settings). On by default; it only matters once
-- Instagram is connected, because nobody without a handle ever appears.
alter table public.consumers
  add column if not exists show_activity boolean not null default true;

comment on column public.consumers.show_activity is
  'Social v1 (MESITA-2442): false hides this member from every feed and place line. Only Instagram-connected members appear at all.';

-- Who may appear: one definition, used by both readers.
create or replace function public.place_activity_visible(c public.consumers)
returns boolean
language sql
immutable
as $$
  select c.instagram_handle is not null
     and c.show_activity
     and c.deleted_at is null
$$;

-- The people behind one place's line, newest first: one row per visible
-- member with their latest event on this place.
create or replace function public.place_activity_people(
  p_place_id uuid,
  p_limit integer default 5
) returns table (
  consumer_id uuid,
  kind text,
  created_at timestamptz,
  first_name text,
  avatar_url text,
  instagram_handle text,
  instagram_followers_count integer,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    select distinct on (a.consumer_id)
           a.consumer_id, a.kind, a.created_at
      from public.place_activity a
      join public.consumers c on c.id = a.consumer_id
     where a.place_id = p_place_id
       and public.place_activity_visible(c)
     order by a.consumer_id, a.created_at desc
  )
  select l.consumer_id, l.kind, l.created_at,
         c.first_name, c.avatar_url, c.instagram_handle,
         c.instagram_followers_count,
         count(*) over () as total
    from latest l
    join public.consumers c on c.id = l.consumer_id
   order by l.created_at desc
   limit greatest(p_limit, 1)
$$;

-- The feed: the newest visible events, everyone's, joined to who did them.
-- Grouping (same place + same verb) and the day/nearby order happen in the
-- EF, where they are unit-tested.
create or replace function public.place_activity_feed(
  p_limit integer default 200
) returns table (
  consumer_id uuid,
  place_id uuid,
  kind text,
  created_at timestamptz,
  first_name text,
  avatar_url text,
  instagram_handle text,
  instagram_followers_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select a.consumer_id, a.place_id, a.kind, a.created_at,
         c.first_name, c.avatar_url, c.instagram_handle,
         c.instagram_followers_count
    from public.place_activity a
    join public.consumers c on c.id = a.consumer_id
   where public.place_activity_visible(c)
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

revoke execute on function public.place_activity_people(uuid, integer) from public, anon, authenticated;
revoke execute on function public.place_activity_feed(integer) from public, anon, authenticated;
revoke execute on function public.place_activity_visible(public.consumers) from public, anon, authenticated;
grant execute on function public.place_activity_people(uuid, integer) to service_role;
grant execute on function public.place_activity_feed(integer) to service_role;
grant execute on function public.place_activity_visible(public.consumers) to service_role;
