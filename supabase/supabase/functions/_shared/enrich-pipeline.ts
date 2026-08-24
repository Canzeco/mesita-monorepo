// Intaker v2 pipeline plumbing — the place_research stage machine.
//
// The Intaker is a PROCESS (not an agent): a cron-driven pipeline of three
// Edge Functions over public.place_research:
//
//   stage 'research'  → supabase-cron-enrich-place-research   (S1–S4 gather)
//   stage 'analysis'  → supabase-cron-enrich-place-analysis   (S5–S6 images)
//   stage 'contents'  → supabase-cron-enrich-place-contents   (S7–S9 persist)
//   stage 'done' | 'failed' — terminal.
//
// The SQL poller (run_place_enrichment_stages, pg_cron) claims pending rows
// per stage and fires ONE net.http_post per row at the matching EF with
// { project_id }. Each EF acks 200 immediately, does its stage's work in an
// EdgeRuntime.waitUntil background task, and finishes by advancing the row
// (advanceResearchStage) or failing it (failResearchRow). A crashed stage
// leaves the row 'running'; the poller's reaper flips it back to 'pending'
// after the lease window (attempts capped → stage 'failed').
//
// Payload contracts between stages live in the jsonb columns:
//   gathered  — research output: partial place update + grounding + image pools
//   analysis  — analysis output: ranked/selected photos + per-image descriptions
//
// Beacons: each stage INSERTs a place_enrichment_events row directly (we're
// already service-role inside an EF — no HTTP hop). ONE beacon per stage run
// (per Pato: one notification per function, not per S-step) — the stage's
// summary is anchored at its first S-code (research S1, analysis S5, contents
// S7) so the admin feed still colours it by phase. The granular S1–S9 diagnostics
// live in gathered->sources, not the feed (the judge reads those, never beacons).

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "./http.ts";
import { adminClient, type EFEnv, readEFEnv } from "./auth.ts";
import { requireInternalCaller } from "./internal.ts";
import { isEnrichCostCapError } from "./enrich-cost.ts";
import type { SubprocessKey } from "./enrich-triggers.ts";
import {
  advanceResearchStage,
  closeEnrichmentRun,
  failResearchRow,
  isEnrichingStage,
  loadClaimedRow,
  markProjectGenerating,
  openEnrichmentRun,
  releaseResearchRow,
  seedPlaceResearch,
} from "./enrich-pipeline-stage.ts";

export { buildMediaAssets, mapToObject } from "./enrich-media-assets.ts";

export {
  loadEnrichmentTriggers,
  RUN_TRIGGERS,
  type RunTrigger,
  type SubprocessKey,
  subprocessesFor,
  type TriggerKey,
  wants,
} from "./enrich-triggers.ts";

export {
  advanceResearchStage,
  closeEnrichmentRun,
  failResearchRow,
  isEnrichingStage,
  loadClaimedRow,
  markProjectGenerating,
  openEnrichmentRun,
  releaseResearchRow,
  seedPlaceResearch,
};

export type ResearchStage = "research" | "analysis" | "contents" | "done" | "failed";

export type PlaceResearchRow = {
  place_id: string;
  google_place_id: string;
  stage: ResearchStage;
  status: "pending" | "running";
  attempts: number;
  gathered: GatheredPayload | null;
  analysis: AnalysisPayload | null;
  error: string | null;
  // The subprocess set this run bought, resolved from the trigger matrix at
  // seed time. NULL = run everything (pre-matrix rows, manual re-enrich).
  subprocesses: SubprocessKey[] | null;
  // The open place_enrichment_runs row this state belongs to (MESITA-1185).
  // Threaded to every terminal so a close can never land on a run that a manual
  // re-enrich already superseded. NULL on rows seeded before the runs table.
  run_id: string | null;
};

// ── Stage payloads ───────────────────────────────────────────────────────────

// Research output. `place` carries only the columns research itself resolved
// (channels, contacts, reviews, follower counts, verified IG…) — the contents
// stage merges synthesis on top and persists the union.
export type GatheredPayload = {
  place: Record<string, unknown>;
  grounding: {
    igBio: string;
    googleReviewsText: string;
    serpSummary: string | null;
  };
  images: {
    google: string[];
    instagram: string[];
    existingPhotos: string[];
  };
  // Maps serialised as plain objects (jsonb has no Map).
  instagramAssetMeta: Record<string, {
    likes_count: number | null;
    caption: string | null;
    source_metadata: Record<string, unknown>;
  }>;
  locationLine: string;
  sources: Record<string, unknown>;
  // Accumulated estimated USD for this enrichment run (MESITA-624). Carried
  // across research → analysis → contents so the per-run cap spans stages.
  cost?: {
    spentUsd: number;
    charges: { key: string; usd: number }[];
  };
};

export type AnalysisPayload = {
  finalPhotos: string[];
  saved: { url: string; source: "google" | "website" | "instagram" }[];
  imageAnalysisByUrl: Record<string, string>;
  diag: Record<string, unknown>;
};

