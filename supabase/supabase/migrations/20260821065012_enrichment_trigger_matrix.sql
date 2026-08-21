-- The enrichment trigger matrix: which EVENT re-runs which SUBPROCESS.
--
-- Enrichment was one dial with three positions (full / analysis / contents),
-- so any event wanting a cheap liveness refresh had to buy the whole pipeline
-- or nothing. This adds the grid the console edits: rows are triggers, columns
-- are the subprocesses the stage EFs can actually skip, each row carrying a
-- cooldown so a busy place is not re-enriched on every event.
--
-- place_research.subprocesses is the RESOLVED set for one run, stamped by
-- whoever seeds the row. NULL means "run everything" — the pre-matrix
-- behaviour, and what the manual re-enrich button wants, because explicit
-- operator intent outranks the defaults.
--
-- The vocabulary (which triggers exist, which subprocesses exist, which cells
-- are locked) is CODE-DEFINED in _shared/enrich-triggers.ts, same contract as
-- channels.ts. This blob carries only the operator's booleans and cooldowns.

alter table public.app_config
  add column if not exists enrichment_triggers jsonb;

comment on column public.app_config.enrichment_triggers is
  'Trigger x subprocess matrix. Vocabulary is code-defined in _shared/enrich-triggers.ts; this blob carries only operator booleans and cooldowns. NULL/partial is fine - normalizeEnrichmentTriggers fills every gap from the code defaults, so the defaults live in exactly one place.';

alter table public.place_research
  add column if not exists subprocesses jsonb;

comment on column public.place_research.subprocesses is
  'Resolved subprocess list for THIS run, stamped at seed time. NULL = run everything (pre-matrix rows and manual re-enrich).';

-- The per-place scheduler (MESITA-1148) now asks the matrix what an on_schedule
-- run buys, and stamps that set on the row it seeds. A disabled row, or one
-- whose every column is off, queues nothing rather than quietly running the
-- full pipeline. Body is otherwise the shipped one, patched at those two points.
create or replace function public.queue_due_place_enrichments()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row     record;
  v_stage   text;
  v_count   integer := 0;
  v_trigger jsonb;
  v_subs    jsonb;
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

    insert into public.place_research as pr2
      (place_id, google_place_id, stage, status, attempts, gathered, analysis, error, subprocesses, created_by, updated_at)
    values
      (v_row.id, v_row.google_place_id, v_stage, 'pending', 0,
       null, null, null, v_subs, 'queue_due_place_enrichments', now())
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
