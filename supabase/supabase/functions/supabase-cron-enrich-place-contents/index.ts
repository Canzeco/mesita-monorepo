// Supabase Edge Function — supabase-cron-enrich-place-contents (internal / cron)
//
// Stage 3 (final) of the Intaker pipeline. The pg_cron poller claims
// place_research rows at stage='contents' and fires this EF with { project_id }.
// It acks 202 immediately and runs the WRITE half in a background task:
//
//   S7  synthesis (About/details, grounded ONLY in gathered material — Google
//       spine + reviews + SERP blurb + IG bio; no website/menu) + category
//       inference + tag inference (closed vocabularies) + Selected Reservation
//       Endpoint (phone → places.reservation_channel/_target; voice-only, MESITA-842)
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
import { invokeInternalCaller } from "../_shared/internal.ts";
import {
  pieceDone,
  pieceFailed,
  reportPulsePieces,
  type PieceOutcome,
  type StampablePulseStep,
} from "../_shared/pulse-report.ts";
import {
  applyProfileToUpdate,
  synthesisModelFor,
  synthesizeProfile,
} from "../_shared/enrich-synthesis.ts";
import { COST, loadEnrichConfig } from "../_shared/enrich-config.ts";
import {
  costFromGathered,
  createEnrichCostLedger,
  synthesisRunCost,
} from "../_shared/enrich-cost.ts";
import { runPlaceEmbeddingsOnUpdate } from "../_shared/place-embeddings.ts";
import {
  fetchPlaceCategories,
  inferPlaceCategory,
} from "../_shared/categories.ts";
import { fetchPlaceTags, inferPlaceTags } from "../_shared/tags.ts";
import { loadModelsConfig } from "../_shared/models-config.ts";
import {
  coerceReservationsPolicy,
  hasReservationTarget,
  reservationTargetPatch,
  selectReservationEndpoint,
} from "../_shared/enrich-reservation-endpoint.ts";
import { humanizeCategorySlug } from "../_shared/parse-utils.ts";
import { type PlacePatch, writePlace } from "../_shared/place-doc.ts";
import {
  advanceResearchStage,
  buildMediaAssets,
  releaseResearchRow,
  reportEnrichmentStep,
  serveEnrichStage,
  wants,
} from "../_shared/enrich-pipeline.ts";
import {
  activeFieldPins,
  carryFieldPins,
  readFieldPins,
  stripPinnedColumns,
} from "../_shared/enrich-corrections.ts";

