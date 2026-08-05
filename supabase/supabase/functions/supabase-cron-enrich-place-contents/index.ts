// Supabase Edge Function — supabase-cron-enrich-place-contents (artificial caller / cron)
//
// Stage 3 (final) of the Enricher pipeline. The pg_cron poller claims
// place_research rows at stage='contents' and fires this EF with { project_id }.
// It acks 202 immediately and runs the WRITE half in a background task:
//
//   S7  synthesis (About/details, grounded ONLY in gathered material — Google
//       spine + reviews + SERP blurb + IG bio; no website/menu) + category
//       inference + tag inference (closed vocabularies) + Selected Reservation
//       Endpoint (phone → products.reservations; voice-only, MESITA-842)
//   S8  persist the enriched profile onto the places row (direct UPDATE — this
//       EF is already the DB layer; no HTTP hop) + content_status='ready'
//   S9  store images via supabase-edgefunc-store-place-images (kept as an EF call
//       on purpose: the storage mirroring runs in that worker's own wall clock)
//
// Ends the pipeline: place_research.stage='done'. The gathered/analysis jsonb
// stay on the row, so re-synthesis without re-scraping = reset stage to
// 'contents' and let the poller re-run just this stage.
//
// Contract: verify_jwt=true; requireInternalCaller gates the service-role bearer.
//
// Local:  supabase functions serve supabase-cron-enrich-place-contents
// Deploy: supabase functions deploy supabase-cron-enrich-place-contents

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { invokeArtificialCaller } from "../_shared/internal.ts";
import { applyProfileToUpdate, synthesisModelFor, synthesizeProfile } from "../_shared/enrich-synthesis.ts";
import { COST, loadEnrichConfig } from "../_shared/enrich-config.ts";
import {
  costFromGathered,
  createEnrichCostLedger,
  synthesisRunCost,
} from "../_shared/enrich-cost.ts";
import { runPlaceEmbeddingsOnUpdate } from "../_shared/place-embeddings.ts";
import { fetchPlaceCategories, inferPlaceCategory } from "../_shared/categories.ts";
import { fetchPlaceTags, inferPlaceTags } from "../_shared/tags.ts";
import {
  coerceReservationsPolicy,
  hasReservationTarget,
  mergeProductsReservations,
  selectReservationEndpoint,
} from "../_shared/enrich-reservation-endpoint.ts";
import { humanizeCategorySlug } from "../_shared/parse-utils.ts";
import {
  advanceResearchStage,
  buildMediaAssets,
  releaseResearchRow,
  reportEnrichmentStep,
  serveEnrichStage,
} from "../_shared/enrich-pipeline.ts";

