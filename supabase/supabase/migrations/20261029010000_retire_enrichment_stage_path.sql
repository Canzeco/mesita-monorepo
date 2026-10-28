-- MESITA-2424. Retire the paused enrichment stage path.
--
-- Render runs the whole Enrich ladder since MESITA-2420, and nothing has
-- seeded place_research since: votes start Render (_shared/enrich-start.ts)
-- and the wrong-number refetch runs inline (_shared/google-refetch.ts). The
-- poller has been paused since MESITA-2206 and the table was empty when this
-- shipped. The three enricher-cron-enrich-place-* functions go in the same PR.
--
-- Kept: place_enrichment_runs, open_place_enrichment_run,
-- close_place_enrichment_run and the janitor. The refetch opens and closes a
-- run around one Google call.

-- 1. The poller's cron job, then the poller.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'run-place-enrichment-stages') then
    perform cron.unschedule('run-place-enrichment-stages');
  end if;
end $$;

drop function if exists public.run_place_enrichment_stages();

-- 2. The janitor. Its first two sweeps keyed on place_research (reconcile a
-- run from its queue row; close a run no queue row points at). With the queue
-- gone, the one rule is a grace window: a refetch run is one Place Details
-- call, so a run still open 15 minutes after it started was lost by its
-- caller (a crash between open and close). The old 12-hour deadline is
-- inside this window.
create or replace function public.close_stale_place_enrichment_runs()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_n integer;
begin
  update public.place_enrichment_runs
     set ended_at   = now(),
         outcome    = 'abandoned',
         end_reason = coalesce(end_reason, 'open past its 15-minute grace window')
   where ended_at is null
     and started_at < now() - interval '15 minutes';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- 3. The queue table. Its updated_at trigger uses the shared set_updated_at(),
-- which stays.
drop table if exists public.place_research;
