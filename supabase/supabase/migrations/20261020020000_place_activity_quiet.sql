-- MESITA-2460 — Social v1 fix: saves made before Social stay private.
--
-- The first sync in each browser pushes the saves made before #2442 (which
-- promised "only in this browser") to the server. Those rows are written
-- quiet: they count for the owner's own Saved list but never appear in the
-- feed or a place's line. A real tap on the heart writes quiet = false.

alter table public.place_activity
  add column if not exists quiet boolean not null default false;

comment on column public.place_activity.quiet is
  'MESITA-2460: a backfilled pre-Social save — the owner''s Saved list reads it, the feed and place lines never do.';

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
       and not a.quiet
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
   where not a.quiet
     and public.place_activity_visible(c)
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

revoke execute on function public.place_activity_people(uuid, integer) from public, anon, authenticated;
revoke execute on function public.place_activity_feed(integer) from public, anon, authenticated;
grant execute on function public.place_activity_people(uuid, integer) to service_role;
grant execute on function public.place_activity_feed(integer) to service_role;
