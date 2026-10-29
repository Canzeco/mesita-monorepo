-- MESITA-3041: Premier is two plans, 2X and 5X (Pato: "Premier now is only
-- 10usd and 200 usd for 2x and 5x"). 10X is retired: every tier check
-- allows 2X and 5X only, the tier-name rank knows two names, and an
-- operator grant takes tier 1 or 2. Prices live in _shared/boost.ts.
--
-- No data moves: on 2026-10-28 no place, pledge or period held any Premier
-- tier. The guard below refuses to run if a 10X row has appeared since; the
-- migration is one transaction, so nothing is applied when it raises.

do $$
declare
  n_backings int;
  n_pending int;
  n_periods int;
  n_places int;
  ids text;
begin
  select count(*) into n_backings from public.place_backings where tier = 'boost_10x';
  select count(*) into n_pending from public.place_backings where pending_tier = 'boost_10x';
  select count(*) into n_periods from public.place_premier_periods where tier = 3;
  select count(*) into n_places from public.places where boost_tier = 3;
  if n_backings + n_pending + n_periods + n_places > 0 then
    select string_agg(id::text, ', ') into ids from (
      select id from public.place_backings where tier = 'boost_10x' or pending_tier = 'boost_10x'
      union all
      select id from public.place_premier_periods where tier = 3
      union all
      select id from public.places where boost_tier = 3
    ) r;
    raise exception 'premier 10X rows exist: place_backings %, pending_tier %, periods %, places % (%); expire them (open TEST Checkout sessions first) and re-run',
      n_backings, n_pending, n_periods, n_places, ids
      using errcode = 'P0001';
  end if;
end
$$;

-- ── The checks: two by name, two Postgres named ──────────────────────────
-- place_backings_tier_check and places_boost_tier_check were added by name
-- (20261027000000_place_boost.sql); the pending_tier and period tier checks
-- were inline (20261029030000_premier_line.sql), so they are found by table
-- and definition. A check not found raises: an old one left beside the new
-- one would keep 10X allowed.
alter table public.place_backings drop constraint if exists place_backings_tier_check;
alter table public.places drop constraint if exists places_boost_tier_check;

do $$
declare
  c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'public.place_backings'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%pending_tier%';
  if c is null then
    raise exception 'premier_two_tiers: no pending_tier check on place_backings' using errcode = 'P0001';
  end if;
  execute format('alter table public.place_backings drop constraint %I', c);

  select conname into c from pg_constraint
   where conrelid = 'public.place_premier_periods'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) like '%tier >= 1%';
  if c is null then
    raise exception 'premier_two_tiers: no tier check on place_premier_periods' using errcode = 'P0001';
  end if;
  execute format('alter table public.place_premier_periods drop constraint %I', c);
end
$$;

alter table public.place_backings
  add constraint place_backings_tier_check check (tier in ('boost_2x', 'boost_5x')),
  add constraint place_backings_pending_tier_check check (pending_tier in ('boost_2x', 'boost_5x'));
alter table public.place_premier_periods
  add constraint place_premier_periods_tier_check check (tier between 1 and 2);
alter table public.places
  add constraint places_boost_tier_check check (boost_tier between 0 and 2);

-- ── The rank: two names; NULL stays NULL, anything else raises ───────────
-- It orders a place's whole backer line, so a NULL must not throw; a name
-- it does not know is a fault, never a silent NULL (MESITA-3041).
create or replace function public.premier_tier_rank(p_tier text)
 returns smallint
 language plpgsql
 immutable
as $function$
begin
  if p_tier is null then
    return null;
  elsif p_tier = 'boost_2x' then
    return 1;
  elsif p_tier = 'boost_5x' then
    return 2;
  end if;
  raise exception 'premier_tier_rank: unknown tier %', p_tier using errcode = 'P0001';
end;
$function$;

-- ── An operator grant: tier 1 (2X) or 2 (5X) ─────────────────────────────
create or replace function public.premier_grant(
  p_place_id uuid,
  p_tier smallint,
  p_months integer,
  p_by text
)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if p_tier is null or p_tier not between 1 and 2 then
    raise exception 'premier_grant: tier must be 1 (2X) or 2 (5X), got %', p_tier using errcode = 'P0001';
  end if;
  if p_months is null or p_months not between 1 and 12 then
    raise exception 'premier_grant: months must be 1..12, got %', p_months using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_place_id::text));
  if exists (select 1 from public.place_premier_periods
              where place_id = p_place_id and status in ('paid', 'charging') and ends_at > now()) then
    raise exception 'premier_grant: a period is running' using errcode = 'P0001';
  end if;
  insert into public.place_premier_periods (
    place_id, tier, billing_interval, starts_at, ends_at, granted_by, status
  ) values (
    p_place_id, p_tier, 'month', now(), now() + make_interval(months => p_months), p_by, 'paid'
  ) returning id into v_id;
  return v_id;
end;
$function$;

-- create or replace keeps grants; restate them so this file stands alone.
revoke all on function public.premier_grant(uuid, smallint, integer, text) from public;
revoke execute on function public.premier_grant(uuid, smallint, integer, text) from anon, authenticated;
grant execute on function public.premier_grant(uuid, smallint, integer, text) to service_role;

comment on column public.places.boost_tier is
  'MESITA-3041 Premier: 0 none, 1 2X, 2 5X (10X retired) — the tier of the paid period covering now (place_premier_periods), or of a charge in flight for up to an hour. Written only by the period trigger and recompute_due_place_boosts. Paid, never verified.';
