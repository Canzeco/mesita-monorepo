// Place-research row lifecycle helpers for the Enricher stage machine.
// Extracted from enrich-pipeline.ts (stage claim / advance / fail I/O).

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { RunTrigger, SubprocessKey } from "./enrich-triggers.ts";
import type {
  AnalysisPayload,
  GatheredPayload,
  PlaceResearchRow,
  ResearchStage,
} from "./enrich-pipeline.ts";

/** True while the Enricher is mid-pipeline (any of the three live stages). */
export function isEnrichingStage(
  stage: string | null | undefined,
): boolean {
  return stage === "research" || stage === "analysis" || stage === "contents";
}

/**
 * Flip projects.content_status → generating for the whole pipeline run.
 * Contents is the only stage that lands ready; research/analysis must NOT
 * clear Enriching. Re-enrich of an already-ready place MUST call this —
 * otherwise consumer is_enriching (keyed on content_status) stays false.
 */
export async function markProjectGenerating(
  admin: SupabaseClient,
  projectId: string,
): Promise<void> {
  const { error } = await admin
    .from("projects")
    .update({ content_status: "generating" })
    .eq("id", projectId);
  if (error) {
    console.error("[enrich-pipeline] markProjectGenerating:", error.message);
  }
}

// Seed (or re-seed) the pipeline row for a project. Called by the create EFs
// right after the minimal 'generating' place lands. Upsert: re-creating a
// place (or manually re-enriching) resets the row to the research stage.
// Also stamps content_status='generating' so Enriching stays on for the
// full research → analysis → contents run (MESITA-453).
/**
 * Open a run, then seed the pipeline row — in that order, on purpose.
 *
 * The run row is written BEFORE `place_research` and before a cent is spent, so
 * that if the seed write dies the cooldown has already ticked. Every failure
 * mode fails CLOSED: the alternative (seed first, record after) lets a crash
 * between the two re-open an expensive trigger on the next event, forever.
 *
 * `run` is required and has no default. The trigger used to be unrepresentable
 * here, and the 5th positional argument silently defaulted to null — which is
 * how the manual door came to write `subprocesses: null` without ever saying so.
 * Required-and-explicit means no caller can seed without stating what provoked
 * it, which is the whole point of MESITA-1185.
 *
 * Returns `blocked` instead of an error when the open is refused: a cooldown or
 * an already-running pipeline is a NORMAL outcome for an event-driven trigger,
 * not a failure the caller should surface as one.
 */
