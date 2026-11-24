-- MESITA-4863 — Guest Instagram exists only to unlock VIP. Pato, 2026-11-24.
-- No guest sees another guest's Instagram. Nothing stored is deleted.
--
-- 1. consumer_social_level is private | public: the instagram level is gone, so
--    the feed and the person card (named only at that level) carry no handle,
--    photo, followers or mark, and place_shown_handle is always null.
-- 2. place_activity_people names Public members by first name alone.
-- 3. VIP (consumer_instagram_prove, guest_class, the money rule) is unchanged.
--
-- Rollback: 20261124150000's level; 20261124113000's place_activity_people.

create or replace function public.consumer_social_level(c public.consumers)
returns text
language sql
stable
as $$
  select case
           when c.social_private
             or c.birth_year is null
             or extract(year from now() at time zone 'utc')::integer - c.birth_year < 19
             then 'private'
           else 'public'
         end
$$;
comment on function public.consumer_social_level(public.consumers) is
  'MESITA-4863: private | public, what other guests see. Minors (not surely 18 by birth year) and guests with no birth year are always private. Instagram is never shown to a guest. The same rule as _shared/social-level.ts. service_role only.';

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
       and c.deleted_at is null
       and public.consumer_social_level(c) = 'public'
     order by a.consumer_id, a.created_at desc
  )
  select l.consumer_id, l.kind, l.created_at,
         c.first_name, null::text, null::text, null::integer, c.guest_class, c.plan,
         count(*) over () as total
    from latest l
    join public.consumers c on c.id = l.consumer_id
   order by l.created_at desc
   limit greatest(p_limit, 1)
$$;
comment on function public.place_activity_people(uuid, integer) is
  'The place profile''s people line: the latest like of each Public member, first name alone (MESITA-4863), newest first, with the total. service_role only.';
revoke execute on function public.place_activity_people(uuid, integer) from public, anon, authenticated;
grant execute on function public.place_activity_people(uuid, integer) to service_role;
