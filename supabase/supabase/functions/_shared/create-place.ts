// Shared create-place core — THE CREATE RUN (Main §8.4 v4, MESITA-2027): one
// run, synchronous, the front door.
//
// ONE LADDER, AND CREATE RUNS A SUBSET OF IT: 0, 1, 7, 8. Create used to
// number itself 1–5 while Enrich numbered itself 1–10, so `details` was step 3
// here and step 2 there — two answers to "which step is this". The numbers
// belong to the ladder now (crenup-ladder.ts); a caller simply runs fewer.
//
//   0 seed        → dedupe on google_place_id, mint the paired rows
//                   (content_state ready, enriched_at null).
//                   NEVER STAMPED: the row existing IS the seed.
//   1 details     → the Google spine persisted (fetchGoogleBasics fields,
//                   category = Google's primary type, family from that type)
//                   PLUS the first Google photo mirrored into
//                   place-images so a Created place can show a thumb. The
//                   LIVENESS GATE is a subprocess of this step, not a rung of
//                   its own: a place reported CLOSED_PERMANENTLY is REFUSED at
//                   the door, before any row exists.
//   7 description → the DOOR Description (gate D1): ONE batched prompt over
//                   the thin Google signals infers Tags, Presentation,
//                   Reservations, Mesita Name (through
//                   the mesita-name-door, gate D2) and the Semantic Summary.
//                   A later Enrich run's step 7 redoes it with rich grounding.
//   8 embedding   → embed-only: Name vector + Summary vector of what the
//                   door wrote, awaited in this same function.
//
// Details, Description and Embedding are SHARED with the ENRICH queue — create
// AWAITS its subfunctions; enrich runs each as its own tick. Create STAMPS
// what it ran so a fresh place reads its true rungs immediately and state
// accumulates across create and every later run under one rule.
//
// CREATE NEVER SEEDS THE ENRICHER (MESITA-1364). Every caller mints the ugly
// profile and stops. Enriched is `place_profiles.enriched_at` set (an Enrich
// run completed), never content_state: a Created place is shown (ready) but
// reads not-enriched everywhere — gray pin, outside the Mesita ring, out of
// Swipe and Catalog (MESITA-2154). Guests vote on the Enrich tab and the Crenup threshold seeds
// the queue (place-requests.ts); admin Enrich / Create+Enrich is a second
// call. The opt-in `queueEnrich` path that seeded from the trigger matrix's
// on_create row had no caller once business create retired (MESITA-2090) and
// left in MESITA-2151.
//
// Callers: admin-web-create-place and consumer-web-create-place
// (business-web-create-place and the consumer-web-schedule-place-creation
// compat alias were retired in MESITA-2090). All create IMMEDIATELY (MESITA-127/128 dropped the staggered
// queue); only auth and response shaping differ per EF.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchGoogleBasics } from "./enrich-google-basics.ts";
import { storeFirstPlaceImage } from "./store-place-images.ts";
import { savePlaceData } from "./save-place.ts";
import { runPlaceEmbeddingsOnUpdate } from "./place-embeddings.ts";
import { synthesizeDoorProfile } from "./create-door-profile.ts";
import { applyInferredMesitaName } from "./mesita-name-door.ts";
import { writePlace } from "./place-doc.ts";
import { reportCrenupSteps, stepDone, stepFailed } from "./crenup-report.ts";
import { loadDiscoveryConfig } from "./discovery-config.ts";
import { evaluatePlaceForMap } from "./map-engine.ts";
import { omitReviewsTileColumns } from "./reviews-state.ts";
import { inferMesitaCategoriesAtCreate } from "./mesita-categories-at-create.ts";
import { googleMetricsFromDetails, reviewSourcePatch } from "./review-sources.ts";
/** The Google numbers a create stores: the same patch a Reviews reload
 *  writes (`google_found` + stars + count), built from the Details response
 *  already in hand. Found is true because Details answered; a listing with
 *  no rating stores nulls under a true flag, as the verifier does
 *  (MESITA-2306). */
export function googleReviewsAtCreate(
  basics: { google_stars_overall?: unknown; google_review_count?: unknown },
): Record<string, unknown> {
  return reviewSourcePatch({
    source: "google",
    result: {
      found: true,
      metrics: googleMetricsFromDetails({
        rating: basics.google_stars_overall,
        userRatingCount: basics.google_review_count,
      }),
    },
  });
}

