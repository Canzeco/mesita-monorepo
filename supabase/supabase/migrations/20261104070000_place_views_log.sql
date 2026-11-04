-- MESITA-3213 — Business Views gets a chart and a log (Pato, 2026-11-03: "a bit
-- of analytcs at the top, and then the logs ... mentioning who say what ... based
-- that kinda of the current social feed").
--
-- No new table. One row per guest × place × action, as place_activity and
-- place_shares already store it, so a repeat moves that row forward: the log and
-- the chart read each guest's latest of each action.
--
-- WHO IS NAMED IS SOCIAL'S RULE (place_activity_feed, MESITA-3051): the first name
-- always; the photo unless Public profile is off; the handle and followers only
-- when place_activity_visible lets them through. A closed account and a backfilled
-- `quiet` save never appear: a quiet save's time is the backfill, not the tap.
--
-- All three functions are service_role only. consumer_id goes as far as the EF,
-- which drops it (MESITA-2460: a client never holds a member id).

create function public.place_views_events(p_place_id uuid)
returns table (consumer_id uuid, kind text, created_at timestamptz)
language sql
stable
set search_path = public
as $$
  select a.consumer_id, a.kind, a.created_at
    from public.place_activity a
    join public.consumers c on c.id = a.consumer_id
   where a.place_id = p_place_id
     and a.kind in ('viewed', 'saved')
     and not a.quiet
     and c.deleted_at is null
  union all
  select s.consumer_id, 'shared', s.shared_at
    from public.place_shares s
    join public.consumers c on c.id = s.consumer_id
   where s.place_id = p_place_id
     and c.deleted_at is null
$$;

comment on function public.place_views_events(uuid) is
  'MESITA-3213: what counts on Business Views'' chart and log. viewed, saved and shared; no closed account, no quiet save. service_role only.';

create function public.place_views_log(
  p_place_id uuid,
  p_before timestamptz default null,
  p_limit integer default 31
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
  anonymous boolean,
  instagram boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.consumer_id, e.kind, e.created_at,
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
    from public.place_views_events(p_place_id) e
    join public.consumers c on c.id = e.consumer_id
    cross join lateral (
      select public.place_activity_visible(c) as named,
             not c.appear_anonymous as shown
    ) v
   where p_before is null or e.created_at < p_before
   order by e.created_at desc, e.kind
   limit least(greatest(p_limit, 1), 200)
$$;

comment on function public.place_views_log(uuid, timestamptz, integer) is
  'MESITA-3213: Business Views'' log, newest first. Who is named follows place_activity_feed. service_role only.';

-- Every one of the last p_days days in the place's timezone, a day with nothing
-- included, so the chart never has to fill gaps.
create function public.place_views_days(
  p_place_id uuid,
  p_timezone text,
  p_days integer default 30
) returns table (day date, views bigint, likes bigint, shares bigint)
language sql
stable
security definer
set search_path = public
as $$
  with today as (
    select (now() at time zone p_timezone)::date as d
  ), days as (
    select (today.d - n)::date as day
      from today, generate_series(0, least(greatest(p_days, 1), 366) - 1) n
  )
  select days.day,
         count(*) filter (where e.kind = 'viewed'),
         count(*) filter (where e.kind = 'saved'),
         count(*) filter (where e.kind = 'shared')
    from days
    left join public.place_views_events(p_place_id) e
      on (e.created_at at time zone p_timezone)::date = days.day
   group by days.day
   order by days.day
$$;

comment on function public.place_views_days(uuid, text, integer) is
  'MESITA-3213: Business Views'' chart. Each guest counts once per action, on the day of their latest. service_role only.';

revoke execute on function public.place_views_events(uuid) from public, anon, authenticated;
revoke execute on function public.place_views_log(uuid, timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.place_views_days(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.place_views_events(uuid) to service_role;
grant execute on function public.place_views_log(uuid, timestamptz, integer) to service_role;
grant execute on function public.place_views_days(uuid, text, integer) to service_role;
