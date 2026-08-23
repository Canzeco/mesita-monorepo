// Supabase Edge Function — admin-web-enrich-place (product caller / admin)
//
// Manual re-enrich trigger for a single existing place. Given a project_id and a
// `mode`, it reseeds the Enricher pipeline row (place_research) so the pg_cron
// poller (run_place_enrichment_stages) re-runs from a chosen stage:
//
//   mode 'full'      → reseed to stage='research' (fresh gather; nulls the stored
//                      gathered/analysis) → research → analysis → contents.
//                      Refreshes the Google spine, channels, reviews, images, and
//                      generated copy. Phone is re-fetched + overridden here.
//   mode 'analysis'  → reseed to stage='analysis' (REUSES stored gathered) →
//                      analysis → contents. Re-ranks/rebuilds images + re-persists,
//                      WITHOUT re-gathering. Phone/contacts left untouched.
//   mode 'contents'  → reseed to stage='contents' (REUSES stored gathered +
//                      analysis) → contents only. Re-synthesises copy/category/tags
//                      + re-persists. Cheapest. Phone/contacts left untouched.
//
// The lighter modes need a prior full run to have populated the payloads they
// reuse (gathered for 'analysis'; gathered + analysis for 'contents'); if those
// are missing we reject with 422 so the admin runs a full re-enrich first, rather
// than silently self-healing into an unexpected full run.
//
// This is the button behind the admin Place editor's re-enrich actions. The place
// must already exist and carry a google_place_id (the pipeline's identity spine);
// an admin-created 'undefined' place still has one from create time.
//
// Internal enricher control — super-admin gated, admin console only.
//
// Local:  supabase functions serve admin-web-enrich-place
// Deploy: supabase functions deploy admin-web-enrich-place

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, readPlaceIdAlias } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import {
  advanceResearchStage,
  markProjectGenerating,
  openEnrichmentRun,
  seedPlaceResearch,
} from "../_shared/enrich-pipeline.ts";

// placeId is the MESITA-26 alias for the place-row id (== project_id here).
type ReenrichMode = "full" | "analysis" | "contents";
type Body = { projectId?: string; placeId?: string; mode?: string };

const MODES: ReenrichMode[] = ["full", "analysis", "contents"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const guard = await requireSuperAdmin(admin, authRes.user, "Only admins can re-enrich places.");
  if (!guard.ok) return guard.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const projectId = readPlaceIdAlias(bodyRes.body);
  if (!projectId) return json({ ok: false, error: "Missing projectId" }, 400);

  // Default to 'full' so legacy callers (no mode) keep the old behaviour.
  const mode = (bodyRes.body.mode ?? "full").toString().trim() as ReenrichMode;
  if (!MODES.includes(mode)) {
    return json({ ok: false, error: `Invalid mode '${mode}'. Expected one of: ${MODES.join(", ")}.` }, 400);
  }

  // Resolve the identity spine the pipeline re-checks first (fetchGoogleBasics).
  // google_place_id lives on the places base table (places.id == the project id
  // == the editor's projectId); the projects table has no such column. Without
  // it the research stage can't run, so reject early.
  const { data: place, error: placeErr } = await admin
    .from("places")
    .select("id, google_place_id")
    .eq("id", projectId)
    .maybeSingle();
  if (placeErr) return json({ ok: false, error: `places: ${placeErr.message}` }, 500);
  if (!place) return json({ ok: false, error: "Place not found" }, 404);
  const googlePlaceId = (place.google_place_id ?? "").toString().trim();
  if (!googlePlaceId) {
    return json(
      { ok: false, error: "Place has no Google Place ID — nothing to enrich from." },
      422,
    );
  }

  // ── Full re-enrich: reseed to 'research' (nulls stored payloads). ──
  if (mode === "full") {
    // `manual`, not a matrix trigger. The Run-now button opts out of the grid on
    // both axes — it clears `subprocesses` and ignores cooldown — so recording it
    // as on_schedule would poison exactly the cost-attribution and cooldown
    // queries the run history exists to answer (MESITA-1185).
    const seed = await seedPlaceResearch(admin, projectId, googlePlaceId, "admin-web-enrich-place", {
      trigger: "manual",
      subprocesses: null,
      actorUserId: authRes.user.id,
      meta: { mode },
    });
    if (!seed.ok) return json({ ok: false, error: seed.error ?? "Failed to queue enrichment" }, 500);
    return json({ ok: true, enrichmentTriggered: true, mode, stage: "research" });
  }

  // ── Lighter modes: reseed to the chosen stage, REUSING the stored payloads.
  // Require that a prior full run populated what the stage depends on. ──
  const stage: "analysis" | "contents" = mode === "analysis" ? "analysis" : "contents";
  const { data: row, error: rowErr } = await admin
    .from("place_research")
    .select("gathered, analysis")
    .eq("place_id", projectId)
    .maybeSingle();
  if (rowErr) return json({ ok: false, error: `place_research: ${rowErr.message}` }, 500);
  if (!row) {
    return json(
      { ok: false, error: "No enrichment run exists for this place yet — run a full re-enrich first." },
      422,
    );
  }
  if (!row.gathered) {
    return json(
      { ok: false, error: "No gathered research data — run a full re-enrich first." },
      422,
    );
  }
  if (stage === "contents" && !row.analysis) {
    return json(
      { ok: false, error: "No analysis data — run a full or analysis re-enrich first." },
      422,
    );
  }

  // advanceResearchStage reseeds (stage + status='pending' + attempts=0) without
  // touching gathered/analysis — the poller re-claims the row at the chosen stage.
  // MESITA-453: Enriching covers the whole pipeline (research|analysis|contents),
  // so flip content_status back to generating for light re-enrich modes too.
  await markProjectGenerating(admin, projectId);
  // Explicit operator intent outranks the trigger matrix: clear whatever
  // subprocess set the last automatic trigger stamped, so a light re-enrich
  // queued after (say) an on_visit refresh still runs every step of its stage.
  // A light re-enrich is still a RUN: it spends money and it changes the
  // profile. It enters mid-pipeline, and `entryStage` is what stops the janitor
  // later crediting it with the spend of the gather it is reusing.
  const opened = await openEnrichmentRun(admin, projectId, {
    trigger: "manual",
    seededBy: "admin-web-enrich-place",
    subprocesses: null,
    entryStage: stage,
    actorUserId: authRes.user.id,
    meta: { mode },
  });
  await admin
    .from("place_research")
    .update({ subprocesses: null, run_id: opened.runId ?? null })
    .eq("place_id", projectId);
  await advanceResearchStage(admin, projectId, stage);
  return json({ ok: true, enrichmentTriggered: true, mode, stage });
});
