-- MESITA-3163 — Premier Refill (Pato, 2026-11-03, /autoplan gate `rec`):
-- Premier is two products sharing one level per place.
--
--   Premier Subscription  the recurring plan (place_backings + place_premier_periods)
--   Premier Refill        prepaid days of 2X or 5X (place_manual_premier, this file)
--   places.boost_tier     the higher of the two
--
-- A Refill row is one grant: admin (Manage Multiple › Refill), code (Mesita
-- codes, later) or purchase (a guest's pack, later). The timeline of a place:
--
--   now ──[5X rows, grant order]──[2X rows, grant order]──▶
--
-- back to back from now. Adding 5X over a running 2X moves the 2X row in
-- place to after the new 5X block with its remaining time (never split: one
-- row per (place_id, request_id)). Rows are never deleted: an ended row is
-- ends_at = now() (it was running) or ends_at = starts_at (it was queued);
-- a zero-length row counts for replay only, never for level, cover or
-- Billing. Only premier_add_days and premier_end_mesita_days write the table;
-- premier_grant, premier_set_grant and premier_end_grant go.
--
-- Both writers set mesita.premier_batch for the call: the row trigger skips,
-- and the cover (premier_cover_paid) and the level (recompute_place_boost)
-- run once at the end. A level change at a row boundary lands at the next
-- recompute_due_place_boosts run (pg_cron, every 5 minutes).
--
-- Data: TEST only; no Refill row runs on 2026-11-03.

-- ── Columns ──────────────────────────────────────────────────────────────
alter table public.place_manual_premier
  add column request_id text check (request_id <> ''),
  add column ended_by text;

alter table public.place_manual_premier drop constraint if exists place_manual_premier_source_check;
alter table public.place_manual_premier
  add constraint place_manual_premier_source_check check (source in ('admin', 'code', 'purchase'));

create unique index place_manual_premier_request
  on public.place_manual_premier (place_id, request_id);

comment on table public.place_manual_premier is
  'MESITA-3091 / MESITA-3163 Premier Refill: prepaid days lifting a place (tier 1 = 2X, 2 = 5X), never charged as a Subscription. One row per grant; 5X rows run before 2X rows, each tier in grant order, back to back from now. Never deleted: ended = ends_at <= now(), zero-length = ended while queued. Written only by premier_add_days / premier_end_mesita_days. EF-only.';
comment on column public.place_manual_premier.source is
  'MESITA-3163: admin = Manage Multiple › Refill; code = a Mesita code; purchase = a guest''s Refill pack. End Mesita days ends admin rows only.';
comment on column public.place_manual_premier.request_id is
  'MESITA-3163: the replay key, unique per place. A second add with the same key answers replayed and adds nothing, even after the row ended.';
comment on column public.place_manual_premier.ended_by is
  'MESITA-3163: who ended this row early (End Mesita days), if anyone.';

-- ── The row trigger skips inside a batch ────────────────────────────────
create or replace function public.place_manual_premier_recompute()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if current_setting('mesita.premier_batch', true) = 'on' then
    return null;
  end if;
  perform public.premier_cover_paid(coalesce(new.place_id, old.place_id));
  perform public.recompute_place_boost(coalesce(new.place_id, old.place_id));
  return null;
end;
$function$;

-- ── Cover: the whole back-to-back chain ─────────────────────────────────
-- MESITA-3092's rule, with the cover's end taken from the chain of Refill
-- rows at or above the paid tier that runs back to back from now (before,
-- only the row running now: a queued 2X after a 5X was not counted).
create or replace function public.premier_cover_paid(p_place_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_p public.place_premier_periods;
  r record;
  v_cursor timestamptz := now();
  v_cover_end timestamptz;
  v_left integer;
begin
  select * into v_p
    from public.place_premier_periods
   where place_id = p_place_id and status = 'paid'
     and starts_at <= now() and ends_at > now()
   order by starts_at desc
   limit 1
   for update;
  if v_p.id is null then
    return;
  end if;

  for r in
    select starts_at, ends_at
      from public.place_manual_premier
     where place_id = p_place_id and tier >= v_p.tier
       and ends_at > now() and ends_at > starts_at
     order by starts_at
  loop
    exit when r.starts_at > v_cursor;
    v_cursor := greatest(v_cursor, r.ends_at);
  end loop;
  if v_cursor > now() then
    v_cover_end := v_cursor;
  end if;

  if v_cover_end is null then
    -- The cover ended early: it stopped now.
    if v_p.covered_until is not null and v_p.covered_until > now() then
      update public.place_premier_periods
         set covered_until = now(), updated_at = now()
       where id = v_p.id;
    end if;
    return;
  end if;

  if v_p.remaining_at_cover_sec is null then
    v_left := greatest(0, ceil(extract(epoch from v_p.ends_at - now())))::integer;
  elsif v_p.covered_until <= now() then
    -- A new cover after an earlier one: what was left then, minus the time
    -- paid since it ended.
    v_left := greatest(0, v_p.remaining_at_cover_sec - ceil(extract(epoch from now() - v_p.covered_until)))::integer;
  else
    v_left := v_p.remaining_at_cover_sec;
  end if;

  update public.place_premier_periods
     set remaining_at_cover_sec = v_left,
         covered_until = v_cover_end,
         ends_at = greatest(ends_at, v_cover_end + make_interval(secs => v_left)),
         updated_at = now()
   where id = v_p.id;
end;
$function$;

-- ── Lay the live rows out back to back ──────────────────────────────────
-- Live = ends_at > now() and not zero-length. Order: tier desc, grant order.
-- The first row keeps its start if it is already running; every other row
-- starts where the one before it ends, with the time it had left (p_new_id
-- with p_new_len, a row just inserted at zero length). Two passes: collapse
-- every live row to zero length (an empty range overlaps nothing), then set
-- the final ranges, so the no-overlap constraint never sees a half-moved
-- timeline. Caller holds the place lock.
create or replace function public.premier_restack(p_place_id uuid, p_new_id uuid, p_new_len interval)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_ids uuid[] := '{}';
  v_starts timestamptz[] := '{}';
  v_ends timestamptz[] := '{}';
  v_cursor timestamptz := now();
  v_len interval;
  v_start timestamptz;
  i integer;
begin
  for r in
    select id, starts_at, ends_at
      from public.place_manual_premier
     where place_id = p_place_id
       and (id = p_new_id or (ends_at > now() and ends_at > starts_at))
     order by tier desc, created_at, id
  loop
    v_len := case when r.id = p_new_id then p_new_len
                  else r.ends_at - greatest(r.starts_at, now()) end;
    v_start := case when cardinality(v_ids) = 0 and r.id is distinct from p_new_id and r.starts_at <= now()
                    then r.starts_at else v_cursor end;
    v_ids := v_ids || r.id;
    v_starts := v_starts || v_start;
    v_ends := v_ends || (v_cursor + v_len);
    v_cursor := v_cursor + v_len;
  end loop;

  update public.place_manual_premier set ends_at = starts_at where id = any(v_ids);
  for i in 1 .. cardinality(v_ids) loop
    update public.place_manual_premier
       set starts_at = v_starts[i], ends_at = v_ends[i], updated_at = now()
     where id = v_ids[i];
  end loop;
end;
$function$;

-- Days still to run per tier, the reply both writers end with.
create or replace function public.premier_refill_ends(p_place_id uuid)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'ends_at_2x', max(ends_at) filter (where tier = 1),
    'ends_at_5x', max(ends_at) filter (where tier = 2))
    from public.place_manual_premier
   where place_id = p_place_id and ends_at > now() and ends_at > starts_at;
$function$;

-- ── Add days ─────────────────────────────────────────────────────────────
-- Returns { result: "ok", replayed, ends_at_2x, ends_at_5x } or
-- { result: "refused", code }; raises only on a caller error (source,
-- request_id) or an unexpected one. Order: tier · days → lock → replay →
-- place → archived → unlisted (state paused, Disabled) → paid_higher (a
-- paid period running, paused or charging, or a ready pledge, above the
-- tier) → cap_reached (over 366 days would be queued).
create or replace function public.premier_add_days(
  p_place_id uuid,
  p_tier smallint,
  p_days integer,
  p_source text,
  p_by text,
  p_request_id text
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_state public.place_state;
  v_paid smallint;
  v_queued interval;
  v_id uuid;
begin
  if p_tier is null or p_tier not between 1 and 2 then
    return jsonb_build_object('result', 'refused', 'code', 'tier_invalid');
  end if;
  if p_days is null or p_days not between 1 and 366 then
    return jsonb_build_object('result', 'refused', 'code', 'days_invalid');
  end if;
  if p_source is null or p_source not in ('admin', 'code', 'purchase') then
    raise exception 'premier_add_days: source must be admin, code or purchase, got %', p_source using errcode = 'P0001';
  end if;
  if p_request_id is null or p_request_id = '' then
    raise exception 'premier_add_days: request_id is required' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_place_id::text));

  if exists (select 1 from public.place_manual_premier
              where place_id = p_place_id and request_id = p_request_id) then
    return jsonb_build_object('result', 'ok', 'replayed', true) || public.premier_refill_ends(p_place_id);
  end if;

  select state into v_state from public.places where id = p_place_id;
  if not found then
    return jsonb_build_object('result', 'refused', 'code', 'not_found');
  end if;
  if v_state = 'archived' then
    return jsonb_build_object('result', 'refused', 'code', 'archived');
  end if;
  if v_state = 'paused' then
    return jsonb_build_object('result', 'refused', 'code', 'unlisted');
  end if;

  select greatest(
           coalesce((select max(tier) from public.place_premier_periods
                      where place_id = p_place_id and status in ('paid', 'charging') and ends_at > now()), 0),
           coalesce((select max(public.premier_tier_rank(tier)) from public.place_backings
                      where place_id = p_place_id and status = 'ready'), 0))
    into v_paid;
  if v_paid > p_tier then
    return jsonb_build_object('result', 'refused', 'code', 'paid_higher');
  end if;

  select coalesce(sum(ends_at - greatest(starts_at, now())), interval '0')
    into v_queued
    from public.place_manual_premier
   where place_id = p_place_id and ends_at > now() and ends_at > starts_at;
  if v_queued + make_interval(days => p_days) > interval '366 days' then
    return jsonb_build_object('result', 'refused', 'code', 'cap_reached');
  end if;

  perform set_config('mesita.premier_batch', 'on', true);

  -- created_at is the grant order; clock time keeps two adds in one
  -- transaction in the order they were made.
  insert into public.place_manual_premier (place_id, tier, starts_at, ends_at, source, granted_by, request_id, created_at)
  values (p_place_id, p_tier, now(), now(), p_source, p_by, p_request_id, clock_timestamp())
  returning id into v_id;

  perform public.premier_restack(p_place_id, v_id, make_interval(days => p_days));

  perform set_config('mesita.premier_batch', 'off', true);
  perform public.premier_cover_paid(p_place_id);
  perform public.recompute_place_boost(p_place_id);

  return jsonb_build_object('result', 'ok', 'replayed', false) || public.premier_refill_ends(p_place_id);
