-- Per-place enrichment schedule (MESITA-1148) — "when to enrich".
--
-- Until now the Enricher only ever ran when a human pressed Re-enrich or a
-- place was created: place_research rows are seeded by hand, and
-- run_place_enrichment_stages only walks rows that already exist. A place
-- enriched once in July still carries July's photos, hours and copy.
--
-- This adds the missing half — a CADENCE per place, and the enqueuer that
-- honours it. The admin console's Enrichment box writes the three columns;
-- queue_due_place_enrichments() is the thing that makes them true, because an
-- unenforced config is a bug.
--
--   enrich_every_days  NULL = manual only (the default — every existing place
--                      keeps today's behaviour exactly). 1–365 = auto.
--   enrich_mode        which slice a SCHEDULED run re-runs, same vocabulary as
--                      admin-web-enrich-place: full | analysis | contents.
--   enrich_next_at     when the next scheduled run is due. NULL while manual.

alter table public.places
  add column enrich_every_days smallint
    constraint places_enrich_every_days_range
    check (enrich_every_days is null or enrich_every_days between 1 and 365),
  add column enrich_mode text not null default 'full'
    constraint places_enrich_mode_kind
    check (enrich_mode in ('full', 'analysis', 'contents')),
  add column enrich_next_at timestamptz;

comment on column public.places.enrich_every_days is
  'Auto re-enrich cadence in days. NULL = manual only (Re-enrich button / create). Enforced by queue_due_place_enrichments().';
comment on column public.places.enrich_mode is
  'Which slice a SCHEDULED run re-runs: full (re-gather) | analysis (re-rank images) | contents (re-synthesise copy). A lighter mode whose stored payload is missing falls back to full.';
comment on column public.places.enrich_next_at is
  'When the next scheduled run is due. Set on save and re-stamped after each enqueue; NULL while the place is manual-only.';

-- Only the due rows are ever scanned, and the partial index keeps that scan
-- off the (many) manual-only places.
create index if not exists places_enrich_due_idx
  on public.places (enrich_next_at)
  where enrich_every_days is not null;

-- ── The enqueuer ────────────────────────────────────────────────────────────
--
-- Mirrors seedPlaceResearch() in _shared/enrich-pipeline-stage.ts exactly:
-- upsert on place_id, status='pending', attempts=0, error=null, and for a full
-- run the stored payloads are nulled. The stage poller
-- (run_place_enrichment_stages, every 20s) picks the row up from there — this
-- function never calls an EF itself, so there is one dispatcher, not two.
--
-- Bounded on purpose: 5 places per tick. Every enqueued place costs real
-- Google/Apify/Perplexity/OpenAI budget, and the per-run cap
-- (atlas_per_run_cost_cap_usd) only bounds ONE run. A quarter-hourly ceiling
-- of 5 is what keeps a "re-enrich everything monthly" setting from becoming a
-- single afternoon's invoice.
create or replace function public.queue_due_place_enrichments()
  returns integer
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  v_row   record;
  v_stage text;
  v_count integer := 0;
begin
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
      -- The identity spine the research stage re-checks first. Without it the
      -- run would fail at S1, so it is never worth queueing.
      and p.google_place_id is not null
      and p.google_place_id <> ''
      -- Never queue a place the pipeline is already walking: a live row would
      -- be reset under a running stage EF, and its work lost.
      and pr.content_status <> 'generating'
      and (r.place_id is null or r.stage in ('done', 'failed'))
    order by p.enrich_next_at asc
    for update of p skip locked
    limit 5
  loop
    -- A lighter mode reuses a payload an earlier run stored. If it isn't
    -- there, fall back to a full run rather than queueing a stage that would
    -- fail: admin-web-enrich-place answers 422 here so an operator can decide,
    -- but a cron has nobody to ask, and "did nothing, silently" is the worse
    -- of the two answers.
    v_stage := case
      when v_row.enrich_mode = 'contents' and v_row.has_gathered and v_row.has_analysis then 'contents'
      when v_row.enrich_mode = 'analysis' and v_row.has_gathered then 'analysis'
      else 'research'
    end;

    insert into public.place_research as pr2
      (place_id, google_place_id, stage, status, attempts, gathered, analysis, error, created_by, updated_at)
    values
      (v_row.id, v_row.google_place_id, v_stage, 'pending', 0,
       null, null, null, 'queue_due_place_enrichments', now())
    on conflict (place_id) do update set
      google_place_id = excluded.google_place_id,
      stage    = excluded.stage,
      status   = 'pending',
      attempts = 0,
      error    = null,
      -- A full run re-gathers from scratch; the lighter stages MUST keep the
      -- payloads they are about to reuse.
      gathered = case when excluded.stage = 'research' then null else pr2.gathered end,
      analysis = case when excluded.stage in ('research', 'analysis') then null else pr2.analysis end,
      created_by = excluded.created_by,
      updated_at = now();

    update public.projects
    set content_status = 'generating'
    where id = v_row.id;

    -- Re-stamp from NOW, not from the old due date: a place that was paused,
    -- or that sat behind the per-tick cap, must not come back owing four
    -- overdue runs it fires back to back.
    update public.places
    set enrich_next_at = now() + make_interval(days => v_row.enrich_every_days)
    where id = v_row.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

comment on function public.queue_due_place_enrichments() is
  'Seeds place_research for places whose enrich_next_at is due, honouring places.enrich_mode. Enqueues only; run_place_enrichment_stages remains the single dispatcher.';

-- Same lockdown as the other schedulers: the cron job runs as the function
-- owner, so revoking PUBLIC/anon/authenticated costs nothing and closes the
-- anonymous-POST-to-/rest/v1/rpc hole (see 20260706000139).
revoke all on function public.queue_due_place_enrichments() from public;
revoke execute on function public.queue_due_place_enrichments() from anon, authenticated;

-- ── Schedule: every 15 minutes ──────────────────────────────────────────────
-- The unit of the setting is DAYS, so a quarter-hour tick is already two
-- orders of magnitude finer than anything it can express.
select cron.unschedule('queue-due-place-enrichments')
where exists (select 1 from cron.job where jobname = 'queue-due-place-enrichments');
select cron.schedule(
  'queue-due-place-enrichments',
  '*/15 * * * *',
  $cron$ select public.queue_due_place_enrichments(); $cron$
);
