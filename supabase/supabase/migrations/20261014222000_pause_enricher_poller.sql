-- MESITA-2206. Pause the Enricher.
--
-- The 20-second poller kept spending while the agent that was supposed to
-- pause it was blocked by main-protection. The job stays scheduled so a
-- resume is one call:
--   select cron.alter_job(job_id := <id>, active := true);
-- where <id> is cron.job.jobid for run-place-enrichment-stages.
-- first / second / third stay deployed. Admin enrich still calls them.

do $$
declare
  v_id bigint;
begin
  select jobid into v_id
    from cron.job
   where jobname = 'run-place-enrichment-stages';
  if v_id is not null then
    perform cron.alter_job(job_id := v_id, active := false);
  end if;
end $$;
