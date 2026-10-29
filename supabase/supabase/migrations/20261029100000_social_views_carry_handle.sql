-- MESITA-3051: a view carries the member's Instagram too.
--
-- Pato, 2026-10-29, on Home › Social: "if has instagram don't mention the
-- name, mention the instgarma username instead". The feed now leads every
-- row with the @handle when the member shows their Instagram, so the handle
-- and followers ride on views as well as likes; this retires MESITA-2594's
-- "a view is never named". Who place_activity_visible lets through, and the
-- viewer-side masking in consumer-web-list-activity, are unchanged.
--
-- The body is the MESITA-2853 one minus `and a.kind <> 'viewed'`.

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
  instagram_followers_count integer,
  guest_class text,
  plan text,
  anonymous boolean,
  instagram boolean,
  lat double precision,
  lng double precision
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
           and c.instagram_verified_at is not null,
         a.lat,
         a.lng
    from public.place_activity a
    join public.consumers c on c.id = a.consumer_id
    cross join lateral (
      select public.place_activity_visible(c) as named,
             not c.appear_anonymous as shown
    ) v
   where not a.quiet
     and c.deleted_at is null
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

comment on function public.place_activity_feed(integer) is
  'Social''s feed (MESITA-2442). Every row carries the first name (MESITA-2612); the handle and followers on any event (a like or a view, MESITA-3051) by a member place_activity_visible lets through; the photo unless the member turned Public profile off; the event''s point (MESITA-2853), which the EF turns into km. service_role only.';

revoke execute on function public.place_activity_feed(integer) from public, anon, authenticated;
grant execute on function public.place_activity_feed(integer) to service_role;
