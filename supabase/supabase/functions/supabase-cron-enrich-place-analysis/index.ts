// Supabase Edge Function — supabase-cron-enrich-place-analysis (internal / cron)
//
// Stage 2 of the Enricher pipeline (the Enricher is a PROCESS — a cron-driven
// pipeline of three EFs — not an agent). The pg_cron poller claims
// place_research rows at stage='analysis' and fires this EF with
// { project_id }. It acks 202 immediately and runs the IMAGE half in a
// background task:
//
//   S5  vision describe — gpt-4o-mini describes the per-source analyze-capped
//       top of each candidate bucket (parallel, detail:low)
//   S6  rank + select — text model ranks the descriptions by the experience
//       rubric; diversity floor guarantees Instagram/website representation
//
// Input:  place_research.gathered.images (+ existing photos)
// Output: place_research.analysis { finalPhotos, saved, imageAnalysisByUrl }
//         → stage='contents'.
//
// Contract: verify_jwt=true; requireInternalCaller gates the service-role bearer.
//
// Local:  supabase functions serve supabase-cron-enrich-place-analysis
// Deploy: supabase functions deploy supabase-cron-enrich-place-analysis

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { COST, loadEnrichConfig, PHOTO_CEILING, VISION_MODEL, visionModelFor } from "../_shared/enrich-config.ts";
import { loadModelsConfig } from "../_shared/models-config.ts";
import {
  costFromGathered,
  createEnrichCostLedger,
  visionRunCost,
} from "../_shared/enrich-cost.ts";
import { runImageFunnel } from "../_shared/enrich-image-funnel.ts";
import {
  advanceResearchStage,
  type AnalysisPayload,
  mapToObject,
  reportEnrichmentStep,
  serveEnrichStage,
  wants,
} from "../_shared/enrich-pipeline.ts";
import { pieceDone, reportPulsePieces } from "../_shared/pulse-report.ts";

serveEnrichStage("analysis", async (admin, _env, row) => {
  const projectId = row.place_id;
  const gathered = row.gathered;
  if (!gathered) {
    // Research output missing (shouldn't happen) — send the row back to research.
    await advanceResearchStage(admin, projectId, "research");
    return;
  }

  // A run the matrix bought without the image funnel (a cheap liveness refresh
  // has no business spending vision dollars) still walks the stage machine —
  // it just hands contents an empty gallery. Contents only writes photos when
  // the list is non-empty, so the place keeps the gallery it already had.
  if (!wants(row.subprocesses, "images")) {
    // NO BEACON HERE (MESITA-1209). This used to write
    // { step_name: "images", status: "skipped" } — and `images` is a PULSE
    // piece key, so the high-water reader saw a non-completed piece mid-ladder
    // and stopped short of it. A cheap refresh that did not buy the funnel
    // therefore knocked a complete place back down, every time it ran.
    //
    // The rule it broke is in pulse-report.ts: a piece a run did not BUY writes
    // NOTHING, so the previous run's result stands. What this run bought is
    // already recorded in place_research.subprocesses, so nothing is lost.
    await advanceResearchStage(admin, projectId, "contents", {
      analysis: {
        finalPhotos: [],
        saved: [],
        imageAnalysisByUrl: {},
        diag: { skipped: "images" },
      },
    });
    return;
  }

  const OPENAI_KEY = Deno.env.get("OPENAI_KEY");
  const cfg = await loadEnrichConfig(admin);
  const models = await loadModelsConfig(admin);
  const ledger = createEnrichCostLedger(cfg.perRunCostCapUsd, costFromGathered(gathered));

  const maxVisionImages = cfg.visionEnabled
    ? cfg.analyzeGoogleImages + cfg.analyzeInstagramImages
    : 0;
  const runVision = cfg.visionEnabled && !!OPENAI_KEY && maxVisionImages > 0;

  // Reserve the admin analyze caps + one sort call before paying for vision.
  if (runVision) {
    ledger.assertCanAfford(
      visionRunCost(maxVisionImages, cfg.visionQuality) + COST.sort,
      "vision_and_sort",
    );
  }

  const funnel = await runImageFunnel({
    googleImages: gathered.images.google,
    instagramImages: gathered.images.instagram,
    existingPhotos: gathered.images.existingPhotos,
    gatherGoogleImages: cfg.gatherGoogleImages,
    saveTotalImages: cfg.saveTotalImages,
    photoCeiling: PHOTO_CEILING,
    runVision,
    openaiKey: OPENAI_KEY,
    // Prefer models_config.enricher.model when quality resolves to the cheap default.
    visionModel: (() => {
      const q = visionModelFor(cfg.visionQuality);
      return q === VISION_MODEL ? models.enricherModel : q;
    })(),
    analyze: {
      google: cfg.analyzeGoogleImages,
      instagram: cfg.analyzeInstagramImages,
    },
    imageAnalysisPrompt: cfg.imageAnalysisPrompt,
    imageSortingPrompt: cfg.imageSortingPrompt,
  });

  const analyzed = typeof funnel.diag.analyzed === "number" ? funnel.diag.analyzed : 0;
  if (analyzed > 0) {
    ledger.charge("vision", visionRunCost(analyzed, cfg.visionQuality));
  }
  if (funnel.diag.sorted === true) {
    ledger.charge("sort", COST.sort);
  }

  // One beacon for the whole analysis stage (S5–S6) — one notification per function.
  const described = funnel.imageAnalysisByUrl.size;
  // PULSE piece 5 (images). The funnel ran; `described` is the observed
  // effect. Zero described is still a pass when vision is off by config — the
  // pool was ranked in source order, which is the funnel doing its job.
  await reportPulsePieces(admin, projectId, {
    images: pieceDone(
      `Described ${funnel.imageAnalysisByUrl.size}, selected ${funnel.finalPhotos.length}.`,
      { described: funnel.imageAnalysisByUrl.size, finalPhotos: funnel.finalPhotos.length },
    ),
  });

  // The STAGE notification, named `analysis` rather than `images`: a beacon
  // that borrows a piece key lands in the same column the ladder reads, which
  // is how MESITA-1209 happened. The piece itself is reported above.
  await reportEnrichmentStep(admin, projectId, "S5", "analysis", "completed",
    `Image analysis complete — described ${described} candidate photo(s), selected ${funnel.finalPhotos.length} final photo(s) for the profile.`,
    { described, finalPhotos: funnel.finalPhotos.length, spentUsd: ledger.spentUsd });

  const analysis: AnalysisPayload = {
    finalPhotos: funnel.finalPhotos,
    saved: funnel.saved,
    imageAnalysisByUrl: mapToObject(funnel.imageAnalysisByUrl),
    diag: funnel.diag,
  };
  // Persist the running ledger so contents can enforce the same per-run cap.
  await advanceResearchStage(admin, projectId, "contents", {
    analysis,
    gathered: { ...gathered, cost: ledger.snapshot() },
  });
});
