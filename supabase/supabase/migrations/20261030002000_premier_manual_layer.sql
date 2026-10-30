-- MESITA-3091 — Premier (a): Manual Premier gets its own table (Pato,
-- 2026-10-29: "add another state … Manual Premier, Paid Premier … divide
-- manual premier from paid premier").
--
--   Manual Premier  Mesita's free lift: place_manual_premier (this file)
--   Paid Premier    what guests pay for: place_premier_periods (paid rows only)
--   places.boost_tier = greatest(running manual, running paid)
--
-- Until now an operator grant was a period with no payer, sharing the paid
-- timeline: it blocked purchases, and Multiple Places › Edit had to refuse
-- three guest cases (MESITA-3090). In two tables the layers never collide.
-- Paid never charges for a level Manual already gives: a claim at or below
-- the running Manual level is stale, and a renewal waits while Manual covers
-- the pledge's tier.
--
-- Data: 3 ended TEST grants on 2026-10-30, none running; they move to the
-- new table as history.

create extension if not exists btree_gist with schema extensions;

-- ── The table ────────────────────────────────────────────────────────────
create table public.place_manual_premier (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  tier smallint not null check (tier between 1 and 2),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  -- admin: Single Place / Multiple Places; code: a Mesita code (MESITA-3094).
  source text not null default 'admin' check (source in ('admin', 'code')),
  granted_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  constraint place_manual_premier_no_overlap
    exclude using gist (place_id with =, tstzrange(starts_at, ends_at) with &&)
);

create index place_manual_premier_place_idx on public.place_manual_premier (place_id, ends_at);

alter table public.place_manual_premier enable row level security;
revoke all on table public.place_manual_premier from public, anon, authenticated;
grant all on table public.place_manual_premier to service_role;

comment on table public.place_manual_premier is
  'MESITA-3091 Manual Premier: Mesita''s free lift of a place (tier 1 = 2X, 2 = 5X), never charged. Ending sets ends_at = now(). Rows never overlap per place. Written only by premier_grant / premier_end_grant / premier_set_grant. EF-only.';

-- ── Grants move out of the paid timeline ─────────────────────────────────
insert into public.place_manual_premier (place_id, tier, starts_at, ends_at, granted_by, created_at)
select place_id, tier, starts_at, ends_at, granted_by, created_at
  from public.place_premier_periods
 where backing_id is null and granted_by is not null
 order by place_id, starts_at
on conflict do nothing;

delete from public.place_premier_periods
 where backing_id is null and granted_by is not null;

comment on table public.place_premier_periods is
  'MESITA-2995 / MESITA-3091 Paid Premier periods: one row per paid stretch of a place. charging = a PaymentIntent whose outcome is not known yet; paid; declined (zero length); replaced (cut short by an upgrade); ended. Operator grants live in place_manual_premier since MESITA-3091. Written only by the premier_* RPCs. EF-only.';

-- ── The level of a place ─────────────────────────────────────────────────
create or replace function public.premier_manual_tier(p_place_id uuid)
 returns smallint
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce(max(tier), 0)::smallint
    from public.place_manual_premier
   where place_id = p_place_id and starts_at <= now() and ends_at > now();
$function$;

create or replace function public.recompute_place_boost(p_place_id uuid)
 returns smallint
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_paid smallint;
  v_tier smallint;
begin
  select p.tier into v_paid
    from public.place_premier_periods p
   where p.place_id = p_place_id
     and ((p.status = 'paid' and p.starts_at <= now() and p.ends_at > now())
       or (p.status = 'charging' and p.starts_at <= now() and p.starts_at > now() - interval '1 hour'))
   order by p.starts_at desc
   limit 1;

  v_tier := greatest(coalesce(v_paid, 0), public.premier_manual_tier(p_place_id));

  update public.places
     set boost_tier = v_tier
   where id = p_place_id
     and boost_tier is distinct from v_tier;

  return v_tier;
end;
$function$;

create or replace function public.place_manual_premier_recompute()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  perform public.recompute_place_boost(coalesce(new.place_id, old.place_id));
  return null;
end;
$function$;

create trigger place_manual_premier_recompute
  after insert or update or delete on public.place_manual_premier
  for each row execute function public.place_manual_premier_recompute();

create or replace function public.recompute_due_place_boosts()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id as place_id from public.places where boost_tier > 0
    union
    select place_id from public.place_premier_periods
     where status in ('paid', 'charging') and starts_at > now() - interval '70 minutes'
    union
    select place_id from public.place_manual_premier
     where starts_at > now() - interval '70 minutes'
  loop
    perform public.recompute_place_boost(r.place_id);
    n := n + 1;
  end loop;
  return n;
end;
$function$;

-- ── Operator writes: the manual table ────────────────────────────────────
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
  if exists (select 1 from public.place_manual_premier
              where place_id = p_place_id and starts_at <= now() and ends_at > now()) then
    raise exception 'premier_grant: Manual Premier is running' using errcode = 'P0001';
  end if;
  insert into public.place_manual_premier (place_id, tier, starts_at, ends_at, source, granted_by)
  values (p_place_id, p_tier, now(), now() + make_interval(months => p_months), 'admin', p_by)
  returning id into v_id;
  return v_id;
end;
$function$;

create or replace function public.premier_end_grant(p_place_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_place_id::text));
  update public.place_manual_premier
     set ends_at = now(), updated_at = now()
   where id = (select id from public.place_manual_premier
                where place_id = p_place_id and starts_at <= now() and ends_at > now()
                order by starts_at desc limit 1)
  returning id into v_id;
  if v_id is null then
    raise exception 'premier_end_grant: no running grant' using errcode = 'P0001';
  end if;
  return v_id;