export type CreatedPlace = {
  id: string;
  slug: string;
  name: string;
  state: string;
};

// The `enrichment` block every create response carries. Create never seeds
// the Enricher, so `enrichmentTriggered` is always false and
// `enrichmentError` always null; the shape stays for the admin client's read.
export type EnrichmentSummary = {
  photoCount: number;
  enrichmentTriggered: boolean;
  enrichmentError: string | null;
};

export type CreatePlaceOutcome =
  | { ok: true; place: CreatedPlace; enrichment: EnrichmentSummary }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Get-or-create at a consumer door (MESITA-2298): opening a Google-only
 * result's profile creates the Mesita Place once, and every later open of
 * the same google_place_id resolves to that row. This is the "already
 * there" half: the response a consumer EF sends instead of the shared
 * core's 409, so the client opens the profile either way.
 */
export function openedExistingPlace(
  existing: CreatedPlace,
): {
  ok: true;
  created: false;
  place: CreatedPlace;
  enrichment: EnrichmentSummary;
} {
  return {
    ok: true,
    created: false,
    place: existing,
    enrichment: {
      photoCount: 0,
      enrichmentTriggered: false,
      enrichmentError: null,
    },
  };
}

/** The shared core's duplicate verdict, with the row it found. */
export function existingFromDuplicate(
  outcome: CreatePlaceOutcome,
): CreatedPlace | null {
  if (outcome.ok) return null;
  const body = outcome.body;
  if (body.code !== "place_already_exists") return null;
  const row = body.existing as Partial<CreatedPlace> | null | undefined;
  if (!row || typeof row.id !== "string") return null;
  return {
    id: row.id,
    slug: typeof row.slug === "string" ? row.slug : "",
    name: typeof row.name === "string" ? row.name : "",
    state: typeof row.state === "string" ? row.state : "active",
  };
}

/**
 * The one reader behind get-or-create (MESITA-2298): the Mesita row that
 * already owns a Google Place ID, or null. A query failure is NOT "not
 * found" — it throws, so the caller never creates a duplicate on a 42703.
 */
export async function findPlaceByGooglePlaceId(
  admin: SupabaseClient,
  googlePlaceId: string,
): Promise<CreatedPlace | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, slug, name, state")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  if (error) throw new Error(`profiles lookup failed: ${error.message}`);
  return (data as CreatedPlace | null) ?? null;
}

