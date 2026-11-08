-- MESITA-3417 (Pato: "add a section for social … social is just the
-- notifications for one given place"): the place screen's Social tab reads
-- the same feed, filtered to one place. p_place_id defaults to null, so the
-- Edge Function deployed ahead of this PR keeps working until the new one
-- lands. Same columns, same who-is-named rules.

drop function public.place_activity_feed(integer, timestamptz);

create function public.place_activity_feed(
  p_limit integer default 200,
  p_before timestamptz default null,
  p_place_id uuid default null
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
     and (p_before is null or a.created_at < p_before)
     and (p_place_id is null or a.place_id = p_place_id)
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

comment on function public.place_activity_feed(integer, timestamptz, uuid) is
  'Social''s feed (MESITA-2442), newest first, older than p_before when given (MESITA-3220), one place''s when p_place_id is given (MESITA-3417). Every row carries the first name (MESITA-2612); the handle and followers on any event (a like or a view, MESITA-3051) by a member place_activity_visible lets through; the photo unless the member turned Public profile off; the event''s point (MESITA-2853), which never leaves the server. service_role only.';

revoke execute on function public.place_activity_feed(integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.place_activity_feed(integer, timestamptz, uuid) to service_role;
