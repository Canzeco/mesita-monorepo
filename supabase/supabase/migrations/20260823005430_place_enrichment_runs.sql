-- MESITA-1185 — the enrichment pipeline gets a run history.
--
-- The pipeline has never been able to say WHAT provoked a run, or that a run
-- happened at all. `place_research` is ONE ROW PER PLACE (PK place_id) upserted
-- on every seed, so run N is destroyed by run N+1: its trigger, its measured
-- spend, its outcome and its start time all go with it. `place_enrichment_events`
-- has no trigger column and no run column, and the two commonest deaths — the
-- poller's reaper and its pending-at-cap sweep — write no beacon at all.
--
-- Verified in production 2026-08-22: after a full manual re-enrich completed all
-- nine rungs, `place_research.created_by` still read 'consumer-web-create-place',
-- the EF that created the place twenty hours earlier. The column cannot answer
-- "what provoked this run" even in principle.
--
-- Consequences today. `cooldownHours` is normalized, clamped and round-tripped
-- by nothing — there is no "when did trigger T last run for place P" to compare
-- against (MESITA-1184). Per-trigger cost attribution is impossible. And the
-- on_visit / on_order / on_reservation_* emitters cannot ship (MESITA-1189),
-- because with no cooldown a busy place would re-enrich on every ticket.
--
-- This table is one row per SEED, spanning every stage hop and every per-stage
-- retry that seed makes. `attempts` resets to 0 on each hop, so one logical run
-- legitimately spans up to twelve EF invocations; the run row spans all of them.

create table if not exists public.place_enrichment_runs (
  id             uuid primary key default gen_random_uuid(),
  place_id       uuid not null references public.places(id) on delete cascade,

  -- Vocabulary is CODE-DEFINED in _shared/enrich-triggers.ts, same contract as
  -- channels.ts — never a Postgres enum. EIGHT values, not the matrix's seven:
  -- 'manual' is deliberately NOT a matrix row. The Run-now button opts OUT of
  -- the matrix (it writes subprocesses = NULL, "run everything") and out of
  -- cooldown, so adding it to TriggerKey would draw a phantom row in the console
  -- grid carrying a knob the button must ignore.
  trigger_key    text not null check (trigger_key in (
                   'on_create','on_update','on_schedule','on_visit','on_order',
                   'on_reservation_ok','on_reservation_failed','manual')),

  -- The EF or SQL function that seeded it. Disambiguates the three create EFs
  -- that all fire on_create.
  seeded_by      text not null,
  -- The operator behind a manual run. requireSuperAdmin already resolves this
  -- and currently throws it away.
  actor_user_id  uuid references auth.users(id) on delete set null,

  -- The resolved set stamped on place_research.subprocesses for THIS run.
  -- NULL = run everything (pre-matrix rows, and every manual re-enrich).
  subprocesses   jsonb,
  -- Where the run ENTERED the machine. The cron picks analysis/contents off
  -- places.enrich_mode when the payloads already exist, and the manual light
  -- modes enter mid-pipeline. Cost is uninterpretable without it: a run that
  -- entered at 'contents' reused a previous run's gather and did not pay for it.
  entry_stage    text not null default 'research'
                 check (entry_stage in ('research','analysis','contents')),

  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  outcome        text check (outcome in ('succeeded','failed','superseded','abandoned')),
  end_reason     text,
  stage_reached  text check (stage_reached in ('research','analysis','contents','done','failed')),

  -- Actual measured spend, not the what-if estimate on /enricher-config.
  -- EnrichCostLedger quantizes to 4 decimals; the cap it is checked against is
  -- app_config.atlas_per_run_cost_cap_usd numeric(8,2).
  cost_usd       numeric(8,4),
  cost_charges   jsonb,

  meta           jsonb not null default '{}'::jsonb,

  -- A row is open or closed, never half: no outcome without a time, no time
  -- without an outcome.
  constraint place_enrichment_runs_closed_pair
    check ((ended_at is null) = (outcome is null))
);

comment on table public.place_enrichment_runs is
  'Per-trigger enrichment run history: one row per seed, spanning every stage hop and retry. Anchors trigger cooldowns (MESITA-1184) and per-trigger cost attribution. EF-only. MESITA-1185.';

