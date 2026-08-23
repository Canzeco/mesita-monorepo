-- MESITA-1185 — the scheduled seeder opens a run row.
--
-- Rebuilt from the LIVE body (pg_get_functiondef, taken at implementation time),
-- never from a repo copy: this function and run_place_enrichment_stages are the
-- two whose stored text went stale under a rename and ran the pipeline dead for
-- two days — 8,410 consecutive failed ticks with the stage EFs sitting idle and
-- correct (20260821004537). The live body is the cumulative truth; many
-- migrations re-declare these.
--
-- Three changes, all additive. Nothing about the existing selection, staging or
-- cadence logic moves:
--   1. a `v_run_id` declaration,
--   2. an open_place_enrichment_run call before the seed,
--   3. `run_id` carried into the insert and the on-conflict branch.
--
-- Verified after apply with plpgsql_check (clean) and three green
-- run-place-enrichment-stages ticks.

CREATE OR REPLACE FUNCTION public.queue_due_place_enrichments()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row     record;
  v_stage   text;
  v_count   integer := 0;
  v_trigger jsonb;
  v_subs    jsonb;
  v_run_id  uuid;
begin
  select enrichment_triggers -> 'on_schedule'
    into v_trigger
    from public.app_config
   order by id
   limit 1;

  -- No blob yet (or no on_schedule row in it) means nobody has expressed an
  -- opinion, so keep the pre-matrix behaviour: seed with subprocesses = NULL,
  -- which every stage EF reads as "run everything". Returning 0 here instead
  -- would silently switch the scheduler off the moment this migration lands.
  if v_trigger is null then
    v_subs := null;
  elsif coalesce((v_trigger ->> 'enabled')::boolean, true) is not true then
    return 0;
  else
    select coalesce(jsonb_agg(e.key order by e.key), '[]'::jsonb)
      into v_subs
      from jsonb_each(coalesce(v_trigger -> 'subprocesses', '{}'::jsonb)) as e(key, value)
     where e.value = 'true'::jsonb;

    -- Every column off is an explicit "this trigger buys nothing".
    if jsonb_array_length(v_subs) = 0 then
      return 0;
    end if;
  end if;

  for v_row in
    select p.id,
           p.google_place_id,
           p.enrich_mode,
           p.enrich_every_days,
           r.gathered is not null as has_gathered,
           r.analysis is not null as has_analysis
    from public.places p
    join public.projects pr on pr.id = p.id
    left join public.place_research r on r.place_id = p.id
    where p.enrich_every_days is not null
      and p.enrich_next_at is not null
      and p.enrich_next_at <= now()
      and p.google_place_id is not null
      and p.google_place_id <> ''
      and pr.content_status <> 'generating'
      and (r.place_id is null or r.stage in ('done', 'failed'))
    order by p.enrich_next_at asc
    for update of p skip locked
    limit 5
  loop
    v_stage := case
      when v_row.enrich_mode = 'contents' and v_row.has_gathered and v_row.has_analysis then 'contents'
      when v_row.enrich_mode = 'analysis' and v_row.has_gathered then 'analysis'
      else 'research'
    end;

    -- MESITA-1185: open the run BEFORE seeding, so a seed that dies still leaves
    -- the history (and any future cooldown) having ticked. Cooldown hours are 0
    -- here on purpose: the schedule's own cadence IS places.enrich_every_days,
    -- and a second window would silently fight it.
    select o.run_id into v_run_id
      from public.open_place_enrichment_run(
             v_row.id, 'on_schedule', 'queue_due_place_enrichments',
             v_subs, v_stage, 0, null, '{}'::jsonb) o;

    -- Refused because a run is still open for this place. Skip WITHOUT
    -- re-stamping enrich_next_at, so the place stays due and is picked up on a
    -- later tick once the janitor or a terminal has closed the open run.
    if v_run_id is null then
      continue;
    end if;

    insert into public.place_research as pr2
      (place_id, google_place_id, stage, status, attempts, gathered, analysis, error, subprocesses, created_by, run_id, updated_at)
    values
      (v_row.id, v_row.google_place_id, v_stage, 'pending', 0,
       null, null, null, v_subs, 'queue_due_place_enrichments', v_run_id, now())
    on conflict (place_id) do update set
      google_place_id = excluded.google_place_id,
      stage        = excluded.stage,
      status       = 'pending',
      attempts     = 0,
      error        = null,
      gathered     = case when excluded.stage = 'research' then null else pr2.gathered end,
      analysis     = case when excluded.stage in ('research', 'analysis') then null else pr2.analysis end,
      subprocesses = excluded.subprocesses,
      created_by   = excluded.created_by,
      run_id       = excluded.run_id,
      updated_at   = now();

    update public.projects
    set content_status = 'generating'
    where id = v_row.id;

    update public.places
    set enrich_next_at = now() + make_interval(days => v_row.enrich_every_days)
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;
