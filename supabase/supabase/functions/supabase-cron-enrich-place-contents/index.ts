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
import {
  loadEmbeddablePlace,
  runPlaceEmbeddingsOnUpdate,
  synthesizePlaceSummaryText,
} from "../_shared/place-embeddings.ts";
import { applyInferredMesitaName } from "../_shared/mesita-name-door.ts";
import {
  fetchPlaceCategories,
  fetchPlaceSuperCategories,
  inferPlaceCategory,
  inferPlaceSuperCategories,
} from "../_shared/categories.ts";
import {
  familiesForAtlasCategory,
  resolveEnrichedFamilyKeys,
} from "../_shared/place-taxonomy.ts";
import { fetchPlaceTags, inferPlaceTags } from "../_shared/tags.ts";
import { inferPlaceReservationsLikely } from "../_shared/infer-place-reservations.ts";
import { placeHasOrderCatalog } from "../_shared/place-profile-actions.ts";
import { loadModelsConfig } from "../_shared/models-config.ts";
import {
  coerceReservationsPolicy,
  hasReservationTarget,
  reservationTargetPatch,
  selectReservationEndpoint,
} from "../_shared/enrich-reservation-endpoint.ts";
import { humanizeCategorySlug } from "../_shared/parse-utils.ts";
import { persistGoogleReviews } from "../_shared/enrich-google-review-snippets.ts";
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
  // Admin cost model: synthesis + 3 × classify calls (category, Super
  // Category, tags); classify model = models_config.enricher.model.
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
    const classifyCost = COST.sort * 3;
    ledger.assertCanAfford(synthCost + classifyCost, "synthesis_and_classify");

    const { parsed, diag: synthDiag } = await synthesizeProfile({
      openaiKey: OPENAI_KEY,
      model: synthesisModelFor(cfg.synthesisQuality),
      name,
      locationLine: gathered.locationLine,
      category,
      // The franchise rule's qualifier — the spine's own zone/city, so a
      // chain branch is named "Starbucks Polanco", never bare "Starbucks".
      zone: (place.zone ?? null) as string | null,
      city: (place.city ?? null) as string | null,
      igBio,
      googleReviewsText,
      serpSummary,
    });
    ledger.charge("synthesis", synthCost);
    sources.synthesis = synthDiag;
    if (parsed) applyProfileToUpdate(place, parsed);

    // About first (above), then category, then tags — each step feeds the next.
    // Category + tags both ground primarily on the synthesized About.
    const [categoryList, superList, tagVocabulary, models] = await Promise.all([
      fetchPlaceCategories(admin),
      fetchPlaceSuperCategories(admin),
      fetchPlaceTags(admin),
      loadModelsConfig(admin),
    ]);
    // Super `undefined` is a catalog membership, not a classifier target —
    // never offer the leftover slug (thin-signal places would land there).
    // Same for the Super candidates: the classifier picks among the seven
    // real supers or stays silent (resolve falls back to ['undefined']).
    const realCategories = categoryList.filter((c) => c.slug !== "undefined");
    const realSupers = superList.filter((s) => s.slug !== "undefined");
    const aboutText =
      ((place.description ?? null) as string | null)?.slice(0, 1500) || null;
    const enricherModel = models.enricherModel;
    const classifySignals = {
      name,
      address: (place.address ?? null) as string | null,
      editorialSummary: (place.editorial_summary ?? null) as string | null,
      // Prefer the About we just synthesized; fall back to IG bio when synthesis
      // produced nothing (thin harvest).
      description: aboutText || igBio || null,
    };
    const [inferredCategory, inferredSupers] = await Promise.all([
      inferPlaceCategory(
        OPENAI_KEY,
        realCategories,
        classifySignals,
        enricherModel,
      ),
      inferPlaceSuperCategories(
        OPENAI_KEY,
        realSupers,
        { ...classifySignals, category },
        enricherModel,
      ),
    ]);
    if (inferredCategory) {
      place.category = inferredCategory;
      place.category_label = realCategories.find((c) =>
        c.slug === inferredCategory
      )?.label ??
        humanizeCategorySlug(inferredCategory) ?? inferredCategory;
    }
    const resolvedSupers = resolveEnrichedFamilyKeys(
      (place.category ?? category) as string | null,
      inferredSupers,
    );
    // Total write: resolveEnrichedFamilyKeys never returns empty — a place
    // always lands under at least one pill (['undefined'] at worst).
    place.family_keys = resolvedSupers;
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
    sources.super_categories = {
      ok: resolvedSupers.length > 0,
      slugs: resolvedSupers,
      inferred: inferredSupers,
      candidates: realSupers.length,
      // membership = derived from the classified category's 1–2 parents;
      // inferred = classifier picked (category still undefined/leftover);
      // fallback = nothing known, ['undefined'] stands (❓ Other pill).
      mode: familiesForAtlasCategory(
          (place.category ?? category) as string | null,
        ).length > 0
        ? "membership"
        : resolvedSupers.length === 1 && resolvedSupers[0] === "undefined"
        ? "fallback"
        : "inferred",
    };
    sources.tags = {
      ok: inferredTags.length > 0,
      count: inferredTags.length,
      vocabulary: tagVocabulary.length,
    };

    // ACTIONS (Description function 9) — Reserve: LLM inference on venue type.
    const reservationsLikely = await inferPlaceReservationsLikely(
      OPENAI_KEY,
      {
        name,
        category: categoryForTags,
        categoryLabel: (place.category_label ?? null) as string | null,
        description: aboutText,
        priceLevel: typeof place.price_level === "number"
          ? place.price_level
          : null,
        editorialSummary: (place.editorial_summary ?? null) as string | null,
      },
      enricherModel,
    );
    place.reservations_enabled = reservationsLikely;
    sources.actions = {
      orders_enabled: placeHasOrderCatalog(place),
      reservations_enabled: reservationsLikely,
    };

    // §8.4 v3 — Description owns the WORDS (function 9). Mesita Name goes
    // through the one door (gate D2: NULL / google-copy / the door's own last
    // value; an operator's name is never overwritten)…
    if (parsed?.mesita_name) {
      const door = await applyInferredMesitaName(
        admin,
        projectId,
        parsed.mesita_name,
      );
      sources.mesita_name = {
        ok: door.wrote,
        reason: door.reason,
        candidate: parsed.mesita_name,
      };
    }
    // …and the Semantic Summary is SYNTHESIZED here, persisted with this
    // stage's patch. Function 10 (Embedding) only embeds the stored text —
    // it never writes words. The door ran first so the effective name is
    // current; `place` overlays the row so facts see this run's fields.
    {
      const embRow = await loadEmbeddablePlace(admin, projectId);
      if (embRow) {
        const effective = { ...embRow, ...place } as typeof embRow;
        const summary = await synthesizePlaceSummaryText(
          admin,
          effective,
          OPENAI_KEY,
        );
        if (!summary.fresh && summary.text) {
          place.embedding_source_text = summary.text;
        }
        sources.semantic_summary = {
          ok: !!summary.text,
          fresh: summary.fresh,
          chars: summary.text.length,
        };
      }
    }
  }
  // Order gate follows menu/catalog — refresh even when synthesis is skipped.
  place.orders_enabled = placeHasOrderCatalog(place);
  if (!sources.actions) {
    sources.actions = { orders_enabled: place.orders_enabled };
  } else {
    (sources.actions as Record<string, unknown>).orders_enabled =
      place.orders_enabled;
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
  // Same for google_place_id: gathered.place still carries the spine (research
  // writes it on create). writePlace refuses it on UPDATE — leaving the key
  // in this patch is what printed "Profile persist failed" on Global Monitor
  // with the real reason only in meta.error (Strana, 2026-08-25).
  // Wave 040 already dropped tiktok/tripadvisor/yelp + requires_story on the
  // live row. A gathered blob that still carries them 42703s the UPDATE.
  const {
    id: _dropId,
    created_at: _dropCreated,
    updated_at: _dropUpdated,
    phone: _dropPhone,
    email: _dropEmail,
    whatsapp_url: _dropWhatsapp,
    name: _dropName,
    google_name: _dropGoogleName,
    google_place_id: _dropGooglePlaceId,
    tiktok_url: _dropTiktok,
    tripadvisor_url: _dropTripadvisor,
    yelp_url: _dropYelp,
    requires_story: _dropRequiresStory,
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
    google_place_id?: unknown;
    tiktok_url?: unknown;
    tripadvisor_url?: unknown;
    yelp_url?: unknown;
    requires_story?: unknown;
  };
  if ("google_reviews" in placeUpdate) {
    placeUpdate.google_reviews = persistGoogleReviews(placeUpdate.google_reviews);
  }
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
      `Profile persist failed — ${placeRes.error}`,
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

  // EMBEDDING (function 10, §8.4 v3) — embed-only: vectors of the STORED
  // Mesita Name and Semantic Summary that Description just persisted. It
  // never synthesizes; a missing summary text stamps an honest failure.
  // Best-effort: the profile is already ready, so a failed embed leaves the
  // place at rung 9 rather than failing the run — a stuck vector needs a
  // re-enrich, not patience (MESITA-1222).
  let embeddingWrote = false;
  if (wants(buys, "embedding")) {
    const openaiKey = Deno.env.get("OPENAI_KEY")?.trim();
    embeddingWrote = !!(await runPlaceEmbeddingsOnUpdate(
      admin,
      projectId,
      openaiKey,
      "enrich-contents/on-update",
      "contents",
      "stored",
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
        `Presentation written; category “${place.category ?? "n/a"}”, ${inferredTags.length} tag(s); ` +
          `order ${place.orders_enabled ? "on" : "off"}, reserve ${
            place.reservations_enabled ? "on" : "off"
          }; Mesita Name + Semantic Summary inferred.`,
      )
      : pieceFailed("Synthesis ran but no Presentation was persisted.");
  }
  if (wants(buys, "embedding")) {
    // EMBEDDING — function 10. Embed-only: vectors of the words function 9
    // wrote. It CLOSES the queue.
    contentPieces.embedding = embeddingWrote
      ? pieceDone("Embedding — Mesita Name and Semantic Summary vectors written.")
      : pieceFailed(
        "Embedding did not write (no summary text, or the embed failed). Re-enrich to retry.",
      );
  }
  await reportPulsePieces(admin, projectId, contentPieces);

  // One beacon for the whole contents stage — one notification per Edge
  // Function. Its own `step` is decorative and does not track the ladder: the
  // stage runs 7 menu, 9 description and 10 Embedding, all stamped
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
