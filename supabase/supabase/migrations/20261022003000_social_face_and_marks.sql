-- MESITA-2608: Social rows show the member's picture on every row, with an
-- Instagram mark and a VIP mark on the face.
--
-- Pato, 2026-10-21, on a Social tab that was a column of grey faces: "show the
-- profile picture but you must also show if instagram or something … if it is
-- vip, add small bubble at right of profile picture".
--
-- The feed still NAMES only what MESITA-2594 and MESITA-2580 name: a like by a
-- member with a verified Instagram and a public profile. first_name,
-- instagram_handle and instagram_followers_count stay null on every other
-- row, and `anonymous` still says so. What changes is the FACE: avatar_url,
-- guest_class, plan and a new `instagram` flag (a verified Instagram) now come
-- back on every row — a view, a member without Instagram — of a member who
-- did not choose "A member" (consumers.appear_anonymous, MESITA-2590). That
-- switch is the member's own choice and still blanks the whole row
-- (decision: MESITA-2608).
--
-- Only this reader changes; no row is written. Live data at write time: the
-- same handful of consumers MESITA-2594 saw.

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
  anonymous boolean,
  instagram boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select a.consumer_id, a.place_id, a.kind, a.created_at,
         case when v.named then c.first_name end,
         case when v.shown then c.avatar_url end,
         case when v.named then c.instagram_handle end,
         case when v.named then c.instagram_followers_count end,
         case when v.shown then c.guest_class end,
         case when v.shown then c.plan end,
         not v.named,
         v.shown
           and c.instagram_handle is not null
           and c.instagram_verified_at is not null
    from public.place_activity a
    join public.consumers c on c.id = a.consumer_id
    cross join lateral (
      select public.place_activity_visible(c) and a.kind <> 'viewed' as named,
             not c.appear_anonymous as shown
    ) v
   where not a.quiet
     and c.deleted_at is null
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

comment on function public.place_activity_feed(integer) is
  'Social''s feed (MESITA-2442). Names only a like by a member place_activity_visible lets through (MESITA-2580, MESITA-2594); since MESITA-2608 the face (avatar_url, guest_class, plan, instagram) comes back on every row of a member who did not choose "A member". service_role only.';

revoke execute on function public.place_activity_feed(integer) from public, anon, authenticated;
grant execute on function public.place_activity_feed(integer) to service_role;
