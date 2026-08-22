-- The catalog's Enriched meter needs each place's CURRENT per-subprocess state
-- (MESITA-1200). place_enrichment_events is an APPEND-ONLY LOG, so every
-- re-enrich appends another row per subprocess: reading the raw rows would ship
-- a set that grows without bound as places are re-enriched, for a fold that
-- only ever cares about the newest row per subprocess.
--
-- Same lesson, and the same posture, as place_research_facts (MESITA-1198):
-- ask Postgres for the answer instead of the material. distinct on collapses
-- each (place, subprocess) to its latest event, so the result is capped at the
-- number of subprocesses per place — bounded no matter how often a place is
-- re-enriched.
--
-- The COUNTING deliberately stays in TypeScript (placeEnrichProgress), where
-- the skipped/failed/completed rules are unit-tested. This function only picks
-- the right rows.
create or replace function public.place_enrich_events_latest(p_place_ids uuid[])
returns table (place_id uuid, step_name text, status text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select distinct on (e.place_id, e.step_name)
         e.place_id,
         e.step_name,
         e.status,
         e.created_at
    from public.place_enrichment_events e
   where e.place_id = any (coalesce(p_place_ids, '{}'::uuid[]))
   order by e.place_id, e.step_name, e.created_at desc;
$function$;

revoke execute on function public.place_enrich_events_latest(uuid[])
  from public, anon, authenticated;
grant execute on function public.place_enrich_events_latest(uuid[])
  to service_role;
