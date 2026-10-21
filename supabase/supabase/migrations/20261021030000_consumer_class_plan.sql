-- MESITA-2553: Plan and Class, two independent account fields (Pato, 2026-10-21).
--
--   plan         the subscription: 'free' or 'pro' (was 'premium', MESITA-2548).
--                Operator-set until a checkout exists; then it is derived from
--                the subscription, with an end date.
--   guest_class  partnership status: 'regular' (default) or 'vip'. VIP comes
--                through a partner (an agency, a creator deal); it is never sold
--                and never an upgrade to Pro. Replaces `diamond` (MESITA-2548).
--
-- Independent: any combination. Only the service role writes them, through
-- admin_set_guest_standing below; no consumer function accepts either.
-- Named `guest_class`, not `class`: `class` is a reserved word in TS/JSX.

-- (a)–(c) plan: premium → pro, under the new CHECK.
alter table public.consumers drop constraint if exists consumers_plan_check;
update public.consumers set plan = 'pro' where plan = 'premium';
alter table public.consumers
  add constraint consumers_plan_check check (plan in ('free', 'pro'));

-- (d)–(e) guest_class, carried from diamond.
alter table public.consumers
  add column if not exists guest_class text not null default 'regular';
alter table public.consumers drop constraint if exists consumers_guest_class_check;
alter table public.consumers
  add constraint consumers_guest_class_check check (guest_class in ('regular', 'vip'));
update public.consumers set guest_class = 'vip' where diamond;

-- (f) who granted VIP and when, and an operator-only note on where it came
-- from (never shown to guests, never a rule).
alter table public.consumers
  add column if not exists guest_class_set_at timestamptz,
  add column if not exists guest_class_set_by uuid references auth.users (id) on delete set null,
  add column if not exists guest_class_note text;
alter table public.consumers drop constraint if exists consumers_guest_class_note_check;
alter table public.consumers
  add constraint consumers_guest_class_note_check
  check (guest_class_note is null or char_length(guest_class_note) <= 280);

comment on column public.consumers.plan is
  'MESITA-2553: the subscription, free or pro. Independent of guest_class. Operator-set (admin_set_guest_standing) until a checkout exists; then derived from the subscription with an end date.';
comment on column public.consumers.guest_class is
  'MESITA-2553: partnership status, regular or vip. VIP comes through a partner, is never sold and never an upgrade to Pro. Independent of plan. Written only by admin_set_guest_standing.';
comment on column public.consumers.guest_class_set_at is
  'MESITA-2553: when an operator last changed guest_class. Null until then (and for VIPs carried from diamond).';
comment on column public.consumers.guest_class_set_by is
  'MESITA-2553: the operator (auth user) who last changed guest_class.';
comment on column public.consumers.guest_class_note is
  'MESITA-2553: operator-only note on where a VIP came from. Never shown to guests; never a rule.';

-- (f2) The one writer. One UPDATE: the audit stamp moves only when the class
-- actually changes, so two operators can never record the wrong one. A closed
-- account is skipped (no row comes back).
create or replace function public.admin_set_guest_standing(
  p_consumer uuid,
  p_guest_class text,
  p_plan text,
  p_note text,
  p_note_set boolean,
  p_actor uuid
) returns setof public.consumers
language sql
volatile
security definer
set search_path = public
as $$
  update public.consumers c
     set guest_class = coalesce(p_guest_class, c.guest_class),
         plan = coalesce(p_plan, c.plan),
         guest_class_note = case when p_note_set then p_note else c.guest_class_note end,
         guest_class_set_at = case
           when p_guest_class is not null and p_guest_class is distinct from c.guest_class
             then now() else c.guest_class_set_at end,
         guest_class_set_by = case
           when p_guest_class is not null and p_guest_class is distinct from c.guest_class
             then p_actor else c.guest_class_set_by end
   where c.id = p_consumer
     and c.deleted_at is null
  returning c.*
$$;

revoke execute on function public.admin_set_guest_standing(uuid, text, text, text, boolean, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_set_guest_standing(uuid, text, text, text, boolean, uuid)
  to service_role;

-- (g) The Social readers return guest_class instead of diamond.
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
  plan text
)
language sql
stable
security definer
set search_path = public
as $$
  select a.consumer_id, a.place_id, a.kind, a.created_at,
         c.first_name, c.avatar_url, c.instagram_handle,
         c.instagram_followers_count, c.guest_class, c.plan
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
       and not a.quiet
       and public.place_activity_visible(c)
     order by a.consumer_id, a.created_at desc
  )
  select l.consumer_id, l.kind, l.created_at,
         c.first_name, c.avatar_url, c.instagram_handle,
         c.instagram_followers_count, c.guest_class, c.plan,
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

-- (h) diamond goes. No CASCADE: a missed dependent must fail this loudly.
alter table public.consumers drop column if exists diamond;
