// Place-research row lifecycle helpers for the Enricher stage machine.
// Extracted from enrich-pipeline.ts (stage claim / advance / fail I/O).

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
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
export async function seedPlaceResearch(
  admin: SupabaseClient,
  projectId: string,
  googlePlaceId: string,
  createdBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await admin.from("place_research").upsert({
    project_id: projectId,
    google_place_id: googlePlaceId,
    stage: "research",
    status: "pending",
    attempts: 0,
    gathered: null,
    analysis: null,
    error: null,
    created_by: createdBy,
    updated_at: new Date().toISOString(),
  }, { onConflict: "project_id" });
  if (error) return { ok: false, error: error.message };
  await markProjectGenerating(admin, projectId);
  return { ok: true };
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
    .select("project_id, google_place_id, stage, status, attempts, gathered, analysis, error")
    .eq("project_id", projectId)
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
    .eq("project_id", projectId);
  if (error) console.error(`[enrich-pipeline] advance→${nextStage}:`, error.message);
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
    .eq("project_id", projectId);
  if (error) console.error("[enrich-pipeline] release:", error.message);
}

// Hard-fail a row (non-retryable, e.g. Google spine incomplete): terminal
// stage 'failed' + flip the project's content_status so the place doesn't
// strand at 'generating'.
export async function failResearchRow(
  admin: SupabaseClient,
  projectId: string,
  errorMsg: string,
): Promise<void> {
  const { error } = await admin
    .from("place_research")
    .update({ stage: "failed", status: "pending", error: errorMsg.slice(0, 500), updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (error) console.error("[enrich-pipeline] fail:", error.message);
  const { error: projErr } = await admin
    .from("projects")
    .update({ content_status: "failed" })
    .eq("id", projectId);
  if (projErr) console.error("[enrich-pipeline] fail content_status:", projErr.message);
}