comment on column public.place_enrichment_runs.started_at is
  'THE COOLDOWN ANCHOR. Cooldown compares against this regardless of outcome: a crashed, reaped or abandoned run still spent its window. A cooldown a crash can reset is not a cooldown.';

comment on column public.place_enrichment_runs.entry_stage is
  'Where the run entered the pipeline. A run entering at analysis/contents REUSES the stored gather, so its cost_usd must never inherit that gather''s spend.';

comment on column public.place_enrichment_runs.trigger_key is
  'A TriggerKey from _shared/enrich-triggers.ts, plus ''manual'' which is a run vocabulary, not a matrix row. Code-defined, never a DB enum.';

-- The pointer that makes a close attributable. Deliberately NOT a foreign key:
-- retention prunes closed runs while a long-idle place_research row may still
-- point at one, and an FK would buy only a delete-time scan plus an index the
-- advisor will report as unused.
alter table public.place_research
  add column if not exists run_id uuid;

comment on column public.place_research.run_id is
  'The open place_enrichment_runs row this pipeline state belongs to. Not an FK — see 20260823005430. MESITA-1185.';

-- ── RLS: enabled with ZERO policies, matching place_research and
-- place_enrichment_events live. This table holds spend data and operator
-- identities; there is no client story for it, ever. The `public` revoke is not
-- redundant with anon/authenticated — PUBLIC retains default privileges
-- independently, and without it PostgREST advertises a writable surface.
alter table public.place_enrichment_runs enable row level security;
revoke all on table public.place_enrichment_runs from public;
revoke all on table public.place_enrichment_runs from anon, authenticated;
grant all on table public.place_enrichment_runs to service_role;

-- (1) THE STRUCTURAL INVARIANT, not a performance index: at most one open run
-- per place, enforced by the database. It is what makes "the open run for this
-- place" unambiguous for a closer that cannot carry a run id, and what makes two
-- emitters racing at the same place impossible to resolve into two runs.
create unique index if not exists place_enrichment_runs_open_idx
  on public.place_enrichment_runs (place_id) where ended_at is null;

-- (2) The cooldown predicate exactly: max(started_at) for (place, trigger).
-- Doubles as the place inspector's "last N runs here" prefix scan.
create index if not exists place_enrichment_runs_place_trigger_idx
  on public.place_enrichment_runs (place_id, trigger_key, started_at desc);

-- (3) The retention sweep's range scan.
create index if not exists place_enrichment_runs_started_idx
  on public.place_enrichment_runs (started_at);

-- ── The two primitives ────────────────────────────────────────────────────
--
-- Why a run is OPENED in SQL but the pipeline row is still seeded in TypeScript:
-- read-cooldown-then-insert has to be one atomic decision, which SQL does well.
-- The place_research upsert stays in TS on purpose — stored PL/pgSQL bodies are
-- exactly what went stale under a rename and ran this pipeline dead for two days
-- (8,410 consecutive failed ticks, 20260821004537). Schema-shaped writes belong
-- where `deno check` can see them. The millisecond gap between the two is closed
-- by the janitor's orphan sweep below, not by moving more logic into a body no
-- rename will ever rewrite.

create or replace function public.open_place_enrichment_run(
  p_place_id       uuid,
  p_trigger        text,
  p_seeded_by      text,
  p_subprocesses   jsonb   default null,
  p_entry_stage    text    default 'research',
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
  -- Read-then-insert must be ONE decision. Two on_visit emitters firing at the
  -- same place in the same millisecond would otherwise both pass the check.
  perform pg_advisory_xact_lock(1185, hashtext(p_place_id::text));

  select id into v_open_id
    from public.place_enrichment_runs
   where place_id = p_place_id and ended_at is null
   limit 1;

  if v_open_id is not null then
    -- Explicit operator intent outranks a run in flight — the same law the
    -- manual door already applies when it clears `subprocesses`. Everything
    -- else backs off: a validated ticket at a busy place must never restart a
    -- live pipeline.
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

  -- The cooldown HOURS are a parameter, never a lookup. The vocabulary and the
  -- defaults live in exactly one place, _shared/enrich-triggers.ts, and its
  -- normalizer already fills every gap. A fallback number here would duplicate
  -- the law inside a body renames do not rewrite. SQL enforces the mechanism;
  -- TypeScript owns the number.
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
     coalesce(p_entry_stage, 'research'), coalesce(p_meta, '{}'::jsonb))
  returning id into v_new;

  return query select v_new, null::text, null::timestamptz;
