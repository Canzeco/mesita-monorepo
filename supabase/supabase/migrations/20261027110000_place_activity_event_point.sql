-- MESITA-2853: every Social event remembers where it happened.
--
-- Pato, 2026-10-26, on Home › Social: "mention the distance from where the
-- event happened, not where the place is … if someone gives a like from x
-- geolocation, then compute the geolocation distance, obvously from the
-- backend".
--
-- place_activity gets lat/lng: the member's device fix when the like or view
-- was written (a re-open moves it with created_at). Null without a fix: the
-- event then shows no distance. consumer-web-list-activity measures the
-- viewer's point to this one and sends only the km, never the point.
--
-- place_activity_feed returns the two columns; its body is otherwise the
-- MESITA-2612 one.

alter table public.place_activity
  add column lat double precision,
  add column lng double precision,
  add constraint place_activity_event_point_check check (
    (lat is null) = (lng is null)
    and (lat is null or (lat between -90 and 90 and lng between -180 and 180))
  );

comment on column public.place_activity.lat is
  'Where the member''s device was when this event was written (MESITA-2853); null without a fix. Never sent to a client: the feed sends the km only.';
comment on column public.place_activity.lng is
  'See lat (MESITA-2853).';

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
      select public.place_activity_visible(c) and a.kind <> 'viewed' as named,
             not c.appear_anonymous as shown
    ) v
   where not a.quiet
     and c.deleted_at is null
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

comment on function public.place_activity_feed(integer) is
  'Social''s feed (MESITA-2442). Every row carries the first name (MESITA-2612); the handle and followers only on a like by a member place_activity_visible lets through; the photo unless the member turned Public profile off; the event''s point (MESITA-2853), which the EF turns into km. service_role only.';

revoke execute on function public.place_activity_feed(integer) from public, anon, authenticated;
grant execute on function public.place_activity_feed(integer) to service_role;
