-- The three pipeline stages take the names of the work they do.
-- research → gather, analysis → photos, contents → write.
-- The poller appends the stage onto enricher-cron-enrich-place-, so the
-- function slugs move with the stage values.

do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname
      from pg_constraint
     where contype = 'c'
       and pg_get_constraintdef(oid) like '%research%'
       and conrelid in (
         'public.place_research'::regclass,
         'public.place_enrichment_runs'::regclass
       )
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

update public.place_research
   set stage = case stage
         when 'research' then 'gather'
         when 'analysis' then 'photos'
         when 'contents' then 'write'
         else stage
       end
 where stage in ('research', 'analysis', 'contents');

update public.place_enrichment_runs
   set entry_stage = case entry_stage
         when 'research' then 'gather'
         when 'analysis' then 'photos'
         when 'contents' then 'write'
         else entry_stage
       end
 where entry_stage in ('research', 'analysis', 'contents');

update public.place_enrichment_runs
   set stage_reached = case stage_reached
         when 'research' then 'gather'
         when 'analysis' then 'photos'
         when 'contents' then 'write'
         else stage_reached
       end
 where stage_reached in ('research', 'analysis', 'contents');

alter table public.place_research
  add constraint place_research_stage_check
  check (stage in ('gather', 'photos', 'write', 'done', 'failed'));

alter table public.place_enrichment_runs
  add constraint place_enrichment_runs_entry_stage_check
  check (entry_stage in ('gather', 'photos', 'write'));

alter table public.place_enrichment_runs
  add constraint place_enrichment_runs_stage_reached_check
  check (stage_reached in ('gather', 'photos', 'write', 'done', 'failed'));

create or replace function public.open_place_enrichment_run(
  p_place_id       uuid,
  p_trigger        text,
  p_seeded_by      text,
  p_subprocesses   jsonb   default null,
  p_entry_stage    text    default 'gather',
  p_cooldown_hours integer default 0,
  p_actor_user_id  uuid    default null,
  p_meta           jsonb   default '{}'::jsonb
)
returns table (run_id uuid, blocked text, retry_after timestamptz)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_open_id uuid;
  v_last    timestamptz;
  v_new     uuid;
begin
  perform pg_advisory_xact_lock(1185, hashtext(p_place_id::text));

  select id into v_open_id
    from public.place_enrichment_runs
   where place_id = p_place_id and ended_at is null
   limit 1;

  if v_open_id is not null then
    if p_trigger <> 'manual' then
      return query select null::uuid, 'already_open'::text, null::timestamptz;
      return;
    end if;
    update public.place_enrichment_runs
       set ended_at = now(),
           outcome = 'superseded',
           end_reason = 'superseded by a manual re-enrich'
     where id = v_open_id and ended_at is null;
  end if;

  if p_cooldown_hours > 0 then
    select max(started_at) into v_last
      from public.place_enrichment_runs
     where place_id = p_place_id and trigger_key = p_trigger;
    if v_last is not null and v_last > now() - make_interval(hours => p_cooldown_hours) then
      return query select null::uuid, 'cooldown'::text,
                          v_last + make_interval(hours => p_cooldown_hours);
      return;
    end if;
  end if;

  insert into public.place_enrichment_runs
    (place_id, trigger_key, seeded_by, actor_user_id, subprocesses, entry_stage, meta)
  values
    (p_place_id, p_trigger, p_seeded_by, p_actor_user_id, p_subprocesses,
     coalesce(p_entry_stage, 'gather'), coalesce(p_meta, '{}'::jsonb))
  returning id into v_new;

  return query select v_new, null::text, null::timestamptz;
end;
$function$;

create or replace function public.close_stale_place_enrichment_runs()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v_total integer := 0; v_n integer;
begin
  update public.place_enrichment_runs r
     set ended_at = now(),
         outcome  = case when pr.stage = 'done' then 'succeeded' else 'failed' end,
         end_reason = coalesce(r.end_reason,
                        'reconciled from place_research: ' || coalesce(pr.error, pr.stage)),
         stage_reached = coalesce(r.stage_reached, pr.stage),
         cost_usd = coalesce(
           r.cost_usd,
           case when r.entry_stage = 'gather'
                then (pr.gathered -> 'cost' ->> 'spentUsd')::numeric
           end),
         cost_charges = coalesce(
           r.cost_charges,
           case when r.entry_stage = 'gather'
                then pr.gathered -> 'cost' -> 'charges'
           end)
    from public.place_research pr
   where pr.run_id = r.id
     and r.ended_at is null
     and pr.stage in ('done', 'failed');
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  update public.place_enrichment_runs r
     set ended_at = now(),
         outcome = 'abandoned',
         end_reason = 'orphaned: no pipeline row points at this run'
   where r.ended_at is null
     and r.started_at < now() - interval '15 minutes'
     and not exists (select 1 from public.place_research pr where pr.run_id = r.id);
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  update public.place_enrichment_runs
     set ended_at = now(),
         outcome = 'abandoned',
         end_reason = 'deadline: open longer than 12h'
   where ended_at is null
     and started_at < now() - interval '12 hours';
  get diagnostics v_n = row_count;

  return v_total + v_n;
end;
$function$;

create or replace function public.run_place_enrichment_stages()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public', 'net', 'vault'
as $function$
declare
  v_key   text;
  v_base  text := 'https://yjalywfzdelacdzccpgb.supabase.co/functions/v1/enricher-cron-enrich-place-';
  v_row   public.place_research%rowtype;
  v_stage text;
  v_count integer := 0;
begin
  with victims as (
    select place_id, stage, attempts
      from public.place_research
     where state = 'running'
       and stage in ('gather','photos','write')
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
       and stage in ('gather','photos','write')
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

  update public.places p
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

  foreach v_stage in array array['gather','photos','write'] loop
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
