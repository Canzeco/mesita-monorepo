-- MESITA-2594: a view is never named in Social.
--
-- Pato, 2026-10-21 (CEO review of the Instagram model, option A): only what a
-- member does on purpose carries their name. A `viewed` row is passive
-- browsing (opening a place profile); naming it published where a member
-- looked. Likes (`saved`) stay named as before (place_activity_visible).
--
-- * place_activity_feed: a viewed row is anonymous ("A member"), every
--   identifying field null, the same shape MESITA-2580 gave members without
--   Instagram. The row still shows; only the name goes.
-- * place_activity_people (the line under a place's title): likes only, so
--   it reads "Perdón and 3 others liked this".
-- * place_activity_liked_by (the person card): answers only for a like, so a
--   viewed event can never be traced back to its member's likes.
--
-- Live data at write time: 1 consumer.

drop function if exists public.place_activity_feed(integer);
create function public.place_activity_feed(
  p_limit integer default 200
) returns table (
  consumer_id uuid,
  place_id uuid,
  kind text,
  created_at timestamptz,
  first_name text,
  avatar_url text,
  instagram_handle text,
  instagram_followers_count integer,
  guest_class text,
  plan text,
  anonymous boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.consumer_id, a.place_id, a.kind, a.created_at,
         case when v.named then c.first_name end,
         case when v.named then c.avatar_url end,
         case when v.named then c.instagram_handle end,
         case when v.named then c.instagram_followers_count end,
         case when v.named then c.guest_class end,
         case when v.named then c.plan end,
         not v.named
    from public.place_activity a
    join public.consumers c on c.id = a.consumer_id
    cross join lateral (
      select public.place_activity_visible(c) and a.kind <> 'viewed' as named
    ) v
   where not a.quiet
     and c.deleted_at is null
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

revoke execute on function public.place_activity_feed(integer) from public, anon, authenticated;
grant execute on function public.place_activity_feed(integer) to service_role;

drop function if exists public.place_activity_people(uuid, integer);
create function public.place_activity_people(
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
  guest_class text,
  plan text,
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
       and a.kind = 'saved'
       and not a.quiet
       and public.place_activity_visible(c)
     order by a.consumer_id, a.created_at desc
  )
  select l.consumer_id, l.kind, l.created_at,
         c.first_name, c.avatar_url, c.instagram_handle,
         c.instagram_followers_count, c.guest_class, c.plan,
         count(*) over () as total
    from latest l
    join public.consumers c on c.id = l.consumer_id
   order by l.created_at desc
   limit greatest(p_limit, 1)
$$;

revoke execute on function public.place_activity_people(uuid, integer) from public, anon, authenticated;
grant execute on function public.place_activity_people(uuid, integer) to service_role;

create or replace function public.place_activity_liked_by(
  p_place_id uuid,
  p_kind text,
  p_at timestamptz,
  p_limit integer default 60
) returns table (
  place_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with who as (
    select c.id
      from public.place_activity e
      join public.consumers c on c.id = e.consumer_id
     where e.place_id = p_place_id
       and e.kind = p_kind
       and e.kind <> 'viewed'
       and e.created_at = p_at
       and not e.quiet
       and public.place_activity_visible(c)
     limit 1
  )
  select a.place_id, a.created_at
    from public.place_activity a
    join who on who.id = a.consumer_id
   where a.kind = 'saved'
     and not a.quiet
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 200)
$$;

revoke execute on function public.place_activity_liked_by(uuid, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.place_activity_liked_by(uuid, text, timestamptz, integer)
  to service_role;