serveEnrichStage("contents", async (admin, env, row) => {
  const projectId = row.project_id;
  const { gathered, analysis } = row;
  if (!gathered) {
    // Research output missing (shouldn't happen) — send the row back to research.
    await advanceResearchStage(admin, projectId, "research");
    return;
  }
  if (!analysis) {
    await advanceResearchStage(admin, projectId, "analysis");
    return;
  }
  const OPENAI_KEY = Deno.env.get("OPENAI_KEY");
  if (!OPENAI_KEY) {
    await releaseResearchRow(admin, projectId, "server_misconfigured: missing OPENAI_KEY");
    return;
  }
  const cfg = await loadEnrichConfig(admin);
  const ledger = createEnrichCostLedger(cfg.perRunCostCapUsd, costFromGathered(gathered));

  const place: Record<string, unknown> = { ...gathered.place };
  const name = (place.name ?? "").toString();
  const category = (place.category ?? null) as string | null;
  const { igBio, googleReviewsText, serpSummary } = gathered.grounding;

  if (analysis.finalPhotos.length > 0) place.photos = analysis.finalPhotos;

  // ━━━ S7 — synthesis + category + tags ━━━
  // Admin cost model: synthesis + 2 × gpt-4o-mini (category then tags).
  const synthCost = synthesisRunCost(cfg.synthesisQuality);
  const classifyCost = COST.sort * 2;
  ledger.assertCanAfford(synthCost + classifyCost, "synthesis_and_classify");

  const { parsed, diag: synthDiag } = await synthesizeProfile({
    openaiKey: OPENAI_KEY,
    model: synthesisModelFor(cfg.synthesisQuality),
    name,
    locationLine: gathered.locationLine,
    category,
    igBio,
    googleReviewsText,
    serpSummary,
  });
  ledger.charge("synthesis", synthCost);
  const sources: Record<string, unknown> = { ...gathered.sources, image_funnel: analysis.diag, synthesis: synthDiag };
  if (parsed) applyProfileToUpdate(place, parsed);

  // About first (above), then category, then tags — each step feeds the next.
  // Category + tags both ground primarily on the synthesized About.
  const [categoryList, tagVocabulary] = await Promise.all([
    fetchPlaceCategories(admin),
    fetchPlaceTags(admin),
  ]);
  // 'undefined' is the create-path placeholder, not a real category — never
  // offer it to the classifier (thin-signal places would land there).
  const realCategories = categoryList.filter((c) => c.slug !== "undefined");
  const aboutText = ((place.description ?? null) as string | null)?.slice(0, 1500) || null;
  const inferredCategory = await inferPlaceCategory(OPENAI_KEY, realCategories, {
    name,
    address: (place.address ?? null) as string | null,
    editorialSummary: (place.editorial_summary ?? null) as string | null,
    // Prefer the About we just synthesized; fall back to IG bio when synthesis
    // produced nothing (thin harvest).
    description: aboutText || igBio || null,
  });
  if (inferredCategory) {
    place.category = inferredCategory;
    place.category_label =
      realCategories.find((c) => c.slug === inferredCategory)?.label ??
      humanizeCategorySlug(inferredCategory) ?? inferredCategory;
  }
  const categoryForTags = (place.category ?? category) as string | null;
  const inferredTags = await inferPlaceTags(OPENAI_KEY, tagVocabulary, {
    name,
    category: categoryForTags,
    description: aboutText,
    googleReviewsText,
    serpSummary,
  });
  if (inferredTags.length > 0) place.tags = inferredTags;
  ledger.charge("category_tags", classifyCost);
  sources.category = { ok: !!inferredCategory, slug: inferredCategory, candidates: realCategories.length };
  sources.tags = { ok: inferredTags.length > 0, count: inferredTags.length, vocabulary: tagVocabulary.length };
  sources.cost = ledger.snapshot();

  // Selected Reservation Endpoint (Product Rules §G / MESITA-597 / MESITA-842) —
  // seed products.reservations { channel, value } for the Reservationist.
  // Voice-only: phone is the sole serving channel (WhatsApp unreachable since
  // MESITA-839). Priority / parked knobs still live on reservations_config, but
  // the eligible set is phone. Phone is stripped from gathered.place
  // (research-only write), so read the live places.phone. Skip when admin
  // already picked phone — unless respectAdminOverride is off. Legacy
  // whatsapp/instagram picks are NOT overrides (hasReservationTarget).
  const { data: settingsRow } = await admin
    .from("app_settings")
    .select("reservations_config")
    .eq("id", 1)
    .maybeSingle();
  const reservationsPolicy = coerceReservationsPolicy(settingsRow?.reservations_config);

  const { data: liveContacts } = await admin
    .from("places")
    .select("phone, products")
    .eq("id", projectId)
    .maybeSingle();
  const liveProducts = liveContacts?.products ?? null;
  let reservationChannel: string | null = null;
  if (reservationsPolicy.respectAdminOverride && hasReservationTarget(liveProducts)) {
    const existing = (liveProducts as Record<string, unknown>).reservations as {
      channel?: string;
    };
    reservationChannel = existing.channel ?? null;
    sources.reservation_endpoint = { ok: true, via: "admin_override", channel: reservationChannel };
  } else {
    const candidates = {
      phone: (liveContacts?.phone as string | null | undefined) ?? null,
    };
    const { target, diag: reservationDiag } = selectReservationEndpoint({
      candidates,
      policy: reservationsPolicy,
    });
    sources.reservation_endpoint = reservationDiag;
    if (target) {
      place.products = mergeProductsReservations(liveProducts, target);
      reservationChannel = target.channel;
    }
  }

  place.enriched_at = new Date().toISOString();
  place.enrichment_sources = sources;

  // Captured for the single stage beacon below — a dropped/missing About must
  // be visible in the feed, not claimed as written.
  const aboutWritten = typeof place.description === "string" && place.description.length > 0;

  // ━━━ S8 — persist the profile (direct UPDATE; this EF IS the DB layer) ━━━
  // Strip identity/timestamps so the DB owns them; keys absent are untouched
  // (same contract as the retired enricher-agent-write-place-data hop). Also strip
  // phone/email: contacts come from Mesita input or the Google spine, and phone is
  // persisted by the research stage alone (research-only = full re-enrich). The
  // contents stage runs on every re-enrich mode, so it must NEVER write a contact —
  // otherwise a lighter analysis/contents-only re-run would re-apply a stale
  // phone/email from `gathered.place` and clobber a business edit. (The strip also
  // covers place_research rows seeded before this change, whose gathered still
  // carries phone/email.)
  // Same for names (MESITA-917): google_name + sticky Mesita name are written in
  // research only. Contents must NEVER write `name` / `google_name` — otherwise
  // Re-enrich silently reverts an admin Mesita rename (the landmine this closes).
  const {
    id: _dropId,
    created_at: _dropCreated,
    updated_at: _dropUpdated,
    phone: _dropPhone,
    email: _dropEmail,
    name: _dropName,
    google_name: _dropGoogleName,
    ...placeUpdate
  } = place as Record<string, unknown> & {
    id?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
    phone?: unknown;
    email?: unknown;
    name?: unknown;
    google_name?: unknown;
  };
  const { error: placeErr } = await admin.from("places").update(placeUpdate).eq("id", projectId);
  if (placeErr) {
    // Persist failed — the run is aborted here, so this failed beacon IS the
    // stage's single notification.
    await reportEnrichmentStep(admin, projectId, "S7", "publish", "failed",
      "Profile persist failed — the place record was not updated.", { error: placeErr.message });
    await releaseResearchRow(admin, projectId, `place_update: ${placeErr.message}`);
    return;
  }
  const { error: projErr } = await admin
    .from("projects")
    .update({ content_status: "ready" })
    .eq("id", projectId);
  if (projErr) {
    await releaseResearchRow(admin, projectId, `content_status: ${projErr.message}`);
    return;
  }

  // On-Update S2/S3 — synthesize short embedding blurb (no tags) + vector.
  // Best-effort: profile is already ready; a failed embed leaves lazy
  // recommender backfill as the safety net.
  const openaiKey = Deno.env.get("OPENAI_KEY")?.trim();
  await runPlaceEmbeddingsOnUpdate(
    admin,
    projectId,
    openaiKey,
    "enrich-contents/on-update",
  );

  // ━━━ S9 — store images (own EF: storage mirroring gets its own wall clock) ━━━
  // Profile is already persisted (ready); image mirroring is best-effort — a
  // failure still leaves photos rendering from source URLs, and a re-run can
  // re-mirror. So it never fails the run, only colours the summary below.
  const assets = buildMediaAssets(gathered, analysis);
  let imagesSummary: string;
  const imagesMeta: Record<string, unknown> = {};
  if (!cfg.saveImagesToStorage) {
    // Admin turned Storage mirroring off — photos still render from their
    // source URLs; we just don't copy binaries into the bucket.
    imagesSummary = "image storage disabled (admin)";
    imagesMeta.images = "disabled";
  } else if (assets.length > 0) {
    const storeRes = await invokeArtificialCaller<{ queued?: number }>(
      env,
      "supabase-cron-enrich-place-contents",
      "supabase-edgefunc-store-place-images",
      { project_id: projectId, assets, preferred_photo_urls: analysis.finalPhotos },
    );
    if (storeRes.ok) {
      const queued = storeRes.data.queued ?? assets.length;
      imagesSummary = `stored ${queued} image(s)`;
      imagesMeta.images = "stored";
      imagesMeta.imagesStored = queued;
    } else {
      imagesSummary = "image storage failed (profile saved)";
      imagesMeta.images = "failed";
      imagesMeta.imagesError = storeRes.error;
    }
  } else {
    imagesSummary = "no images to store";
    imagesMeta.images = "skipped";
  }

  // One beacon for the whole contents stage (S7–S9) — one notification per
  // function. Reports synthesis + persist + image outcome in a single line.
  await reportEnrichmentStep(admin, projectId, "S7", "publish", "completed",
    `Enrichment complete for “${name}” — About ${aboutWritten ? "written" : "MISSING"}, category “${place.category ?? "n/a"}”, ${inferredTags.length} tag(s), reservation ${reservationChannel ?? "—"}; ${imagesSummary}.`,
    {
      about: aboutWritten,
      category: place.category ?? null,
      tags: inferredTags.length,
      reservation: reservationChannel,
      ...imagesMeta,
    });

  await advanceResearchStage(admin, projectId, "done");
});
