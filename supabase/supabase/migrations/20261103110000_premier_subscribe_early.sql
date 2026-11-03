-- MESITA-3165 — Premier: subscribe early (Pato, 2026-11-03, Design D7/D11,
-- Eng re-review F1/F2/F5). In the last 7 days of the back-to-back run of
-- Refill days at or above tier T, a place with no subscription and no paid
-- period running may subscribe at T: the card is saved now (the shipped
-- resume path, Checkout in setup mode) and first charged when the days end.
--
--   - premier_run_end(place, tier): the end of that run, or null when no
--     Refill row at or above the tier runs now (twin of runEndAtOrAbove in
--     _shared/boost.ts).
--   - premier_early_window(place, tier): the run ends within 7 calendar days
--     in the place's time zone (place_profiles.timezone, UTC when empty or
--     unknown).
--   - premier_make_payer, the one path to `ready`, is the authority: a new
--     resume pledge whose tier the Refill days cover, while no paid period
--     runs, becomes ready with early_start only inside the window; outside
--     it answers `covered`. premier_claim is unchanged: a claim starts a
--     period now, which would burn paid days under the cover.
--   - premier_begin_renewal never ends an early-start pledge that has not
--     paid yet as dormant `covered`; it charges it when the cover ends.
--
-- 0 pledges and 0 periods live on 2026-11-03 (Stripe TEST).

-- ── Column ───────────────────────────────────────────────────────────────
alter table public.place_backings
  add column early_start boolean not null default false;

comment on column public.place_backings.early_start is
  'MESITA-3165: this pledge was saved in the last 7 days of Refill days at or above its tier (subscribe early). Until it has paid once it is never ended as dormant `covered`; the first charge runs when the Refill days end.';

-- ── The run of Refill days at or above a tier ────────────────────────────
create or replace function public.premier_run_end(p_place_id uuid, p_tier smallint)
 returns timestamptz
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_cursor timestamptz := now();
begin
  for r in
    select starts_at, ends_at
      from public.place_manual_premier
     where place_id = p_place_id and tier >= p_tier
       and ends_at > now() and ends_at > starts_at
     order by starts_at
  loop
    exit when r.starts_at > v_cursor;
    v_cursor := greatest(v_cursor, r.ends_at);
  end loop;
  return case when v_cursor > now() then v_cursor end;
end;
$function$;

create or replace function public.premier_early_window(p_place_id uuid, p_tier smallint)
 returns boolean
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare
  v_end timestamptz := public.premier_run_end(p_place_id, p_tier);
  v_tz text;
begin
  if v_end is null then
    return false;
  end if;
  select nullif(timezone, '') into v_tz from public.place_profiles where id = p_place_id;
  if v_tz is null or not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;
  return (v_end at time zone v_tz)::date - (now() at time zone v_tz)::date <= 7;
end;
$function$;

comment on function public.premier_early_window(uuid, smallint) is
  'MESITA-3165: true when the back-to-back Refill days at or above the tier end within 7 calendar days in the place''s time zone (subscribe early).';

-- ── The one path to `ready`, with the early-start window ─────────────────
create or replace function public.premier_make_payer(p_backing_id uuid, p_payment_method text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.place_backings;
  v_detach text[];
  v_early boolean := false;
begin
  select * into v from public.place_backings where id = p_backing_id;
  if v.id is null then
    return jsonb_build_object('result', 'missing');
  end if;

  perform pg_advisory_xact_lock(hashtext(v.place_id::text));
  select * into v from public.place_backings where id = p_backing_id for update;
  if v.status = 'ended' then
    return jsonb_build_object('result', 'ended');
  end if;

  if exists (select 1 from public.place_premier_periods
              where place_id = v.place_id and status = 'charging'
                and backing_id is distinct from p_backing_id) then
    return jsonb_build_object('result', 'charging');
  end if;

  -- Subscribe early: a new resume pledge whose level the Refill days give,
  -- on a place with no paid period running.
  if v.status = 'open' and v.checkout_kind = 'resume'
     and public.premier_tier_rank(v.tier) <= public.premier_manual_tier(v.place_id)
     and not exists (select 1 from public.place_premier_periods
                      where place_id = v.place_id and status = 'paid' and ends_at > now()) then
    if not public.premier_early_window(v.place_id, public.premier_tier_rank(v.tier)) then
      return jsonb_build_object('result', 'covered');
    end if;
    v_early := true;
  end if;

  with gone as (
    update public.place_backings
       set status = 'ended', ended_reason = 'taken_over', ended_at = now(),
           checkout_kind = null, updated_at = now()
     where place_id = v.place_id and status = 'ready' and id <> p_backing_id
    returning stripe_payment_method_id
  )
  select coalesce(array_agg(stripe_payment_method_id) filter (where stripe_payment_method_id is not null), '{}')
    into v_detach
    from gone;

  update public.place_backings
     set status = 'ready',
         stripe_payment_method_id = coalesce(p_payment_method, stripe_payment_method_id),
         queued_at = case when status = 'ready' then queued_at else now() end,
         early_start = early_start or v_early,
         updated_at = now()
   where id = p_backing_id;

  return jsonb_build_object('result', 'ready', 'detach', to_jsonb(v_detach), 'early_start', v_early);
end;
$function$;

-- ── Renewal: an early start waits for the cover to end ──────────────────
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
  v_span interval;
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
   order by queued_at asc
   limit 1;
  if v_pledge.id is null then
    return jsonb_build_object('action', 'none');
  end if;

  select max(ends_at) into v_last
    from public.place_premier_periods
   where place_id = p_place_id and status in ('paid', 'ended');

  if public.premier_tier_rank(v_pledge.tier) <= public.premier_manual_tier(p_place_id) then
    -- Subscribed early and not charged yet: it waits for the Refill days to
    -- end, however many are added (MESITA-3165).
    if v_pledge.early_start and not exists (
         select 1 from public.place_premier_periods
          where backing_id = v_pledge.id and status in ('paid', 'replaced', 'ended')) then
      return jsonb_build_object('action', 'none', 'reason', 'covered');
    end if;
    -- Covered for longer than one interval since anything was paid (or since
    -- the pledge stood): it ends, so a dormant card is never charged later.
    -- (The interval is a variable: an IF condition ends at its first THEN,
    -- so a CASE … THEN inside it would cut the condition short.)
    v_span := case v_pledge.billing_interval when 'year' then interval '1 year' else interval '1 month' end;
    if greatest(coalesce(v_last, v_pledge.queued_at), v_pledge.queued_at) + v_span < now() then
      update public.place_backings
         set status = 'ended', ended_reason = 'covered', ended_at = now(),
             checkout_kind = null, updated_at = now()
       where id = v_pledge.id;
      return jsonb_build_object('action', 'none', 'reason', 'dormant',
                                'backing_id', v_pledge.id,
                                'payment_method', v_pledge.stripe_payment_method_id);
    end if;
    return jsonb_build_object('action', 'none', 'reason', 'covered');
  end if;

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

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.premier_run_end(uuid, smallint)',
    'public.premier_early_window(uuid, smallint)',
    'public.premier_make_payer(uuid, text)',
    'public.premier_begin_renewal(uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke execute on function %s from anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;
