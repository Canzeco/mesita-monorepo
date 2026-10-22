-- MESITA-2612: every member is named in Social by first name. "A member" is
-- gone from the feed and from the person card.
--
-- Pato, 2026-10-21, on a person card that read "A member": "who the fuck is a
-- member, remove that shit".
--
-- first_name now comes back on every row of a member who is not deleted: a
-- like or a view, Instagram or not, Public profile on or off. What stays
-- gated:
--   * instagram_handle and instagram_followers_count: only a like by a member
--     place_activity_visible lets through (a verified Instagram, Public
--     profile on), in the feed; any event of theirs on the card (MESITA-2609).
--   * avatar_url: blank for a member who turned Public profile off
--     (appear_anonymous). decision (MESITA-2612): that switch hides the
--     photo and the handle in Social, never the first name. Reversible.
-- `anonymous` keeps its column and now means "no handle on this row".
--
-- place_activity_history_by answers for every non-deleted member now, the
-- ones who turned Public profile off included (name, no photo, no handle).
-- place_activity_people (the line under a place's title) is unchanged.
--
-- Only readers change; no row is written.

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
         c.first_name,
         case when v.shown then c.avatar_url end,
         case when v.named then c.instagram_handle end,
         case when v.named then c.instagram_followers_count end,
         c.guest_class,
         c.plan,
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
  'Social''s feed (MESITA-2442). Every row carries the first name (MESITA-2612); the handle and followers only on a like by a member place_activity_visible lets through; the photo unless the member turned Public profile off. service_role only.';

revoke execute on function public.place_activity_feed(integer) from public, anon, authenticated;
grant execute on function public.place_activity_feed(integer) to service_role;

drop function if exists public.place_activity_history_by(uuid, text, timestamptz, integer);
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
     limit 1
  )
  select a.consumer_id, a.place_id, a.kind, a.created_at,
         who.first_name,
         case when not who.appear_anonymous then who.avatar_url end,
         case when v.named then who.instagram_handle end,
         case when v.named then who.instagram_followers_count end,
         who.guest_class,
         who.plan,
         not v.named,
         not who.appear_anonymous
           and who.instagram_handle is not null
           and who.instagram_verified_at is not null
    from public.place_activity a
    join who on who.id = a.consumer_id
    cross join lateral (select public.place_activity_visible(who) as named) v
   where a.kind in ('saved', 'viewed')
     and not a.quiet
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

comment on function public.place_activity_history_by(uuid, text, timestamptz, integer) is
  'Social''s person card (MESITA-2609): the member behind one feed event and every row of theirs, saved and viewed, newest first. Always the first name (MESITA-2612); the handle by place_activity_visible; the photo unless Public profile is off. service_role only.';

revoke execute on function public.place_activity_history_by(uuid, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.place_activity_history_by(uuid, text, timestamptz, integer)
  to service_role;
