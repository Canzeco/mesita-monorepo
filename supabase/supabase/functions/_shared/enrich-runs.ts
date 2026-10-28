// place_enrichment_runs: open and close a run (MESITA-1185).
//
// The stage path that used to drive these (place_research, the poller and the
// three enricher-cron-enrich-place-* EFs) was retired in MESITA-2424. The
// wrong-number refetch (google-refetch.ts) is the caller left; the janitor
// (close_stale_place_enrichment_runs) closes any run it leaves open.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { RunTrigger, SubprocessKey } from "./enrich-triggers.ts";

/**
 * Open a run row. Returns `blocked` instead of an error when the open is
 * refused: a cooldown or an already-open run is a NORMAL outcome for an
 * event-driven trigger, not a failure the caller should surface as one.
 */
export async function openEnrichmentRun(
  admin: SupabaseClient,
  placeId: string,
  opts: {
    trigger: RunTrigger;
    seededBy: string;
    subprocesses?: SubprocessKey[] | null;
    entryStage?: string;
    /**
     * REQUIRED (MESITA-1184): an omitted cooldown silently defaulting to "no
     * window" is how this knob once stayed orphaned. 0 disables the check. The
     * NUMBER lives in enrich-triggers.ts, never in SQL.
     */
    cooldownHours: number;
  },
): Promise<
  { ok: boolean; error?: string; runId?: string; blocked?: "cooldown" | "already_open" }
> {
  const { data, error } = await admin.rpc("open_place_enrichment_run", {
    p_place_id: placeId,
    p_trigger: opts.trigger,
    p_seeded_by: opts.seededBy,
    p_subprocesses: opts.subprocesses ?? null,
    p_entry_stage: opts.entryStage ?? "first",
    p_cooldown_hours: Math.max(0, Math.round(opts.cooldownHours)),
    p_actor_user_id: null,
    p_meta: {},
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
  outcome: "succeeded" | "failed",
  opts: {
    reason?: string;
    stage?: string | null;
  } = {},
): Promise<void> {
  if (!runId) return;
  const { error } = await admin.rpc("close_place_enrichment_run", {
    p_run_id: runId,
    p_outcome: outcome,
    p_reason: opts.reason ?? null,
    p_stage: opts.stage ?? null,
    p_cost_usd: null,
    p_charges: null,
  });
  // Best-effort by design: the janitor reconciles anything this misses, so a
  // failed close must never take down the terminal path it is reporting on.
  if (error) console.error("[enrich-runs] close_run:", error.message);
}
