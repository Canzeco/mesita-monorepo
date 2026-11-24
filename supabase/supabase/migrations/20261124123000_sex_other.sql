-- MESITA-4854: Sex takes Other (Pato, 2026-11-24: "in sex enable to put
-- other"); dropped in MESITA-727, narrowed by 20260825003000.
alter table public.consumers drop constraint if exists consumers_sex_check;
alter table public.consumers
  add constraint consumers_sex_check
  check (sex is null or sex = any (array['male'::text, 'female'::text, 'other'::text]));

-- A Public member's first name shows (Pato, 2026-11-24: "actually mention name
-- too. if private, then don't show anything"). Private members and minors
-- still never come back; photo, handle and mark stay at the instagram level.
-- 20261124113000's bodies, first_name alone changed.
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
  lng double precision,
  birth_year integer,
  sex text
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
        and public.consumer_social_level(c) <> 'private'
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
        and public.consumer_social_level(c) <> 'private'
        and (p_before is null or a.created_at < p_before)
        and (p_place_id is null or a.place_id = p_place_id)
      order by a.created_at desc
      limit (select n from lim))
  )
  select ev.consumer_id, ev.place_id, ev.kind, ev.created_at,
         c.first_name,
         case when v.named then c.avatar_url end,
         public.place_shown_handle(c),
         case when v.named then c.instagram_followers_count end,
         c.guest_class,
         c.plan,
         not v.named,
         v.named,
         ev.lat,
         ev.lng,
         c.birth_year::integer,
         c.sex::text
    from ev
    join public.consumers c on c.id = ev.consumer_id
    cross join lateral (
      select public.consumer_social_level(c) = 'instagram' as named
    ) v
   order by ev.created_at desc
   limit (select n from lim)
$$;

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
  instagram boolean,
  birth_year integer,
  sex text
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
    select c.*, public.consumer_social_level(c) as social_level
      from hit
      join public.consumers c on c.id = hit.consumer_id
     where c.deleted_at is null
       and public.consumer_social_level(c) <> 'private'
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
         case when v.named then who.avatar_url end,
         case when v.named then who.instagram_handle end,
         case when v.named then who.instagram_followers_count end,
         who.guest_class,
         who.plan,
         not v.named,
         v.named,
         who.birth_year::integer,
         who.sex::text
    from hist r
    join who on who.id = r.consumer_id
    cross join lateral (select who.social_level = 'instagram' as named) v
   order by r.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

comment on function public.place_activity_feed(integer, timestamptz, uuid) is
  'Social''s feed, newest first (MESITA-2442; pages MESITA-3220; one place MESITA-3417). Private members never appear; the first name shows at the public level (MESITA-4854), photo, handle and mark only at the instagram level (MESITA-4850); birth_year and sex are for the server to shape. service_role only.';
comment on function public.place_activity_history_by(uuid, text, timestamptz, integer) is
  'Social''s person card (MESITA-2609). None for a private member; the first name shows at the public level (MESITA-4854), photo, handle and mark only at the instagram level (MESITA-4850). service_role only.';