end;
$function$;

-- MESITA-3090's bulk Edit, without its guest refusals: Manual and Paid are
-- separate, so setting Manual never starts, holds or ends a guest charge.
create or replace function public.premier_set_grant(
  p_place_id uuid,
  p_tier smallint,
  p_months integer,
  p_by text
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_state text;
  v_prev_tier smallint;
  v_prev_ends timestamptz;
  v_id uuid;
  v_ends timestamptz;
begin
  if p_tier is null or p_tier not between 0 and 2 then
    raise exception 'premier_set_grant: tier must be 0, 1 or 2, got %', p_tier using errcode = 'P0001';
  end if;
  if p_tier > 0 and (p_months is null or p_months not between 1 and 12) then
    raise exception 'premier_set_grant: months must be 1..12, got %', p_months using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_place_id::text));
  select state into v_state from public.places where id = p_place_id;
  if not found then
    raise exception 'premier_set_grant: no such place' using errcode = 'P0001';
  end if;
  if v_state = 'archived' then
    raise exception 'premier_set_grant: archived' using errcode = 'P0001';
  end if;

  select tier, ends_at into v_prev_tier, v_prev_ends
    from public.place_manual_premier
   where place_id = p_place_id and starts_at <= now() and ends_at > now()
   order by starts_at desc
   limit 1;
  if v_prev_tier is not null then
    perform public.premier_end_grant(p_place_id);
  end if;

  if p_tier = 0 then
    return jsonb_build_object(
      'result', case when v_prev_tier is null then 'already' else 'ended' end,
      'ends_at', null,
      'previous_tier', v_prev_tier,
      'previous_ends_at', v_prev_ends);
  end if;

  v_id := public.premier_grant(p_place_id, p_tier, p_months, p_by);
  select ends_at into v_ends from public.place_manual_premier where id = v_id;
  return jsonb_build_object(
    'result', 'granted',
    'ends_at', v_ends,
    'previous_tier', v_prev_tier,
    'previous_ends_at', v_prev_ends);
end;
$function$;

-- ── Paid never charges for a level Manual already gives ──────────────────
-- premier_claim (MESITA-2995) plus one rule: under the lock, a tier at or
-- below the running Manual level is stale (reason 'covered'); the caller
-- releases the hold, nothing is charged.
create or replace function public.premier_claim(
  p_backing_id uuid,
  p_quoted_period_id uuid,
  p_tier text,
  p_interval text,
  p_price_cents integer,
  p_credit_cents integer,
  p_extra_days integer,
  p_charged_cents integer,
  p_payment_intent_id text,
  p_checkout_session_id text,
  p_status text,
  p_livemode boolean
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_place uuid;
  v_running public.place_premier_periods;
  v_existing uuid;
  v_id uuid;
begin
  if p_status not in ('charging', 'paid') then
    raise exception 'premier_claim: status must be charging or paid';
  end if;

  select place_id into v_place from public.place_backings where id = p_backing_id;
  if v_place is null then
    return jsonb_build_object('result', 'missing');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_place::text));

  select id into v_existing
    from public.place_premier_periods
   where (p_payment_intent_id is not null and stripe_payment_intent_id = p_payment_intent_id)
      or (p_checkout_session_id is not null and stripe_checkout_session_id = p_checkout_session_id)
   limit 1;
  if v_existing is not null then
    return jsonb_build_object('result', 'settled', 'period_id', v_existing);
  end if;

  if public.premier_tier_rank(p_tier) <= public.premier_manual_tier(v_place) then
    return jsonb_build_object('result', 'stale', 'reason', 'covered');
  end if;

  if exists (select 1 from public.place_premier_periods
              where place_id = v_place and status = 'charging') then
    return jsonb_build_object('result', 'stale', 'reason', 'charging');
  end if;

  select * into v_running
    from public.place_premier_periods
   where place_id = v_place and status = 'paid'
     and starts_at <= now() and ends_at > now()
   order by starts_at desc
   limit 1
   for update;

  if (p_quoted_period_id is null and v_running.id is not null)
     or (p_quoted_period_id is not null and v_running.id is distinct from p_quoted_period_id)
     or (v_running.id is not null and public.premier_tier_rank(p_tier) <= v_running.tier) then
    return jsonb_build_object('result', 'stale', 'reason', 'quote');
  end if;

  if v_running.id is not null then
    update public.place_premier_periods
       set status = 'replaced', cut_from = ends_at, ends_at = now(), updated_at = now()
     where id = v_running.id;
  end if;

  insert into public.place_premier_periods (
    place_id, backing_id, tier, billing_interval, starts_at, ends_at,
    price_cents, credit_cents, extra_days, charged_cents,
    stripe_payment_intent_id, stripe_checkout_session_id, status, livemode
  ) values (
    v_place, p_backing_id, public.premier_tier_rank(p_tier), p_interval, now(),
    public.premier_interval_end(now(), p_interval, p_extra_days),
    p_price_cents, p_credit_cents, p_extra_days, p_charged_cents,
    p_payment_intent_id, p_checkout_session_id, p_status, coalesce(p_livemode, false)
  ) returning id into v_id;

  return jsonb_build_object('result', 'started', 'period_id', v_id);
