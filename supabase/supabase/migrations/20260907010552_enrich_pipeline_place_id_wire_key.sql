-- MESITA-1606 — the enrichment pipeline's request-body key becomes `place_id`,
-- on its own, ahead of the table rename it does not need to wait for.
--
-- run_place_enrichment_stages() posts one net.http_post per due
-- place_research row to supabase-cron-enrich-place-{research,analysis,contents}.
-- Those three EFs all read the body through one shared helper,
-- _shared/enrich-pipeline.ts's serveEnrichStage() — not duplicated per EF —
-- which now parses `place_id` instead of `project_id` (same PR). This
-- migration changes the ONE string literal that has to agree with it.
--
-- Nothing else in this function moves: it still spells `public.projects`
-- (MESITA-1590's own table rename, a separate, later stage) exactly as
-- `main` has it today.

create or replace function public.run_place_enrichment_stages()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'net', 'vault'
as $function$
declare
  v_key   text;
  v_base  text := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/supabase-cron-enrich-place-';
  v_row   public.place_research%rowtype;
  v_stage text;
  v_count integer := 0;
begin
  with victims as (
    select place_id, stage, attempts
      from public.place_research
     where state = 'running'
       and stage in ('research','analysis','contents')
       and updated_at < now() - interval '10 minutes'
     for update
  ),
  reaped as (
    update public.place_research pr
       set state  = 'pending',
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

  with victims as (
    select place_id, stage, error, run_id
      from public.place_research
     where state = 'pending'
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

  update public.projects p
  set content_state = 'failed'
  from public.place_research r
  where r.place_id = p.id
    and r.stage = 'failed'
    and p.content_state = 'generating';

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'scheduler_service_role_key'
  limit 1;
  if v_key is null then
    raise warning 'run_place_enrichment_stages: vault secret scheduler_service_role_key missing';
    return 0;
  end if;

  foreach v_stage in array array['research','analysis','contents'] loop
    for v_row in
      select *
      from public.place_research
      where stage = v_stage
        and state = 'pending'
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
        body    := jsonb_build_object('place_id', v_row.place_id),
        timeout_milliseconds := 30000
      );

      update public.place_research
      set state = 'running',
          attempts = attempts + 1,
          error = null
      where place_id = v_row.place_id;

      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$function$;