export async function seedPlaceResearch(
  admin: SupabaseClient,
  projectId: string,
  googlePlaceId: string,
  createdBy: string,
  run: {
    trigger: RunTrigger;
    /** NULL keeps the pre-matrix contract: the stage EFs run every subprocess. */
    subprocesses: SubprocessKey[] | null;
    /**
     * REQUIRED, not optional (MESITA-1184). 0 disables the check, and every
     * caller today legitimately wants 0 — but an OMITTED cooldown silently
     * defaulting to "no window" is precisely how this knob stayed orphaned
     * while the SQL to enforce it already existed. A new event-driven caller
     * must now state its window or fail to compile.
     * The NUMBER lives in enrich-triggers.ts, never in SQL.
     */
    cooldownHours: number;
    actorUserId?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<
  { ok: boolean; error?: string; runId?: string; blocked?: "cooldown" | "already_open" }
> {
  const opened = await openEnrichmentRun(admin, projectId, {
    ...run,
    seededBy: createdBy,
    entryStage: "research",
  });
  if (!opened.ok) return { ok: false, error: opened.error };
  if (opened.blocked) return { ok: false, blocked: opened.blocked };

  const { error } = await admin.from("place_research").upsert({
    place_id: projectId,
    google_place_id: googlePlaceId,
    stage: "research",
    status: "pending",
    attempts: 0,
    gathered: null,
    analysis: null,
    error: null,
    subprocesses: run.subprocesses,
    created_by: createdBy,
    run_id: opened.runId ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "place_id" });
  if (error) {
    // The run stays open and un-pointed-at; the janitor's orphan sweep closes it
    // as `abandoned` after its grace window. Deliberately not closed here: a
    // failed write is exactly the moment not to trust another write.
    return { ok: false, error: error.message, runId: opened.runId };
  }
  await markProjectGenerating(admin, projectId);
  return { ok: true, runId: opened.runId };
}

/**
 * Open a run row without seeding — for the light re-enrich modes, which reuse
 * the stored payloads and enter mid-pipeline rather than reseeding to research.
 *
 * `entryStage` is load-bearing for cost: a run entering at analysis or contents
 * did NOT pay for the gather it reuses, so the janitor must never credit it with
 * that gather's spend.
 */
export async function openEnrichmentRun(
  admin: SupabaseClient,
  projectId: string,
  opts: {
    trigger: RunTrigger;
    seededBy: string;
    subprocesses?: SubprocessKey[] | null;
    entryStage?: ResearchStage;
    /** REQUIRED — see seedPlaceResearch above. 0 disables the check. */
    cooldownHours: number;
    actorUserId?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<
  { ok: boolean; error?: string; runId?: string; blocked?: "cooldown" | "already_open" }
> {
  const { data, error } = await admin.rpc("open_place_enrichment_run", {
    p_place_id: projectId,
    p_trigger: opts.trigger,
    p_seeded_by: opts.seededBy,
    p_subprocesses: opts.subprocesses ?? null,
    p_entry_stage: opts.entryStage ?? "research",
    p_cooldown_hours: Math.max(0, Math.round(opts.cooldownHours)),
    p_actor_user_id: opts.actorUserId ?? null,
    p_meta: opts.meta ?? {},
  });
  if (error) return { ok: false, error: `open_run: ${error.message}` };
  const row = (Array.isArray(data) ? data[0] : data) as
    | { run_id?: string | null; blocked?: string | null }
    | null
    | undefined;
  if (row?.blocked === "cooldown" || row?.blocked === "already_open") {
    return { ok: true, blocked: row.blocked };
  }
  return { ok: true, runId: row?.run_id ?? undefined };
}

/**
 * Close a run. Idempotent by construction — first writer wins in SQL — so every
 * layered closer can fire without coordinating with the others.
 */
export async function closeEnrichmentRun(
  admin: SupabaseClient,
  runId: string | null | undefined,
  outcome: "succeeded" | "failed" | "superseded" | "abandoned",
  opts: {
    reason?: string;
    stage?: string | null;
    costUsd?: number | null;
    charges?: unknown;
    meta?: Record<string, unknown>;
  } = {},
): Promise<void> {
  if (!runId) return;
  const { error } = await admin.rpc("close_place_enrichment_run", {
    p_run_id: runId,
    p_outcome: outcome,
    p_reason: opts.reason ?? null,
    p_stage: opts.stage ?? null,
    p_cost_usd: opts.costUsd ?? null,
    p_charges: opts.charges ?? null,
    p_meta: opts.meta ?? null,
  });
  // Best-effort by design: the janitor reconciles anything this misses, so a
  // failed close must never take down the terminal path it is reporting on.
  if (error) console.error("[enrich-pipeline] close_run:", error.message);
}

// Load the row a stage EF was invoked for, verifying it is actually claimed at
// the expected stage (guards against duplicate/stale pokes from the poller).
export async function loadClaimedRow(
  admin: SupabaseClient,
  projectId: string,
  stage: ResearchStage,
): Promise<{ ok: true; row: PlaceResearchRow } | { ok: false; reason: string }> {
  const { data, error } = await admin
    .from("place_research")
    .select("place_id, google_place_id, stage, status, attempts, gathered, analysis, error, subprocesses, run_id")
    .eq("place_id", projectId)
    .maybeSingle();
  if (error) return { ok: false, reason: `row_read: ${error.message}` };
  if (!data) return { ok: false, reason: "row_not_found" };
  const row = data as PlaceResearchRow;
  if (row.stage !== stage) return { ok: false, reason: `stage_mismatch: row is at '${row.stage}'` };
  if (row.status !== "running") return { ok: false, reason: `not_claimed: status '${row.status}'` };
  return { ok: true, row };
}

// Advance to the next stage (attempts reset; status back to 'pending' so the
// next poller tick picks it up) or land the terminal 'done'.
export async function advanceResearchStage(
  admin: SupabaseClient,
  projectId: string,
  nextStage: ResearchStage,
  patch: Partial<{ gathered: GatheredPayload; analysis: AnalysisPayload }> = {},
  // The run this hop belongs to. Only used at the terminal hop; a mid-pipeline
  // hop is not the end of a run — `attempts` resetting here is exactly why one
  // logical run can span a dozen EF invocations.
  run: { runId?: string | null; costUsd?: number | null; charges?: unknown } = {},
): Promise<void> {
  const { error } = await admin
    .from("place_research")
    .update({
      stage: nextStage,
      status: "pending",
      attempts: 0,
      error: null,
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("place_id", projectId);
  if (error) console.error(`[enrich-pipeline] advance→${nextStage}:`, error.message);
  if (nextStage === "done") {
    await closeEnrichmentRun(admin, run.runId, "succeeded", {
      reason: "the queue reached done",
      stage: "done",
      costUsd: run.costUsd ?? null,
      charges: run.charges ?? null,
    });
  }
}

// Release a row after a soft failure: back to 'pending' at the SAME stage so
// the poller retries it (attempts was bumped at claim time; the poller's cap
// turns a repeat offender into stage 'failed').
export async function releaseResearchRow(
  admin: SupabaseClient,
  projectId: string,
  errorMsg: string,
): Promise<void> {
  const { error } = await admin
    .from("place_research")
    .update({ status: "pending", error: errorMsg.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("place_id", projectId);
  if (error) console.error("[enrich-pipeline] release:", error.message);
}

// Hard-fail a row (non-retryable, e.g. Google spine incomplete): terminal
// stage 'failed' + flip the project's content_status so the place doesn't
// strand at 'generating'.
export async function failResearchRow(
  admin: SupabaseClient,
  projectId: string,
  errorMsg: string,
  run: {
    runId?: string | null;
    stage?: string | null;
    costUsd?: number | null;
    charges?: unknown;
    meta?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const { error } = await admin
    .from("place_research")
    .update({ stage: "failed", status: "pending", error: errorMsg.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("place_id", projectId);
  if (error) console.error("[enrich-pipeline] fail:", error.message);
  await closeEnrichmentRun(admin, run.runId, "failed", {
    reason: errorMsg,
    // The stage the run DIED IN. Captured from the claimed row before this
    // update overwrites `place_research.stage` with 'failed' — after which
    // nothing in the schema can say which stage it was.
    stage: run.stage ?? null,
    costUsd: run.costUsd ?? null,
    charges: run.charges ?? null,
    meta: run.meta,
  });
  const { error: projErr } = await admin
    .from("projects")
    .update({ content_status: "failed" })
    .eq("id", projectId);
  if (projErr) console.error("[enrich-pipeline] fail content_status:", projErr.message);
}