end;
$function$;

-- premier_begin_renewal (MESITA-2995) plus one rule: while Manual covers
-- the top pledge's tier, nothing is charged; the pledge waits and the first
-- run after Manual drops below it charges.
create or replace function public.premier_begin_renewal(p_place_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_charging public.place_premier_periods;
  v_pledge public.place_backings;
  v_last timestamptz;
  v_start timestamptz;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_place_id::text));

  select * into v_charging
    from public.place_premier_periods
   where place_id = p_place_id and status = 'charging'
   order by created_at
   limit 1;
  if v_charging.id is not null then
    return jsonb_build_object('action', 'resolve', 'period_id', v_charging.id);
  end if;

  if exists (select 1 from public.place_premier_periods
              where place_id = p_place_id and status = 'paid' and ends_at > now()) then
    return jsonb_build_object('action', 'none');
  end if;

  select * into v_pledge
    from public.place_backings
   where place_id = p_place_id and status = 'ready' and stripe_payment_method_id is not null
   order by public.premier_tier_rank(tier) desc, queued_at asc
   limit 1;
  if v_pledge.id is null then
    return jsonb_build_object('action', 'none');
  end if;

  if public.premier_tier_rank(v_pledge.tier) <= public.premier_manual_tier(p_place_id) then
    return jsonb_build_object('action', 'none', 'reason', 'covered');
  end if;

  select max(ends_at) into v_last
    from public.place_premier_periods
   where place_id = p_place_id and status in ('paid', 'ended');
  v_start := case when v_last is not null and v_last > now() - interval '1 hour' then v_last else now() end;

  insert into public.place_premier_periods (
    place_id, backing_id, tier, billing_interval, starts_at, ends_at,
    price_cents, charged_cents, status
  ) values (
    p_place_id, v_pledge.id, public.premier_tier_rank(v_pledge.tier), v_pledge.billing_interval,
    v_start, public.premier_interval_end(v_start, v_pledge.billing_interval, 0),
    v_pledge.amount_cents, v_pledge.amount_cents, 'charging'
  ) returning id into v_id;

  return jsonb_build_object('action', 'charge', 'period_id', v_id, 'backing_id', v_pledge.id);
end;
$function$;

-- create or replace keeps grants; restate them so this file stands alone.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.premier_manual_tier(uuid)',
    'public.recompute_place_boost(uuid)',
    'public.place_manual_premier_recompute()',
    'public.recompute_due_place_boosts()',
    'public.premier_grant(uuid, smallint, integer, text)',
    'public.premier_end_grant(uuid)',
    'public.premier_set_grant(uuid, smallint, integer, text)',
    'public.premier_claim(uuid, uuid, text, text, integer, integer, integer, integer, text, text, text, boolean)',
    'public.premier_begin_renewal(uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke execute on function %s from anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;

-- The level may have changed for places whose grants just moved.
select public.recompute_due_place_boosts();

comment on column public.places.boost_tier is
  'MESITA-3091 Premier: 0 none, 1 2X, 2 5X — the higher of the running Manual Premier (place_manual_premier) and the paid period covering now (place_premier_periods, or a charge in flight for up to an hour). Written only by the two tables'' triggers and recompute_due_place_boosts.';
