-- MESITA-2609: Social's person card lists that member's whole history, liked
-- and viewed, and opens from every row, the guest's own included.
--
-- Pato, 2026-10-21: "if i press profile link, then open the modal. i can even
-- click my own profile btw … below a list of notifications of exactly that
-- user … he clicked that or liked that place … just all the historic feed
-- scrollable".
--
-- place_activity_history_by REPLACES place_activity_liked_by (MESITA-2583):
-- given one feed event (place, kind, time), it finds the member behind it and
-- returns every one of their non-quiet rows, saved and viewed, newest first,
-- each carrying the member's fields under the naming rule a like has
-- (place_activity_visible: named with a verified Instagram and a public
-- profile, else "A member"), plus the face fields MESITA-2608 added. A view
-- is a door now (decision, MESITA-2609: the card may name the member the
-- feed row did not; reverses MESITA-2594's trace-back guard, reversible). A
-- member who chose "A member" (appear_anonymous) answers nothing.
--
-- Only readers change; no row is written.

drop function if exists public.place_activity_liked_by(uuid, text, timestamptz, integer);

create function public.place_activity_history_by(
  p_place_id uuid,
  p_kind text,
  p_at timestamptz,
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
  with who as (
    select c.*
      from public.place_activity e
      join public.consumers c on c.id = e.consumer_id
     where e.place_id = p_place_id
       and e.kind = p_kind
       and e.created_at = p_at
       and not e.quiet
       and c.deleted_at is null
       and not c.appear_anonymous
     limit 1
  )
  select a.consumer_id, a.place_id, a.kind, a.created_at,
         case when v.named then who.first_name end,
         who.avatar_url,
         case when v.named then who.instagram_handle end,
         case when v.named then who.instagram_followers_count end,
         who.guest_class,
         who.plan,
         not v.named,
         who.instagram_handle is not null and who.instagram_verified_at is not null
    from public.place_activity a
    join who on who.id = a.consumer_id
    cross join lateral (select public.place_activity_visible(who) as named) v
   where a.kind in ('saved', 'viewed')
     and not a.quiet
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

comment on function public.place_activity_history_by(uuid, text, timestamptz, integer) is
  'Social''s person card (MESITA-2609, replaces place_activity_liked_by): the member behind one feed event and every row of theirs, saved and viewed, newest first; named by place_activity_visible, the face always; nothing for a member who chose "A member". service_role only.';

revoke execute on function public.place_activity_history_by(uuid, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.place_activity_history_by(uuid, text, timestamptz, integer)
  to service_role;