end;
$function$;

-- ── End Mesita days ─────────────────────────────────────────────────────
-- Ends every running or queued admin row (code and purchase days stay) and
-- pulls the later rows earlier. Returns { result: "ok", ended_days } (whole
-- days, rounded up; 0 when no admin days were left) or { result: "refused",
-- code: "not_found" }.
create or replace function public.premier_end_mesita_days(p_place_id uuid, p_by text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ended interval;
begin
  perform pg_advisory_xact_lock(hashtext(p_place_id::text));

  if not exists (select 1 from public.places where id = p_place_id) then
    return jsonb_build_object('result', 'refused', 'code', 'not_found');
  end if;

  select coalesce(sum(ends_at - greatest(starts_at, now())), interval '0')
    into v_ended
    from public.place_manual_premier
   where place_id = p_place_id and source = 'admin'
     and ends_at > now() and ends_at > starts_at;
  if v_ended = interval '0' then
    return jsonb_build_object('result', 'ok', 'ended_days', 0) || public.premier_refill_ends(p_place_id);
  end if;

  perform set_config('mesita.premier_batch', 'on', true);

  update public.place_manual_premier
     set ends_at = case when starts_at <= now() then now() else starts_at end,
         ended_by = p_by, updated_at = now()
   where place_id = p_place_id and source = 'admin'
     and ends_at > now() and ends_at > starts_at;

  perform public.premier_restack(p_place_id, null, null);

  perform set_config('mesita.premier_batch', 'off', true);
  perform public.premier_cover_paid(p_place_id);
  perform public.recompute_place_boost(p_place_id);

  return jsonb_build_object('result', 'ok', 'ended_days', ceil(extract(epoch from v_ended) / 86400)::integer)
         || public.premier_refill_ends(p_place_id);
end;
$function$;

-- ── The old writers go ──────────────────────────────────────────────────
drop function if exists public.premier_set_grant(uuid, smallint, integer, text);
drop function if exists public.premier_grant(uuid, smallint, integer, text);
drop function if exists public.premier_end_grant(uuid);

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.place_manual_premier_recompute()',
    'public.premier_cover_paid(uuid)',
    'public.premier_restack(uuid, uuid, interval)',
    'public.premier_refill_ends(uuid)',
    'public.premier_add_days(uuid, smallint, integer, text, text, text)',
    'public.premier_end_mesita_days(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke execute on function %s from anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end
$$;