end;
$function$;

comment on function public.open_place_enrichment_run(uuid, text, text, jsonb, text, integer, uuid, jsonb) is
  'Opens a run, enforcing one-open-per-place and the caller-supplied cooldown atomically. Returns blocked=''cooldown''|''already_open'' instead of raising. MESITA-1185.';

revoke execute on function public.open_place_enrichment_run(uuid, text, text, jsonb, text, integer, uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.open_place_enrichment_run(uuid, text, text, jsonb, text, integer, uuid, jsonb) to service_role;

-- Idempotent and attributable. `ended_at is null` makes a double close a no-op,
-- so FIRST WRITER WINS and the layered closers need no coordination.
-- p_expected_run_id is the anti-misattribution guard: if a manual re-enrich
-- superseded a run mid-flight and opened a new one, a late write from the old
-- background task must not land its cost on the new run.
create or replace function public.close_place_enrichment_run(
  p_run_id    uuid,
  p_outcome   text,
  p_reason    text    default null,
  p_stage     text    default null,
  p_cost_usd  numeric default null,
  p_charges   jsonb   default null,
  p_meta      jsonb   default null
) returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v_n integer;
begin
  if p_run_id is null then return false; end if;
  update public.place_enrichment_runs r
     set ended_at      = now(),
         outcome       = p_outcome,
         end_reason    = coalesce(left(p_reason, 500), r.end_reason),
         stage_reached = coalesce(p_stage, r.stage_reached),
         cost_usd      = coalesce(p_cost_usd, r.cost_usd),
         cost_charges  = coalesce(p_charges, r.cost_charges),
         meta          = r.meta || coalesce(p_meta, '{}'::jsonb)
   where r.id = p_run_id and r.ended_at is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$function$;

comment on function public.close_place_enrichment_run(uuid, text, text, text, numeric, jsonb, jsonb) is
  'Closes a run if still open. First writer wins, so every layered closer can fire without coordination. MESITA-1185.';

revoke execute on function public.close_place_enrichment_run(uuid, text, text, text, numeric, jsonb, jsonb) from public, anon, authenticated;
grant  execute on function public.close_place_enrichment_run(uuid, text, text, text, numeric, jsonb, jsonb) to service_role;

-- ── Never open forever ────────────────────────────────────────────────────
--
-- The fast-path closers cover the terminals TypeScript can reach. Two more
-- deaths happen in set-based SQL inside the poller's cron tick — the 10-minute
-- reaper and the attempts-cap sweep — with no trigger key in reach and no
-- per-row hook. Rather than restructure those two UPDATEs into data-modifying
-- CTEs (they live in run_place_enrichment_stages, the body that ran dead for two
-- days under a rename), the janitor mirrors terminal place_research state onto
-- whatever the fast path missed. The cost is precision, not correctness: a
-- reaped run records stage_reached='failed' rather than the stage that died,
-- because the reaper has already overwritten it. Recovering that is a separate,
-- higher-risk change and its own issue.
--
-- Its OWN cron job, deliberately not a block inside the poller: the janitor is
-- precisely the component that must outlive a broken poller. Symmetrically, a
-- bug in the janitor cannot take the pipeline down.
create or replace function public.close_stale_place_enrichment_runs()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v_total integer := 0; v_n integer;
begin
  -- (1) RECONCILE. The pipeline reached a terminal state but the close never
  -- landed: a dropped write, an isolate killed between the ack and the
  -- background task, an error swallowed by console.error. Also the standing
  -- path for the reaper and the attempts-cap sweep.
  --
  -- Cost is recovered ONLY for a run that entered at 'research'. For an
  -- analysis/contents entry, gathered->cost is the PREVIOUS run's spend, and
  -- billing this run for it would make cheap triggers look expensive in exactly
  -- the query this table exists to answer.
  update public.place_enrichment_runs r
     set ended_at = now(),
         outcome  = case when pr.stage = 'done' then 'succeeded' else 'failed' end,
         end_reason = coalesce(r.end_reason,
                        'reconciled from place_research: ' || coalesce(pr.error, pr.stage)),
         stage_reached = coalesce(r.stage_reached, pr.stage),
         cost_usd = coalesce(
           r.cost_usd,
           case when r.entry_stage = 'research'
                then (pr.gathered -> 'cost' ->> 'spentUsd')::numeric
           end),
         cost_charges = coalesce(
           r.cost_charges,
           case when r.entry_stage = 'research'
                then pr.gathered -> 'cost' -> 'charges'
           end)
    from public.place_research pr
   where pr.run_id = r.id
     and r.ended_at is null
     and pr.stage in ('done', 'failed');
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- (2) ORPHAN. Nothing points at this run: the seed write after the open never
  -- landed, or a newer seed took over without superseding. The grace window is
  -- the gap between open_place_enrichment_run returning and the place_research
  -- upsert committing — milliseconds in the happy path.
  update public.place_enrichment_runs r
     set ended_at = now(),
         outcome = 'abandoned',
         end_reason = 'orphaned: no pipeline row points at this run'
   where r.ended_at is null
     and r.started_at < now() - interval '15 minutes'
     and not exists (select 1 from public.place_research pr where pr.run_id = r.id);
  get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- (3) DEADLINE. Last resort, dependent on nothing. Covers the case this repo
  -- has already lived: the poller raising on every tick for 8,410 consecutive
  -- runs, so no reaper, no cap sweep and no terminal ever fired.
  --
  -- 12h is comfortably above a worst-case healthy drain (3 stages x 4 claims x a
  -- 10-minute lease, plus queue wait) and below the shortest meaningful
  -- cooldown. It never touches place_research: if the pipeline later reaches a
  -- real terminal, the fast path finds ended_at set and no-ops. The label is
  -- wrong in that rare case; the row is never stuck. Cooldown is unaffected
  -- either way, because it reads started_at.
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

comment on function public.close_stale_place_enrichment_runs() is
  'Janitor: reconciles runs the fast-path closers missed, orphans, then a 12h deadline. Its own cron so it outlives a broken poller. MESITA-1185.';

revoke execute on function public.close_stale_place_enrichment_runs() from public, anon, authenticated;
grant  execute on function public.close_stale_place_enrichment_runs() to service_role;

select cron.unschedule('close-stale-place-enrichment-runs')
where exists (select 1 from cron.job where jobname = 'close-stale-place-enrichment-runs');
select cron.schedule(
  'close-stale-place-enrichment-runs',
  '*/5 * * * *',
  $cron$ select public.close_stale_place_enrichment_runs(); $cron$
);

-- ── Retention ─────────────────────────────────────────────────────────────
--
-- Shape copied from the repo's one precedent, prune-cron-run-details: guarded
-- idempotent unschedule, inline delete, no wrapper function, daily 5-field
-- schedule. Offset from its 04:00 slot so the two never contend.
--
-- Row rate: the live emitters are on_create (about one row per place, ever) and
-- on_schedule, whose cron is capped at 5 places per 15-minute tick = 480 rows/day
-- absolute ceiling. Manual runs are hand-driven.
--
-- The window is 400 days, not the 90 you would guess, and the reason is the
-- cooldown: the normalizer clamps cooldownHours at 8760 (one year), so an
-- operator may legally set a 365-day cooldown. A prune shorter than that clamp
-- would delete the anchor and SILENTLY UNLOCK the cooldown it exists to enforce.
-- Retention must outlive the longest window the normalizer will accept.
-- `ended_at is not null` is the second belt: an open run is never prunable.
select cron.unschedule('prune-place-enrichment-runs')
where exists (select 1 from cron.job where jobname = 'prune-place-enrichment-runs');
select cron.schedule(
  'prune-place-enrichment-runs',
  '20 4 * * *',
  $cron$ delete from public.place_enrichment_runs
          where ended_at is not null
            and started_at < now() - interval '400 days'; $cron$
);
