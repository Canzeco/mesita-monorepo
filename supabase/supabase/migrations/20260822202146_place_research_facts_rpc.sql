-- The Single Place table and the Pulse box only ever need to know WHETHER the
-- Enricher's payloads landed, never what is in them. Reading the columns to
-- find that out ships tens of KB of jsonb per place out of Postgres — up to 50
-- rows on every catalog search — and then throws all of it away (MESITA-1198).
--
-- This asks Postgres for the two booleans instead. service_role only, same
-- posture as admin_reset_storage_paths: clients never touch the DB, and the
-- payloads this guards are the most expensive rows in the schema.
create or replace function public.place_research_facts(p_place_ids uuid[])
returns table (place_id uuid, stage text, has_gathered boolean, has_analysis boolean)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select r.place_id,
         r.stage,
         r.gathered is not null,
         r.analysis is not null
    from public.place_research r
   where r.place_id = any (coalesce(p_place_ids, '{}'::uuid[]));
$function$;

revoke execute on function public.place_research_facts(uuid[])
  from public, anon, authenticated;
grant execute on function public.place_research_facts(uuid[])
  to service_role;