export async function createMinimalPlace(opts: {
  admin: SupabaseClient;
  // The product caller's EF name — the log prefix for this create.
  callerName: string;
  googlePlaceId: string;
}): Promise<CreatePlaceOutcome> {
  const { admin, callerName, googlePlaceId } = opts;

  // decision: Pato (MESITA-468) — every create path requires a Google Place ID;
  // callers already validate, but guard here so a future caller can't skip it.
  if (!googlePlaceId.trim()) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: "googlePlaceId is required" },
    };
  }

  // ── Early dedupe (idempotency on google_place_id): reject already-onboarded
  // place_profiles BEFORE spending any budget. savePlaceData dedupes again as a race
  // guard; gating here keeps a duplicate click cheap. ──
  const existing = await findPlaceByGooglePlaceId(admin, googlePlaceId);
  if (existing) {
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: "place_already_exists",
        error: "This place is already on Mesita.",
        existing,
      },
    };
  }

  // ── 1) Minimal seed — Google basics only. fetchGoogleBasics builds the
  // identity spine directly (no EF hop); category stays 'undefined' and
  // family_keys ['undefined'] until the Enricher pipeline's contents stage infers
  // Family + Category. No
  // Apify/Firecrawl/Perplexity/OpenAI here — deep enrichment is async. ──
  const GOOGLE_KEY = Deno.env.get("GMP_KEY") ?? Deno.env.get("SUPA_GMP_KEY");
  if (!GOOGLE_KEY) {
    return {
      ok: false,
      status: 500,
      body: { ok: false, error: "Server misconfigured (missing core secrets)" },
    };
  }
  const basicsRes = await fetchGoogleBasics(googlePlaceId, GOOGLE_KEY, {
    maxPhotos: 1,
  });
  if (!basicsRes.ok) {
    return {
      ok: false,
      status: basicsRes.status || 502,
      body: { ok: false, code: basicsRes.code, error: basicsRes.error },
    };
  }

  // ── CREATE step 1 — DETAILS' LIVENESS subprocess. Still active? ────────
  // The same gate ENRICH runs at function 1, at the only moment it is cheaper
  // still: before a single row is minted. CLOSED_PERMANENTLY refuses the
  // create outright — a dead listing must not enter the catalog at all.
  // CLOSED_TEMPORARILY passes (a refurb is a real business) and a silent
  // Google passes (absence is a result). No stamp here on refusal: there is
  // no place to stamp against, which is the point.
  if (basicsRes.businessStatus === "CLOSED_PERMANENTLY") {
    return {
      ok: false,
      status: 422,
      body: {
        ok: false,
        code: "place_permanently_closed",
        error:
          "Google reports this place as permanently closed, so it can't be added to Mesita.",
      },
    };
  }
  // ── Discovery › Map gate. Same allowlist as Search: type batteries +
  // rating/review/popularity floors. After Google, before persist. One ID, one 422
  // — a batch of creates never aborts as a unit. Config-read failure falls
  // back to discovery defaults rather than failing open.
  const map = (await loadDiscoveryConfig(admin)).map;
  const verdict = evaluatePlaceForMap(map, {
    primaryType: basicsRes.primaryType,
    rating: basicsRes.basics.google_stars_overall,
    reviewCount: basicsRes.basics.google_review_count,
  });
  if (!verdict.eligible) {
    return {
      ok: false,
      status: 422,
      body: { ok: false, code: verdict.code, error: verdict.reason },
    };
  }

  // Category is Google's primary type, already on basics. The profiles view
  // derives the family rails from that category. The tile columns are the
  // verifier's (MESITA-2189): strip whatever rode in on basics, then store
  // Google's own two through the verifier's patch — the Details call that
  // minted this row IS the first Reviews verification, so a new profile
  // reads its stars and review count at once (MESITA-2306). The Instagram
  // and Facebook counts stay empty until a Reviews reload.
  const place: Record<string, unknown> = {
    ...omitReviewsTileColumns({ ...basicsRes.basics }),
    google_primary_type: basicsRes.primaryType,
    google_types: basicsRes.googleTypes,
    mesita_categories: [],
    ...googleReviewsAtCreate(basicsRes.basics),
    // Operating (MESITA-1239). businessStatus rides the envelope, not `basics`,
    // so the spread above does not carry it. Stored verbatim: reaching here
    // means it is not CLOSED_PERMANENTLY (refused above), but OPERATIONAL,
    // CLOSED_TEMPORARILY and null are three different facts and the box says
    // which. Stamped with the observation time so a stale claim cannot read as
    // current.
    business_state: basicsRes.businessStatus ?? null,
    business_state_at: basicsRes.businessStatus
      ? new Date().toISOString()
      : null,
  };

  // ── 2) Persist the minimal rows (in-process). The mint lands 'ready' with
  // enriched_at null — the ugly profile is viewable; Enriched stays no until
  // an Enricher run finishes. ──
  const saveRes = await savePlaceData(admin, place, "ready");
  if (!saveRes.ok) {
    return { ok: false, status: saveRes.status, body: saveRes.body };
  }
  const saved = saveRes.saved;

  try {
    await inferMesitaCategoriesAtCreate(admin, saved.place_id, {
      name: saved.name,
      address: (place.address ?? null) as string | null,
      googlePrimaryType: basicsRes.primaryType,
      googleTypes: basicsRes.googleTypes,
      editorialSummary: basicsRes.editorialSummary,
    });
  } catch (err) {
    console.error(`[${callerName}/on-create] mesita-categories:`, err);
  }

  // ── CREATE Details — first Google photo into storage ────────────────────
  // Enrich Images (function 6) later ranks and replaces the gallery. Created
  // but not-yet-Enriched place_profiles still need ONE thumb in the app. Awaited so
  // the row the caller just got already has a public URL. Mirror failure
  // keeps the Google URI on the row and never fails the create.
  const firstPhoto = Array.isArray(place.photos) ? place.photos[0] : null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  if (typeof firstPhoto === "string" && firstPhoto && supabaseUrl) {
    try {
      const stored = await storeFirstPlaceImage(
        admin,
        supabaseUrl,
        saved.place_id,
        firstPhoto,
      );
      place.photos = [stored.url];
    } catch (err) {
      console.error(`[${callerName}/on-create] first-photo:`, err);
    }
  }

  // ── CREATE stamps what it ran ───────────────────────────────────────────
  // ONE stamp, because liveness is a subprocess of Details now (MESITA-2027),
  // not a rung beside it: the gate above passed — the listing resolves and is
  // not permanently closed — and the spine the save just persisted IS the
  // observed effect. Best-effort (a stamp failure never fails a create).
  // Result: a fresh, healthy place reads 1/8 on the high-water the moment
  // it exists, stopped at serp. The door below stamps 7 and 8 too, but the
  // walk stops at the first gap, so they count only once an Enrich run
  // fills 2–6. Neither the meter nor `ready` makes it Enriched — only an
  // Enrich run's `enriched_at` does (MESITA-2154).
  await reportCrenupSteps(admin, saved.place_id, {
    details: stepDone(
      basicsRes.businessStatus
        ? `Google spine persisted at create; listing ${basicsRes.businessStatus}.`
        : "Google spine persisted at create; no business status stated.",
      { businessStatus: basicsRes.businessStatus, via: "create" },
    ),
  });

  // ── 7 DESCRIPTION + 8 EMBEDDING at the door (§8.4 v4, gate D1) ─────────
  // Best-effort — nothing here ever fails the create.
  try {
    const openaiKey = Deno.env.get("OPENAI_KEY")?.trim();
    if (openaiKey) {
      const door = await synthesizeDoorProfile(admin, openaiKey, {
        name: saved.name,
        address: (place.address ?? null) as string | null,
        zone: (place.zone ?? null) as string | null,
        city: (place.city ?? null) as string | null,
        googleTypes: Array.isArray(place.google_types)
          ? place.google_types as string[]
          : null,
        // Google's blurb rides the envelope, not `basics` — it is a
        // classifier input, not a place_profiles column (MESITA-2144).
        editorialSummary: basicsRes.editorialSummary,
        priceLevel: typeof place.price_level === "number"
          ? place.price_level
          : null,
      });
      if (door) {
        const patch: Record<string, unknown> = {};
        // Category already came from Google. The door does not replace it.
        if (door.tags.length > 0) patch.tags = door.tags;
        if (door.description) patch.description = door.description;
        // The seed for a place nobody has answered for yet; an operator's
        // channel pick supersedes it from then on (MESITA-1737).
        patch.reservations_enabled = door.reservationsLikely;
        if (door.semanticSummary) {
          patch.embedding_source_text = door.semanticSummary;
        }
        const doorWrite = await writePlace(admin, {
          table: "place_profiles",
          mode: "update",
          id: saved.place_id,
          patch,
        });
        if (door.mesitaNameCandidate) {
          await applyInferredMesitaName(
            admin,
            saved.place_id,
            door.mesitaNameCandidate,
          );
        }
        await reportCrenupSteps(admin, saved.place_id, {
          description: doorWrite.ok
            ? stepDone(
              `Door Description — category “${door.category ?? "n/a"}”, ` +
                `${door.tags.length} tag(s), Mesita Name + Semantic Summary inferred.`,
              { via: "create" },
            )
            : stepFailed(
              `Door Description persist failed — ${
                doorWrite.ok ? "" : doorWrite.error
              }`,
            ),
        });
      }
    }
    // 8 EMBEDDING — embed-only vectors of what the door just wrote; the
    // embedding stamp lands where the vector write is observed
    // (place-embeddings).
    await runPlaceEmbeddingsOnUpdate(
      admin,
      saved.place_id,
      Deno.env.get("OPENAI_KEY")?.trim(),
      `${callerName}/on-create`,
      "create",
      "stored",
    );
  } catch (err) {
    console.error(`[${callerName}/on-create] door:`, err);
  }

  // No Enricher seed here — votes or a later admin Enrich call start it.
  return {
    ok: true,
    place: {
      id: saved.place_id,
      slug: saved.slug,
      name: saved.name,
      state: saved.state,
    },
    enrichment: {
      photoCount: Array.isArray(place.photos) ? place.photos.length : 0,
      enrichmentTriggered: false,
      enrichmentError: null,
    },
  };
}
