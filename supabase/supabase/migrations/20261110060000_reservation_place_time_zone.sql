-- One timezone per place (MESITA-3626).
--
-- place_profiles.timezone (IANA, stamped by Create/Enrich from Google's Time
-- Zone API) is the place's clock for every reservation decision: the slot the
-- guest picks, the date and hour the agents say, when a call may ring, and
-- the day the per-place call meter counts (_shared/local-time.ts placeZone).
--
-- 1 · Backfill: a place with no usable zone gets the longitude guess the
--     engine used until now (Baja → Tijuana, Quintana Roo → Cancún, else
--     Mexico City). Enrich now stamps the same fallback when Google's API
--     fails, so the column stops being null.
-- 2 · The per-place daily call meter counts the PLACE's day, not UTC's: a
--     call at 7 p.m. in Mexico City is that day's call, not tomorrow's.
--     The engine passes the place-local day (bump_reservation_call_counter
--     (pid, local_day)); the one-argument form stays for the deploy window
--     and derives the same day from the stored zone.

update public.place_profiles pp
set timezone = case
    when pp.lng is null then 'America/Mexico_City'
    when pp.lng <= -110 then 'America/Tijuana'
    when pp.lng >= -89 then 'America/Cancun'
    else 'America/Mexico_City'
  end
where pp.timezone is null
   or btrim(pp.timezone) = ''
   or not exists (select 1 from pg_timezone_names z where z.name = pp.timezone);

create or replace function public.bump_reservation_call_counter(pid uuid, local_day date)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into reservation_call_counters (place_id, day, calls)
  values (pid, local_day, 1)
  on conflict (place_id, day)
  do update set calls = reservation_call_counters.calls + 1
  returning calls;
$$;

revoke all on function public.bump_reservation_call_counter(uuid, date) from public, anon, authenticated;
grant execute on function public.bump_reservation_call_counter(uuid, date) to service_role;

comment on function public.bump_reservation_call_counter(uuid, date) is
  'Per-place daily reservation-call meter; local_day is the place-local day (MESITA-3626).';

-- The one-argument form (still called by an EF deployed before this
-- migration): the same meter, on the place's own day.
create or replace function public.bump_reservation_call_counter(pid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text;
  d date;
begin
  select nullif(btrim(pp.timezone), '') into tz from place_profiles pp where pp.id = pid;
  begin
    d := (now() at time zone coalesce(tz, 'America/Mexico_City'))::date;
  exception when invalid_parameter_value then
    d := (now() at time zone 'America/Mexico_City')::date;
  end;
  return public.bump_reservation_call_counter(pid, d);
end;
$$;

notify pgrst, 'reload schema';
