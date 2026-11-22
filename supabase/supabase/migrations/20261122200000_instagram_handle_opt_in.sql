-- MESITA-4659 — No Public/Private Instagram; a handle shows only on opt-in; VIP
-- is checked when it is claimed. Pato, 2026-11-22: "Treat all linked Instagram
-- accounts the same. Guests choose whether to share their handle, and Mesita
-- displays it only when they explicitly opt in. Preserve existing sharing
-- choices and keep handles hidden when no choice was recorded."
--
-- 1. consumers.instagram_handle_shown: null = no choice = hidden; false = hide;
--    true = show. Backfill: a guest who turned Public profile off
--    (appear_anonymous) chose to hide, so false; everyone else stays null.
-- 2. guest_class no longer reads instagram_is_private (the column stays, still
--    written by verify/sync, read by nothing; dropping it is a follow-up).
-- 3. public.place_shown_handle(c): the one rule for showing a handle to others.
--    The four functions that return a handle call it; bodies are the live ones
--    (pg_get_functiondef, 2026-11-22) with only the handle output changed.
--    place_activity_people returned the handle unconditionally: now it too
--    follows the choice.
-- 4. consumer_instagram_verify stamps instagram_synced_at (it just read the
--    follower count: the VIP check's freshness, vouchers.ts vipRefusal) and
--    resets the choice whenever the handle on a row changes.
--
-- Rollback: 20261122160000's guest_class expression; the four bodies from
-- 20261108210000 / 20261122050000 / 20261021010000 (handle by
-- place_activity_visible); 20261117150000's verify; drop the function and the
-- column.

alter table public.consumers add column instagram_handle_shown boolean;

comment on column public.consumers.instagram_handle_shown is
  'MESITA-4659: "Show my handle on Mesita". true = others may see the Instagram handle; false or null (no choice) = hidden. Reset to null when the handle changes, on Disconnect and on account deletion. Read through place_shown_handle.';

update public.consumers
   set instagram_handle_shown = false
 where appear_anonymous;

alter table public.consumers
  alter column guest_class set expression as (
    case
      when instagram_verified_at is not null
       and coalesce(instagram_followers_count, 0) > 5000
        then 'vip'
      else 'regular'
    end
  );

comment on column public.consumers.guest_class is
  'Class (MESITA-3850, MESITA-4639, MESITA-4659): vip exactly when Instagram is verified and has more than 5,000 followers, else regular; privacy does not count. Generated; nothing writes it. A VIP claim also needs the count read within the hour (vouchers.ts).';

create function public.place_shown_handle(c public.consumers)
returns text
language sql
immutable
as $$
  select case
           when public.place_activity_visible(c) and c.instagram_handle_shown is true
             then c.instagram_handle
         end
$$;

comment on function public.place_shown_handle(public.consumers) is
  'MESITA-4659: the guest''s Instagram handle as others may see it: only when place_activity_visible and the guest opted in (instagram_handle_shown = true); else null. service_role only.';

revoke execute on function public.place_shown_handle(public.consumers) from public, anon, authenticated;
grant execute on function public.place_shown_handle(public.consumers) to service_role;

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
         public.place_shown_handle(c),
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
  'Social''s feed (MESITA-2442), newest first, older than p_before when given (MESITA-3220), one place''s when p_place_id is given (MESITA-3417). Every open is its own row (MESITA-3422: views from place_events, likes from place_activity). Every row carries the first name (MESITA-2612); the followers by place_activity_visible; the handle by place_shown_handle (MESITA-4659: opt-in); the photo unless Public profile is off. service_role only.';

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
         public.place_shown_handle(who),
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
  'Social''s person card (MESITA-2609): the member behind one feed event and every row of theirs, likes and each view (MESITA-3422), newest first. Always the first name (MESITA-2612); the handle by place_shown_handle (MESITA-4659: opt-in); the photo unless Public profile is off. service_role only.';

revoke execute on function public.place_activity_history_by(uuid, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.place_activity_history_by(uuid, text, timestamptz, integer)
  to service_role;

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
       and public.place_activity_visible(c)
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
  'The place profile''s people line: the latest like of each member place_activity_visible names, newest first, with the total. The handle by place_shown_handle (MESITA-4659: opt-in). service_role only.';

revoke execute on function public.place_activity_people(uuid, integer) from public, anon, authenticated;
grant execute on function public.place_activity_people(uuid, integer) to service_role;

create or replace function public.place_views_log(
  p_place_id uuid,
  p_before timestamptz default null,
  p_limit integer default 31,
  p_customer text default null
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
  instagram boolean,
  customer text
)
language sql
stable
security definer
set search_path = public
as $$
  select e.consumer_id, e.kind, e.created_at,
         c.first_name,
         case when v.shown then c.avatar_url end,
         public.place_shown_handle(c),
         case when v.named then c.instagram_followers_count end,
         c.guest_class,
         c.plan,
         not v.named,
         v.shown
           and c.instagram_handle is not null
           and c.instagram_verified_at is not null,
         public.place_customer_key(p_place_id, e.consumer_id)
    from public.place_views_events(p_place_id) e
    join public.consumers c on c.id = e.consumer_id
    cross join lateral (
      select public.place_activity_visible(c) as named,
             not c.appear_anonymous as shown
    ) v
   where (p_before is null or e.created_at < p_before)
     and (p_customer is null or public.place_customer_key(p_place_id, e.consumer_id) = p_customer)
   order by e.created_at desc, e.kind
   limit least(greatest(p_limit, 1), 200)
$$;

comment on function public.place_views_log(uuid, timestamptz, integer, text) is
  'MESITA-3213: Business Views'' log, newest first. Who is named follows place_activity_feed; the handle by place_shown_handle (MESITA-4659: opt-in). MESITA-4538: the per-place customer key out, an optional customer filter in. service_role only.';

revoke execute on function public.place_views_log(uuid, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.place_views_log(uuid, timestamptz, integer, text) to service_role;

-- The verifier: same signature (p_private is still written, read by nothing).
-- It just read the follower count, so it stamps instagram_synced_at (the VIP
-- claim's freshness). The sharing choice was about a handle: the row that loses
-- the handle and a row whose handle changes start hidden again.
create or replace function public.consumer_instagram_verify(
  p_consumer_id uuid,
  p_handle text,
  p_followers integer,
  p_private boolean default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.consumers
     set instagram_handle = null,
         instagram_followers_count = null,
         instagram_is_private = null,
         instagram_verified_at = null,
         instagram_handle_shown = null
   where instagram_handle = p_handle
     and id <> p_consumer_id;

  update public.consumers
     set instagram_handle_shown = case
           when instagram_handle is distinct from p_handle then null
           else instagram_handle_shown
         end,
         instagram_handle = p_handle,
         instagram_followers_count = p_followers,
         instagram_is_private = p_private,
         instagram_verified_at = now(),
         instagram_synced_at = now()
   where id = p_consumer_id;
  if not found then
    raise exception 'consumer % not found', p_consumer_id;
  end if;

  delete from public.consumer_instagram_claims
   where consumer_id = p_consumer_id;
end;
$$;

revoke execute on function public.consumer_instagram_verify(uuid, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.consumer_instagram_verify(uuid, text, integer, boolean) to service_role;