// ── Step beacons ─────────────────────────────────────────────────────────────

// Direct INSERT into place_enrichment_events (same contract as the retired
// enricher-agent-report-step EF, minus the HTTP hop). Best-effort: a beacon
// failure never breaks an enrichment run.
export async function reportEnrichmentStep(
  admin: SupabaseClient,
  projectId: string,
  // `SX` is the EXTRA marker: semantics runs outside the queue, so it has no
  // rung to number. Anything else is a real position (MESITA-1230).
  step: `S${number}` | "SX",
  stepName: string,
  status: "started" | "completed" | "failed" | "skipped",
  detail: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await admin.from("place_enrichment_events").insert({
      place_id: projectId,
      step,
      step_name: stepName.slice(0, 80),
      status,
      detail: detail.slice(0, 500),
      meta,
    });
    if (error) console.error(`[enrich-pipeline] beacon ${step}:`, error.message);
  } catch (err) {
    console.error(`[enrich-pipeline] beacon ${step}:`, err instanceof Error ? err.message : err);
  }
}

// ── Misc shared bits ─────────────────────────────────────────────────────────

// Run a stage's work as an EdgeRuntime background task (ack-early pattern —
// the poller's HTTP call returns immediately; the wall clock still applies).
export function runInBackground(task: Promise<unknown>): void {
  const edgeRuntime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
  else void task;
}

// ── Stage EF server ──────────────────────────────────────────────────────────

// First step of each stage's S-range (research S1–S4, analysis S5–S6,
// contents S7–S9) — anchors the crash beacon in the admin feed's step model.
const STAGE_CRASH_STEP: Partial<Record<ResearchStage, `S${number}`>> = {
  research: "S1",
  analysis: "S5",
  contents: "S7",
};

// The boilerplate every stage EF shares: guards → internal-caller gate →
// parse { project_id } → verify the row is claimed at this stage → ack 202 →
// run the stage's work in the background. The runner owns
// advance/release/fail; a thrown error releases the row for a retry.
export function serveEnrichStage(
  stage: ResearchStage,
  run: (
    admin: ReturnType<typeof adminClient>,
    env: EFEnv,
    row: PlaceResearchRow,
  ) => Promise<void>,
): void {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return corsPreflight();
    const methodReject = rejectUnlessMethods(req, "POST");
    if (methodReject) return methodReject;

    const envRes = readEFEnv();
    if (!envRes.ok) return envRes.response;
    const callerRes = requireInternalCaller(req, envRes.env);
    if (!callerRes.ok) return callerRes.response;

    const bodyRes = await readJson<{ project_id?: string }>(req);
    if (!bodyRes.ok) return bodyRes.response;
    const projectId = (bodyRes.body.project_id ?? "").toString().trim();
    if (!projectId) return json({ ok: false, error: "project_id is required" }, 400);

    const admin = adminClient(envRes.env);
    const rowRes = await loadClaimedRow(admin, projectId, stage);
    if (!rowRes.ok) return json({ ok: false, error: rowRes.reason }, 409);

    runInBackground(
      run(admin, envRes.env, rowRes.row).catch(async (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[supabase-cron-enrich-place-${stage}]`, msg);
        // Cost-cap abort is terminal (MESITA-624) — retrying cannot unspend
        // and would burn more budget. Everything else releases for retry.
        if (isEnrichCostCapError(err)) {
          await reportEnrichmentStep(admin, projectId, STAGE_CRASH_STEP[stage] ?? "S1",
            `${stage}_cost_cap`, "failed",
            `Enrichment aborted — per-run cost cap hit: ${msg}`.slice(0, 490));
          // The cost cap is the one terminal that KNOWS the money and used to
          // lose all of it: the prose was truncated into `error` and charges[]
          // was dropped, and because the failing stage never reaches its
          // advanceResearchStage the ledger snapshot never lands on
          // gathered.cost either. Structured, on the run row, once.
          await failResearchRow(admin, projectId, msg.slice(0, 500), {
            runId: rowRes.row.run_id,
            stage,
            costUsd: err.spentUsd,
            charges: err.charges,
            meta: { kind: "cost_cap", capUsd: err.capUsd },
          });
          return;
        }
        // Surface the crash in the admin feed — silent crashes hid a wedged
        // pipeline for hours (MESITA-123). Beacon first: release must run
        // even though reportEnrichmentStep is already best-effort inside.
        await reportEnrichmentStep(admin, projectId, STAGE_CRASH_STEP[stage] ?? "S1",
          `${stage}_crash`, "failed",
          `The ${stage} stage crashed and was released for retry — ${msg}`.slice(0, 490));
        await releaseResearchRow(admin, projectId, `${stage}_crash: ${msg}`);
      }),
    );
    return json({ ok: true, accepted: true, stage, project_id: projectId }, 202);
  });
}