serveEnrichStage("contents", async (admin, env, row) => {
  // What this run bought, per the trigger matrix (NULL = everything).
  const buys = row.subprocesses;
  const projectId = row.place_id;
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
    await releaseResearchRow(
      admin,
      projectId,
      "server_misconfigured: missing OPENAI_KEY",
    );
    return;
  }
  const cfg = await loadEnrichConfig(admin);
  const ledger = createEnrichCostLedger(
    cfg.perRunCostCapUsd,
    costFromGathered(gathered),
  );

  const place: Record<string, unknown> = { ...gathered.place };
  // `gathered.place` deliberately carries NO name keys: the research stage
  // deletes name/google_name/mesita_name so a re-run can never ride a stale
  // label back over an operator override (MESITA-1011). Reading `place.name`
  // here therefore always yielded "" — synthesis, category and tag inference
  // were all prompted with an unnamed place. Read the live generated label
  // (coalesce(mesita_name, google_name)) instead, so an operator's Mesita name
  // is what the Intaker reasons about.
  const { data: nameRow } = await admin
    .from("places")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  const name = (nameRow?.name ?? "").toString();
  const category = (place.category ?? null) as string | null;
  const { igBio, googleReviewsText, serpSummary } = gathered.grounding;

  if (analysis.finalPhotos.length > 0) place.photos = analysis.finalPhotos;

  // ━━━ S7 — synthesis + category + tags ━━━
  // Admin cost model: synthesis + 2 × classify calls (category then tags);
  // classify model = models_config.enricher.model (MESITA-941/942).
  const sources: Record<string, unknown> = {
    ...gathered.sources,
    image_funnel: analysis.diag,
  };
  // S7 is the step that REWRITES the profile prose. A trigger that only bought
  // a liveness refresh must never re-synthesize: About, category and tags stay
  // exactly as they are, and only what research resolved is persisted below.
  let inferredTags: string[] = [];
  if (!wants(buys, "synthesis")) {
    sources.synthesis = { skipped: "subprocess_not_requested" };
  } else {
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
    sources.synthesis = synthDiag;
    if (parsed) applyProfileToUpdate(place, parsed);

    // About first (above), then category, then tags — each step feeds the next.
    // Category + tags both ground primarily on the synthesized About.
    const [categoryList, tagVocabulary, models] = await Promise.all([
      fetchPlaceCategories(admin),
      fetchPlaceTags(admin),
      loadModelsConfig(admin),
    ]);
    // 'undefined' is the create-path placeholder, not a real category — never
    // offer it to the classifier (thin-signal places would land there).
    const realCategories = categoryList.filter((c) => c.slug !== "undefined");
    const aboutText =
      ((place.description ?? null) as string | null)?.slice(0, 1500) || null;
    const enricherModel = models.enricherModel;
    const inferredCategory = await inferPlaceCategory(
      OPENAI_KEY,
      realCategories,
      {
        name,
        address: (place.address ?? null) as string | null,
        editorialSummary: (place.editorial_summary ?? null) as string | null,
        // Prefer the About we just synthesized; fall back to IG bio when synthesis
        // produced nothing (thin harvest).
        description: aboutText || igBio || null,
      },
      enricherModel,
    );
    if (inferredCategory) {
      place.category = inferredCategory;
      place.category_label = realCategories.find((c) =>
        c.slug === inferredCategory
      )?.label ??
        humanizeCategorySlug(inferredCategory) ?? inferredCategory;
    }
    const categoryForTags = (place.category ?? category) as string | null;
    inferredTags = await inferPlaceTags(OPENAI_KEY, tagVocabulary, {
      name,
      category: categoryForTags,
      description: aboutText,
      googleReviewsText,
      serpSummary,
    }, enricherModel);
    if (inferredTags.length > 0) place.tags = inferredTags;
    ledger.charge("category_tags", classifyCost);
    sources.category = {
      ok: !!inferredCategory,
      slug: inferredCategory,
      candidates: realCategories.length,
    };
    sources.tags = {
      ok: inferredTags.length > 0,
      count: inferredTags.length,
      vocabulary: tagVocabulary.length,
    };
  }
  sources.cost = ledger.snapshot();

  // Selected Reservation Endpoint (Docs › Reservations §C / MESITA-597 / MESITA-842) —
  // seed places.reservation_channel / reservation_target for the Reservationist.
  // Voice-only: phone is the sole serving channel (WhatsApp unreachable since
  // MESITA-839). Priority / parked knobs still live on reservations_config, but
  // the eligible set is phone. Phone is stripped from gathered.place
  // (research-only write), so read the live places.phone. Skip when admin
  // already picked phone — unless respectAdminOverride is off. Legacy
  // whatsapp/instagram picks are NOT overrides (hasReservationTarget).
  const { data: settingsRow } = await admin
    .from("app_config")
    .select("reservations_config")
    .eq("id", 1)
    .maybeSingle();
  const reservationsPolicy = coerceReservationsPolicy(
    settingsRow?.reservations_config,
  );

  const { data: liveContacts } = await admin
    .from("places")
    .select("phone, reservation_channel, enrichment_sources")
    .eq("id", projectId)
    .maybeSingle();
  const live = (liveContacts ?? null) as
    | {
      phone: string | null;
      reservation_channel: string | null;
      enrichment_sources: unknown;
    }
    | null;

  // Corrections (MESITA-1190) — the fields an agent already fixed. Read from
  // the LIVE row before the blob below is rebuilt, because the pins live inside
  // `enrichment_sources` and S8 assigns that column wholesale.
  const pins = activeFieldPins(readFieldPins(live?.enrichment_sources));
  let reservationChannel: string | null = null;
  if (
    reservationsPolicy.respectAdminOverride &&
    hasReservationTarget(live)
  ) {
    reservationChannel = live?.reservation_channel ?? null;
    sources.reservation_endpoint = {
      ok: true,
      via: "admin_override",
      channel: reservationChannel,
    };
  } else {
    const candidates = { phone: live?.phone ?? null };
    const { target, diag: reservationDiag } = selectReservationEndpoint({
      candidates,
      policy: reservationsPolicy,
    });
    sources.reservation_endpoint = reservationDiag;
    if (target) {
      // Two typed columns, written independently of products — the menu and
      // the routing no longer share one cell (MESITA-1208).
      Object.assign(place, reservationTargetPatch(target));
      reservationChannel = target.channel;
    }
  }

  // Corrections (MESITA-1190) — write AROUND a pinned field, never over it.
  // An agent that called the venue knows something Google does not, and
  // re-running the pipeline refetches the same wrong value; persisting it here
  // would revert the correction on every scheduled run. Absent keys are
  // untouched by the persist contract, so dropping the key IS the guard.
  // Done before the blob below is sealed so the diagnostics can name the
  // fields the Intaker stood down on. Only correctable columns are removed —
  // description/category/tags are read further down and are not correctable.
  const { update: persisted, skipped: pinnedSkipped } = stripPinnedColumns(
    place,
    pins,
  );
  if (pinnedSkipped.length > 0) sources.pins_respected = pinnedSkipped;

  persisted.enriched_at = new Date().toISOString();
  // NEVER `= sources` on its own: the pins are durable state stored in this
  // otherwise per-run blob, so a plain overwrite deletes every correction on the
  // next enrichment. `_shared/enrich-corrections.test.ts` is the gate.
  persisted.enrichment_sources = carryFieldPins(sources, pins);

  // Captured for the single stage beacon below — a dropped/missing About must
  // be visible in the feed, not claimed as written.
  const aboutWritten = typeof place.description === "string" &&
    place.description.length > 0;

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
  // `whatsapp_url` joins them (MESITA-1268): it is a MANUAL field per the
  // who-can-edit matrix, but `enrich-google-basics` classifies the Google
  // website URI into channel columns and can emit it. Research now strips it
  // from `gathered.place`, and this strip covers every place_research row
  // already stored with it — without both, a lighter re-enrich keeps replaying
  // the old payload and nulling a business-entered WhatsApp.
  // Same for names (MESITA-917): google_name + sticky Mesita name are written in
  // research only. Contents must NEVER write `name` / `google_name` — otherwise
  // Re-enrich silently reverts an admin Mesita rename (the landmine this closes).
  const {
    id: _dropId,
    created_at: _dropCreated,
    updated_at: _dropUpdated,
    phone: _dropPhone,
    email: _dropEmail,
    whatsapp_url: _dropWhatsapp,
    name: _dropName,
    google_name: _dropGoogleName,
    ...placeUpdate
  } = persisted as Record<string, unknown> & {
    id?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
    phone?: unknown;
    email?: unknown;
    whatsapp_url?: unknown;
    name?: unknown;
    google_name?: unknown;
  };
  const placeRes = await writePlace(admin, {
    table: "places",
    mode: "update",
    id: projectId,
    patch: placeUpdate as PlacePatch,
  });
  if (!placeRes.ok) {
    // Persist failed — the run is aborted here, so this failed beacon IS the
    // stage's single notification.
    await reportEnrichmentStep(
      admin,
      projectId,
      "S7",
      "publish",
      "failed",
      "Profile persist failed — the place record was not updated.",
      { error: placeRes.error },
    );
    await releaseResearchRow(
      admin,
      projectId,
      `place_update: ${placeRes.error}`,
    );
    return;
  }
  const projRes = await writePlace(admin, {
    table: "projects",
    mode: "update",
    id: projectId,
    patch: { content_status: "ready" },
  });
  if (!projRes.ok) {
    await releaseResearchRow(
      admin,
      projectId,
      `content_status: ${projRes.error}`,
    );
    return;
  }

  // On-Update S2/S3 — synthesize short embedding blurb (no tags) + vector.
  // Best-effort: the profile is already ready, so a failed embed leaves the
  // place at rung 8 rather than failing the run. There is no backfill behind
  // it — `embedAndPersistPlaces` has no callers anywhere in the repo — so a
  // stuck vector needs a re-enrich, not patience (MESITA-1222).
  // Captured so the subprocess report can say whether the embedding actually
  // landed — the function returns null on a missing key or a failed write.
  let embeddingWrote = false;
  if (wants(buys, "embedding")) {
    const openaiKey = Deno.env.get("OPENAI_KEY")?.trim();
    embeddingWrote = !!(await runPlaceEmbeddingsOnUpdate(
      admin,
      projectId,
      openaiKey,
      "enrich-contents/on-update",
      "contents",
    ));
  }

  // ━━━ S9 — store images (own EF: storage mirroring gets its own wall clock) ━━━
  // Profile is already persisted (ready); image mirroring is best-effort — a
  // failure still leaves photos rendering from source URLs, and a re-run can
  // re-mirror. So it never fails the run, only colours the summary below.
  const assets = buildMediaAssets(gathered, analysis);
  let imagesSummary: string;
  const imagesMeta: Record<string, unknown> = {};
  if (!wants(buys, "photos")) {
    // The trigger did not buy storage mirroring; photos still render from
    // their source URLs, exactly as when the admin toggle is off.
    imagesSummary = "image storage skipped (trigger)";
    imagesMeta.images = "skipped";
  } else if (!cfg.saveImagesToStorage) {
    // Admin turned Storage mirroring off — photos still render from their
    // source URLs; we just don't copy binaries into the bucket.
    imagesSummary = "image storage disabled (admin)";
    imagesMeta.images = "disabled";
  } else if (assets.length > 0) {
    const storeRes = await invokeInternalCaller<{ queued?: number }>(
      env,
      "supabase-cron-enrich-place-contents",
      "supabase-edgefunc-store-place-images",
      {
        project_id: projectId,
        assets,
        preferred_photo_urls: analysis.finalPhotos,
      },
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

  // ── PULSE functions (MESITA-1243) ──────────────────────────────────────
  // Contents owns 7 (menu), 9 (description) and the SEMANTIC Summary function.
  const contentPieces: Partial<Record<StampablePulseStep, PieceOutcome>> = {
    // MENU IS A STUB. The website is no longer scraped, so there is no menu
    // source and the function can never block the queue. It passes, and it
    // holds slot 7 until someone builds it, so the numbers do not all shift by
    // one on the day they do. Worth knowing when reading a 9.
    menu: pieceDone("No menu source yet — the function is a stub."),
  };
  if (wants(buys, "synthesis")) {
    // DESCRIPTION (9) — the PRESENTATION, then category, then tags, and
    // the function that CLOSES the queue. NOT the Semantic Summary: that is the
    // semantic function below, and the two are different artifacts (prose a
    // GUEST reads vs the 60-word blurb the INDEX reads). `aboutWritten` is
    // computed from the PERSISTED description, not from the model having
    // replied.
    contentPieces.description = aboutWritten
      ? pieceDone(
        `Presentation written; category “${place.category ?? "n/a"}”, ${inferredTags.length} tag(s).`,
      )
      : pieceFailed("Synthesis ran but no Presentation was persisted.");
  }
  if (wants(buys, "embedding")) {
    // SEMANTIC · SUMMARY — a semantic function, not a rung. It writes the
    // Semantic Summary and vectorises it, after function 9, because it embeds
    // the text the queue just wrote. It is reported so an operator can see it
    // and NEVER counted: the same machinery fires on any profile edit, and
    // `enriched` must not fall because someone renamed a place (MESITA-1243).
    //
    // Its sibling, SEMANTIC · NAME, is declared in pulse-pieces.ts and is NOT
    // BUILT — `places` carries one embedding over the whole facts block today,
    // so there is no separate name vector to stamp (MESITA-1238). Nothing is
    // written for it rather than something fake being written.
    contentPieces.summary = embeddingWrote
      ? pieceDone("Semantic Summary written and embedded.")
      : pieceFailed("Embedding did not write. Re-enrich to retry — there is no backfill.");
  }
  await reportPulsePieces(admin, projectId, contentPieces);

  // One beacon for the whole contents stage — one notification per Edge
  // Function. Its own `step` is decorative and does not track the ladder: the
  // stage runs 7 menu, 9 description and the semantic Summary, all stamped
  // above. Reports synthesis + persist + image outcome in a single line.
  await reportEnrichmentStep(
    admin,
    projectId,
    "S7",
    "publish",
    "completed",
    `Enrichment complete for “${name}” — About ${
      aboutWritten ? "written" : "MISSING"
    }, category “${
      place.category ?? "n/a"
    }”, ${inferredTags.length} tag(s), reservation ${
      reservationChannel ?? "—"
    }; ${imagesSummary}.`,
    {
      about: aboutWritten,
      category: place.category ?? null,
      tags: inferredTags.length,
      reservation: reservationChannel,
      // A pin that silently eats a write is as confusing as one that does not
      // hold, so the beacon says which fields the Intaker stood down on.
      ...(pinnedSkipped.length > 0 ? { pinned: pinnedSkipped } : {}),
      ...imagesMeta,
    },
  );

  // The terminal hop. The ledger snapshot is the only complete per-run total
  // that exists — it rides on gathered.cost, which the NEXT run overwrites, so
  // the run row is where it survives.
  const finalCost = ledger.snapshot();
  await advanceResearchStage(admin, projectId, "done", {}, {
    runId: row.run_id,
    // A run that entered at analysis or contents REUSED a stored gather it did
    // not pay for, so it must not be billed for it. Only a run that walked from
    // research owns this number.
    costUsd: row.stage === "contents" && row.gathered ? null : finalCost.spentUsd,
    charges: row.stage === "contents" && row.gathered ? null : finalCost.charges,
  });
});
