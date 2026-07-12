-- MESITA-445 — security advisor 0014 (extension_in_public): move pg_net out of
-- public into extensions.
--
-- Why not ALTER EXTENSION … SET SCHEMA?
--   pg_net is non-relocatable (extrelocatable = false; owned by supabase_admin).
--   `alter extension pg_net set schema extensions` fails with:
--     ERROR: extension "pg_net" does not support SET SCHEMA
--   Catalog flip (update pg_extension.extrelocatable) needs supabase_admin —
--   permission denied for the postgres role. See supabase/supabase#46919.
--
-- Self-service path (verified dry-run on prod 2026-07-12):
--   drop extension pg_net;          -- no CASCADE needed
--   create extension pg_net with schema extensions;
-- plpgsql callers (public.run_place_enrichment_stages) store bodies as text and
-- are NOT dropped. Event trigger issue_pg_net_access / grant_pg_net_access
-- survives and re-grants USAGE/EXECUTE on CREATE. Callable API stays net.*.
--
-- Context: 20260626211000_move_pg_net_schema stamped SET SCHEMA but never took
-- effect (advisor still WARN). This migration does the real relocate.
--
-- Brief window: net.* unavailable during drop→create. Cron
-- run-place-enrichment-stages calls the plpgsql wrapper; next tick after
-- recreate is fine. net._http_response history is wiped by the drop (ephemeral).

create schema if not exists extensions;

do $migration$
declare
  v_schema text;
begin
  select n.nspname
    into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_net';

  if v_schema is null then
    execute 'create extension pg_net with schema extensions';
  elsif v_schema = 'public' then
    execute 'drop extension pg_net';
    execute 'create extension pg_net with schema extensions';
  end if;
  -- else already outside public — no-op
end
$migration$;
