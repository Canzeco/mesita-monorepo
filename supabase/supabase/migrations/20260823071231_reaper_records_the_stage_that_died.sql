-- MESITA-1241: a reaped run recorded stage_reached='failed', losing which
-- stage actually died.
--
-- Built from pg_get_functiondef taken 2026-08-23, NOT from a repo copy — many
-- migrations re-declare this function and the live body is the cumulative
-- truth. This is the body that raised every 20 seconds for two days after a
-- column rename (8,410 consecutive failed runs), so everything outside the two
-- terminal UPDATEs is preserved verbatim.
--
-- WHAT CHANGED, and deliberately no more than this:
--
-- 1. The reaper and the attempts-cap sweep become data-modifying CTEs that
--    CAPTURE `stage` before overwriting it, then stamp `stage_reached` and
--    `end_reason` onto the still-open run row.
--
--    They stamp ONLY those two fields. `close_stale_place_enrichment_runs`
--    already closes these runs within 5 minutes and recovers cost, and its
--    reconcile step reads `coalesce(r.stage_reached, pr.stage)` and
--    `coalesce(r.end_reason, …)` — so a value written here SURVIVES, and
--    ended_at/outcome/cost stay owned by the one function that gets them
--    right. Duplicating the close here would fork the cost-recovery rule that
--    exists to stop analysis/contents entries being billed for the previous
--    run's spend.
--
-- 2. `v_req` is gone: `select net.http_post(...) into v_req` became `perform`.
--    That clears the standing plpgsql_check warning "never read variable
--    v_req" while changing nothing about the call.
--
-- Ordering is unchanged and load-bearing: the reaper runs first and moves
-- at-cap rows to stage='failed', so the cap sweep's
-- `stage in ('research','analysis','contents')` filter no longer matches them
-- and cannot double-stamp. A NULL run_id simply matches no run row.

CREATE OR REPLACE FUNCTION public.run_place_enrichment_stages()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'vault'
AS $function$
declare
  v_key   text;
  v_base  text := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-enrich-place-';
  v_row   public.place_research%rowtype;
  v_stage text;
  v_count integer := 0;
begin
  -- ── REAP: 'running' rows whose EF never reported back within the lease
  -- (10 min > the 400 s EF wall clock, so a live run is never stolen).
  -- attempts was bumped at claim time; at/over the cap → terminal 'failed'.
  --
  -- The victims CTE reads `stage` BEFORE the overwrite so the run row can
  -- record WHICH stage died (MESITA-1241). Without it stage_reached could only
  -- ever say 'failed', which is the outcome, not the location.
  with victims as (
    select place_id, stage, attempts
      from public.place_research
     where status = 'running'
       and stage in ('research','analysis','contents')
       and updated_at < now() - interval '10 minutes'
     for update
  ),
  reaped as (
    update public.place_research pr
       set status = 'pending',
           stage  = case when v.attempts >= 4 then 'failed' else v.stage end,
           error  = case when v.attempts >= 4 then 'max attempts reached'
                         else 'reaped: stuck running' end
      from victims v
     where pr.place_id = v.place_id
    returning pr.run_id, v.stage as died_at, v.attempts
  )
  update public.place_enrichment_runs r
     set stage_reached = x.died_at,
         end_reason    = 'reaped at the attempts cap in stage ' || x.died_at
    from reaped x
   where r.id = x.run_id
     and r.ended_at is null
     and x.attempts >= 4;

  -- ── Crash-released rows at the attempts cap ('pending', attempts >= 4) can
  -- never be claimed again: fail them terminally, keeping the last crash
  -- error so the inspector shows WHY. Same capture-then-overwrite shape. ──
  with victims as (
    select place_id, stage, error, run_id
      from public.place_research
     where status = 'pending'
       and stage in ('research','analysis','contents')
       and attempts >= 4
     for update
  ),
  capped as (
    update public.place_research pr
       set stage = 'failed',
           error = coalesce(v.error, 'max attempts reached')
      from victims v
     where pr.place_id = v.place_id
    returning v.run_id, v.stage as died_at, v.error as last_error
  )
  update public.place_enrichment_runs r
     set stage_reached = c.died_at,
         end_reason    = coalesce(c.last_error, 'max attempts reached')
    from capped c
   where r.id = c.run_id
     and r.ended_at is null;

  -- A newly-failed pipeline must not strand its place at 'generating'.
  update public.projects p
  set content_status = 'failed'
  from public.place_research r
  where r.place_id = p.id
    and r.stage = 'failed'
    and p.content_status = 'generating';

  -- ── Service bearer from Vault (shared with the creation scheduler). ──
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'scheduler_service_role_key'
  limit 1;
  if v_key is null then
    raise warning 'run_place_enrichment_stages: vault secret scheduler_service_role_key missing';
    return 0;
  end if;

  -- ── Claim + fire, per stage. SKIP LOCKED keeps overlapping ticks disjoint.
  -- Small per-stage batches: the stage EFs each burn real API budget. ──
  foreach v_stage in array array['research','analysis','contents'] loop
    for v_row in
      select *
      from public.place_research
      where stage = v_stage
        and status = 'pending'
        and attempts < 4
      order by updated_at asc
      for update skip locked
      limit 2
    loop
      perform net.http_post(
        url     := v_base || v_stage,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_key,
          'X-Internal-Caller', 'supabase-cron'
        ),
        body    := jsonb_build_object('project_id', v_row.place_id),
        timeout_milliseconds := 30000
      );

      update public.place_research
      set status = 'running',
          attempts = attempts + 1,
          error = null
      where place_id = v_row.place_id;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$function$;
