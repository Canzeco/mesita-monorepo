-- MESITA-4850 — Privacy levels: Private, Public, Public + Instagram. Pato,
-- 2026-11-24: "Yes, build it"; "minors have their accounts in private
-- automatically and cannot change that configuration. only ask for the year".
--
-- 1. consumers.social_private: the guest's own choice (false = Public).
-- 2. consumer_social_level(c): the one rule. private = chosen, no birth year,
--    or not surely 18 by the year alone (this year - birth year < 19);
--    instagram = verified and instagram_handle_shown; else public. Computed,
--    so a minor's lock cannot be written around.
-- 3. The three Social readers drop private members (past events included)
--    and carry name, photo, handle and the Instagram mark only for
--    'instagram'. They return birth_year and sex for the server to shape;
--    neither leaves an Edge Function raw.
-- 4. place_shown_handle follows the level. place_activity_visible and
--    place_views_log (Business) are unchanged: the levels are between guests.
--
-- Rollback: 20261122200000's bodies; drop consumer_social_level and the column.

alter table public.consumers add column social_private boolean not null default false;

comment on column public.consumers.social_private is
  'MESITA-4850: the guest chose Private. Read through consumer_social_level, which also makes minors and guests with no birth year private.';

create function public.consumer_social_level(c public.consumers)
returns text
language sql
stable
as $$
  select case
           when c.social_private
             or c.birth_year is null
             or extract(year from now() at time zone 'utc')::integer - c.birth_year < 19
             then 'private'
           when c.instagram_handle is not null
            and c.instagram_verified_at is not null
            and c.instagram_handle_shown is true
             then 'instagram'
           else 'public'
         end
$$;

comment on function public.consumer_social_level(public.consumers) is
  'MESITA-4850: private | public | instagram, what other guests see. Minors (not surely 18 by birth year) and guests with no birth year are always private. The same rule as _shared/social-level.ts. service_role only.';

revoke execute on function public.consumer_social_level(public.consumers) from public, anon, authenticated;
grant execute on function public.consumer_social_level(public.consumers) to service_role;

create or replace function public.place_shown_handle(c public.consumers)
returns text
language sql
stable
as $$
  select case
           when public.place_activity_visible(c)
            and public.consumer_social_level(c) = 'instagram'
             then c.instagram_handle
         end
$$;

comment on function public.place_shown_handle(public.consumers) is
  'The Instagram handle as others may see it: only at the instagram level (MESITA-4850; MESITA-4659 opt-in); else null. service_role only.';

drop function public.place_activity_feed(integer, timestamptz, uuid);
drop function public.place_activity_history_by(uuid, text, timestamptz, integer);

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
         case when v.named then c.first_name end,
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

comment on function public.place_activity_feed(integer, timestamptz, uuid) is
  'Social''s feed, newest first (MESITA-2442; pages MESITA-3220; one place MESITA-3417). MESITA-4850: private members never appear; name, photo, handle and mark only at the instagram level; birth_year and sex are for the server to shape. service_role only.';

revoke execute on function public.place_activity_feed(integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.place_activity_feed(integer, timestamptz, uuid) to service_role;

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
         case when v.named then who.first_name end,
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

comment on function public.place_activity_history_by(uuid, text, timestamptz, integer) is
  'Social''s person card (MESITA-2609). MESITA-4850: none for a private member; name, photo, handle and mark only at the instagram level. service_role only.';

revoke execute on function public.place_activity_history_by(uuid, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.place_activity_history_by(uuid, text, timestamptz, integer) to service_role;

create or replace function public.place_activity_people(
  p_place_id uuid,
  p_limit integer default 5
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
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    select distinct on (a.consumer_id)
           a.consumer_id, a.kind, a.created_at
      from public.place_activity a
      join public.consumers c on c.id = a.consumer_id
     where a.place_id = p_place_id
       and a.kind = 'saved'
       and not a.quiet
       and public.consumer_social_level(c) = 'instagram'
     order by a.consumer_id, a.created_at desc
  )
  select l.consumer_id, l.kind, l.created_at,
         c.first_name, c.avatar_url, public.place_shown_handle(c),
         c.instagram_followers_count, c.guest_class, c.plan,
         count(*) over () as total
    from latest l
    join public.consumers c on c.id = l.consumer_id
   order by l.created_at desc
   limit greatest(p_limit, 1)
$$;

comment on function public.place_activity_people(uuid, integer) is
  'The place profile''s people line: the latest like of each member at the instagram level (MESITA-4850), newest first, with the total. service_role only.';

revoke execute on function public.place_activity_people(uuid, integer) from public, anon, authenticated;
grant execute on function public.place_activity_people(uuid, integer) to service_role;
