-- MESITA-3422 — every open is a view everywhere (Pato, 2026-11-08: "if someone sees
-- one profile twice, it counts as two view events, not one. two notifications
-- too", then "double notifications are okey").
--
-- place_events has stored each open since MESITA-3392 and Business reads it. The
-- guest readers still read place_activity, which keeps one view row per guest ×
-- place. They now take views from place_events and everything else (likes) from
-- place_activity, so two opens are two Social rows, two person-card rows and a
-- Mesita Views count of 2. Same signatures, same columns, same who-is-named rules.
-- A view's point is null: nothing reads it (MESITA-2946).
--
-- No burst limit (MESITA-3392: "it doesn't matter is fomeone clicked 5 times in
-- the same minute"). Enrich after N views still counts guests (place_requests).

create index if not exists place_events_viewed_recent_idx
  on public.place_events (created_at desc)
  where kind = 'viewed';

create or replace function public.place_activity_feed(
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
  with lim as (select least(greatest(p_limit, 1), 500) as n),
  ev as (
    (select e.consumer_id, e.place_id, 'viewed'::text as kind, e.created_at,
            null::double precision as lat, null::double precision as lng
       from public.place_events e
       join public.consumers c on c.id = e.consumer_id
      where e.kind = 'viewed'
        and c.deleted_at is null
        and (p_before is null or e.created_at < p_before)
        and (p_place_id is null or e.place_id = p_place_id)
      order by e.created_at desc
      limit (select n from lim))
    union all
    (select a.consumer_id, a.place_id, a.kind, a.created_at, a.lat, a.lng
       from public.place_activity a
       join public.consumers c on c.id = a.consumer_id
      where a.kind <> 'viewed'
        and not a.quiet
        and c.deleted_at is null
        and (p_before is null or a.created_at < p_before)
        and (p_place_id is null or a.place_id = p_place_id)
      order by a.created_at desc
      limit (select n from lim))
  )
  select ev.consumer_id, ev.place_id, ev.kind, ev.created_at,
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
         ev.lat,
         ev.lng
    from ev
    join public.consumers c on c.id = ev.consumer_id
    cross join lateral (
      select public.place_activity_visible(c) as named,
             not c.appear_anonymous as shown
    ) v
   order by ev.created_at desc
   limit (select n from lim)
$$;

comment on function public.place_activity_feed(integer, timestamptz, uuid) is
  'Social''s feed (MESITA-2442), newest first, older than p_before when given (MESITA-3220), one place''s when p_place_id is given (MESITA-3417). Every open is its own row (MESITA-3422: views from place_events, likes from place_activity). Every row carries the first name (MESITA-2612); the handle and followers by place_activity_visible; the photo unless Public profile is off. service_role only.';

revoke execute on function public.place_activity_feed(integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.place_activity_feed(integer, timestamptz, uuid) to service_role;

create or replace function public.place_activity_history_by(
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
  with hit as (
    -- The member behind one feed row: any of their views (place_events) or a
    -- like (place_activity) at that place and time.
    select e.consumer_id
      from public.place_events e
     where p_kind = 'viewed'
       and e.kind = 'viewed'
       and e.place_id = p_place_id
       and e.created_at = p_at
    union all
    select a.consumer_id
      from public.place_activity a
     where p_kind <> 'viewed'
       and a.kind = p_kind
       and a.place_id = p_place_id
       and a.created_at = p_at
       and not a.quiet
  ),
  who as (
    select c.*
      from hit
      join public.consumers c on c.id = hit.consumer_id
     where c.deleted_at is null
     limit 1
  ),
  hist as (
    select e.consumer_id, e.place_id, 'viewed'::text as kind, e.created_at
      from public.place_events e
      join who on who.id = e.consumer_id
     where e.kind = 'viewed'
    union all
    select a.consumer_id, a.place_id, a.kind, a.created_at
      from public.place_activity a
      join who on who.id = a.consumer_id
     where a.kind = 'saved'
       and not a.quiet
  )
  select r.consumer_id, r.place_id, r.kind, r.created_at,
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
    from hist r
    join who on who.id = r.consumer_id
    cross join lateral (select public.place_activity_visible(who) as named) v
   order by r.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

comment on function public.place_activity_history_by(uuid, text, timestamptz, integer) is
  'Social''s person card (MESITA-2609): the member behind one feed event and every row of theirs, likes and each view (MESITA-3422), newest first. Always the first name (MESITA-2612); the handle by place_activity_visible; the photo unless Public profile is off. service_role only.';

revoke execute on function public.place_activity_history_by(uuid, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.place_activity_history_by(uuid, text, timestamptz, integer)
  to service_role;

-- Mesita Views for one or many places: every open, no closed account, the same
-- count Business shows (place_views_events).
create function public.place_view_counts(p_place_ids uuid[])
returns table (place_id uuid, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select e.place_id, count(*)::bigint
    from public.place_events e
    join public.consumers c on c.id = e.consumer_id
   where e.place_id = any(p_place_ids)
     and e.kind = 'viewed'
     and c.deleted_at is null
   group by e.place_id
$$;

comment on function public.place_view_counts(uuid[]) is
  'MESITA-3422: Mesita Views per place, every open (place_events), no closed account. The Stats box and admin Single Place read it. service_role only.';

revoke execute on function public.place_view_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.place_view_counts(uuid[]) to service_role;
