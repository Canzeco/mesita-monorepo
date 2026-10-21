-- MESITA-2583: Social's person card lists the places that member liked.
--
-- Pato, 2026-10-21: "the card contains just like the user and then the places
-- they liked and thats it. in one list. not when." Likes only (`saved`), never
-- views; quiet (backfilled pre-Social) saves stay out, as they do in the feed;
-- every place they liked, not only the ones near the viewer.
--
-- No member id reaches the client (MESITA-2460), so the card names the person
-- by the feed event it was opened from (place, kind, time). The member behind
-- that event is listed only if place_activity_visible names them (a verified
-- Instagram, not deleted): an anonymous member's event (MESITA-2580) returns
-- nothing, so their likes can never be tied together.

create function public.place_activity_liked_by(
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
