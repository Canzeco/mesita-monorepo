// Supabase Edge Function — admin-web-enrich-place (product caller / admin)
//
// Manual enrich trigger for one place or a list (placeIds, max 50). Given a
// place id and a `mode`, it reseeds place_research so the pg_cron poller
// (run_place_enrichment_stages) runs from a chosen stage:
//
//   mode 'fill'      → default. Reseed to research but KEEP stored payloads.
//                      A step runs only when it has not completed, or it is
//                      named in `overwrite`. Description and Embedding also
//                      run when an earlier step of this run executed.
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
  markPlaceGenerating,
  openEnrichmentRun,
  seedPlaceResearch,
} from "../_shared/enrich-pipeline.ts";
import { parseOverwrite, type FillStep } from "../_shared/enrich-fill.ts";

// `placeId` is the canonical MESITA-26 key; `projectId` is the legacy alias
// both consoles still send here. readPlaceIdAlias accepts both (placeId wins).
type ReenrichMode = "fill" | "full" | "analysis" | "contents";
type Body = {
  projectId?: string;
  placeId?: string;
  placeIds?: string[];
  mode?: string;
  overwrite?: unknown;
};

const MODES: ReenrichMode[] = ["fill", "full", "analysis", "contents"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const actorUserId = authRes.user.id;
  const guard = await requireSuperAdmin(admin, authRes.user, "Only admins can re-enrich places.");
  if (!guard.ok) return guard.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const listed = Array.isArray(bodyRes.body.placeIds)
    ? bodyRes.body.placeIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];
  const placeId = readPlaceIdAlias(bodyRes.body);
  const placeIds = listed.length > 0 ? listed : placeId ? [placeId] : [];
  if (placeIds.length === 0) return json({ ok: false, error: "Missing placeId" }, 400);
  if (placeIds.length > 50) {
    return json({ ok: false, error: "At most 50 places per enrich call." }, 400);
  }

  // Default is fill: complete steps that have not landed. `full` is the old
  // re-run-everything path, kept so a caller can still force it.
  const mode = (bodyRes.body.mode ?? "fill").toString().trim() as ReenrichMode;
  if (!MODES.includes(mode)) {
    return json({ ok: false, error: `Invalid mode '${mode}'. Expected one of: ${MODES.join(", ")}.` }, 400);
  }

  const parsedOverwrite = parseOverwrite(bodyRes.body.overwrite);
  if (!Array.isArray(parsedOverwrite)) {
    return json({ ok: false, error: parsedOverwrite.error }, 400);
  }
  const overwrite: FillStep[] = parsedOverwrite;

  async function enrichOne(id: string): Promise<{ ok: true; stage: string } | { ok: false; error: string; status: number }> {
  // Resolve the identity spine the pipeline re-checks first (fetchGoogleBasics).
  // google_place_id lives on the place_profiles base table (place_profiles.id ==
  // the editor's placeId); the places table has no such column. Without
  // it the research stage can't run, so reject early.
  const { data: place, error: placeErr } = await admin
    .from("place_profiles")
    .select("id, google_place_id")
    .eq("id", id)
    .maybeSingle();
  if (placeErr) return { ok: false, error: `places: ${placeErr.message}`, status: 500 };
  if (!place) return { ok: false, error: "Place not found", status: 404 };
  const googlePlaceId = (place.google_place_id ?? "").toString().trim();
  if (!googlePlaceId) {
    return {
      ok: false,
      error: "Place has no Google Place ID — nothing to enrich from.",
      status: 422,
    };
  }

  // ── Full re-enrich: reseed to 'research' (nulls stored payloads).
  // Fill keeps the stored payloads and only runs steps that have not completed,
  // plus anything named in overwrite. ──
  if (mode === "full" || mode === "fill") {
    // `manual`, not a matrix trigger. The Run-now button opts out of the grid on
    // both axes — it clears `subprocesses` and ignores cooldown — so recording it
    // as a matrix trigger would poison exactly the cost-attribution and cooldown
    // queries the run history exists to answer (MESITA-1185).
    const seed = await seedPlaceResearch(admin, id, googlePlaceId, "admin-web-enrich-place", {
      trigger: "manual",
      subprocesses: null,
      cooldownHours: 0,
      actorUserId,
      keepPayloads: mode === "fill",
      clearAnalysis: mode === "fill" && overwrite.includes("images"),
      meta: mode === "fill" ? { mode, fill: true, overwrite } : { mode },
    });
    if (!seed.ok) return { ok: false, error: seed.error ?? "Failed to queue enrichment", status: 500 };
    return { ok: true, stage: "research" };
  }

  // ── Lighter modes: reseed to the chosen stage, REUSING the stored payloads.
  // Require that a prior full run populated what the stage depends on. ──
  const stage: "analysis" | "contents" = mode === "analysis" ? "analysis" : "contents";
  const { data: row, error: rowErr } = await admin
    .from("place_research")
    .select("gathered, analysis")
    .eq("place_id", id)
    .maybeSingle();
  if (rowErr) return { ok: false, error: `place_research: ${rowErr.message}`, status: 500 };
  if (!row) {
    return {
      ok: false,
      error: "No enrichment run exists for this place yet — run a full re-enrich first.",
      status: 422,
    };
  }
  if (!row.gathered) {
    return {
      ok: false,
      error: "No gathered research data — run a full re-enrich first.",
      status: 422,
    };
  }
  if (stage === "contents" && !row.analysis) {
    return {
      ok: false,
      error: "No analysis data — run a full or analysis re-enrich first.",
      status: 422,
    };
  }

  // advanceResearchStage reseeds (stage + state='pending' + attempts=0) without
  // touching gathered/analysis — the poller re-claims the row at the chosen stage.
  // MESITA-453: Enriching covers the whole pipeline (research|analysis|contents),
  // so flip content_state back to generating for light re-enrich modes too.
  await markPlaceGenerating(admin, id);
  // Explicit operator intent outranks the trigger matrix: clear whatever
  // subprocess set the last automatic trigger stamped, so a light re-enrich
  // queued after (say) an on_visit refresh still runs every step of its stage.
  // A light re-enrich is still a RUN: it spends money and it changes the
  // profile. It enters mid-pipeline, and `entryStage` is what stops the janitor
  // later crediting it with the spend of the gather it is reusing.
  const opened = await openEnrichmentRun(admin, id, {
    trigger: "manual",
    seededBy: "admin-web-enrich-place",
    subprocesses: null,
    entryStage: stage,
    cooldownHours: 0,
    actorUserId,
    meta: { mode },
  });
  await admin
    .from("place_research")
    .update({ subprocesses: null, run_id: opened.runId ?? null })
    .eq("place_id", id);
  await advanceResearchStage(admin, id, stage);
  return { ok: true, stage };
  }

  const results = [];
  for (const id of placeIds) {
    const one = await enrichOne(id);
    results.push({ placeId: id, ...one });
  }
  if (placeIds.length === 1 && listed.length === 0) {
    const one = results[0];
    if (!one.ok) return json({ ok: false, error: one.error }, one.status);
    return json({ ok: true, enrichmentTriggered: true, mode, stage: one.stage });
  }
  const failed = results.filter((r) => !r.ok).length;
  return json({
    ok: failed === 0,
    enrichmentTriggered: failed < results.length,
    mode,
    results,
  }, failed === results.length ? 422 : 200);
});
