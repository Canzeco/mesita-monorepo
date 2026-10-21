-- MESITA-2548: Diamond and Plan come back as two consumer facts, for the
-- identity card (Pato, 2026-10-21: "include the class, is super important to
-- include if its diamond or if its not. and then plan too … some users are
-- pro").
--
-- Two facts only — no ladder, no rates, no PINs (MESITA-2090/2145 dropped the
-- Second Stage machinery and stays dropped):
--   diamond  yes or no, granted BY HAND by invitation; never by followers,
--            never by paying (Pato, MESITA-2044/2046: "either you are diamond
--            or you are not").
--   plan     'free' or 'premium' (Premium is the app's word for "pro").
-- Both default to the plain state. Only the service role writes them: there
-- is no client UPDATE policy on consumers (dropped 20260706100000), and
-- consumer-web-update-profile never accepts either field.

alter table public.consumers
  add column if not exists diamond boolean not null default false;

alter table public.consumers
  add column if not exists plan text not null default 'free';

alter table public.consumers
  drop constraint if exists consumers_plan_check;
alter table public.consumers
  add constraint consumers_plan_check check (plan in ('free', 'premium'));

comment on column public.consumers.diamond is
  'MESITA-2548: Diamond, yes or no. Granted by hand by invitation (MESITA-2044); never by followers or by paying. Shown on the identity card (Me and Social). Service role writes only.';
comment on column public.consumers.plan is
  'MESITA-2548: the plan, free or premium. Shown on the identity card (Me and Social). Service role writes only.';

-- The two Social readers return both facts, so the person card can show them.
-- Their return type changes, so they are dropped and created again with the
-- same body and the same service-role-only grants.

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
  diamond boolean,
  plan text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.consumer_id, a.place_id, a.kind, a.created_at,
         c.first_name, c.avatar_url, c.instagram_handle,
         c.instagram_followers_count, c.diamond, c.plan
    from public.place_activity a
    join public.consumers c on c.id = a.consumer_id
   where not a.quiet
     and public.place_activity_visible(c)
   order by a.created_at desc
   limit least(greatest(p_limit, 1), 500)
$$;

drop function if exists public.place_activity_people(uuid, integer);
create function public.place_activity_people(
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
  diamond boolean,
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
       and not a.quiet
       and public.place_activity_visible(c)
     order by a.consumer_id, a.created_at desc
  )
  select l.consumer_id, l.kind, l.created_at,
         c.first_name, c.avatar_url, c.instagram_handle,
         c.instagram_followers_count, c.diamond, c.plan,
         count(*) over () as total
    from latest l
    join public.consumers c on c.id = l.consumer_id
   order by l.created_at desc
   limit greatest(p_limit, 1)
$$;

revoke execute on function public.place_activity_people(uuid, integer) from public, anon, authenticated;
revoke execute on function public.place_activity_feed(integer) from public, anon, authenticated;
grant execute on function public.place_activity_people(uuid, integer) to service_role;
grant execute on function public.place_activity_feed(integer) to service_role;
