// Shared create-place core — THE CREATE RUN (Main §8.4): one run,
// synchronous, the front door. Create numbers 1–4 (not Enrich 1–10):
//
//   1 seed      → dedupe on google_place_id, mint the paired rows
//                 (generating when queueing Enrich, ready when not)
//   2 pulse     → the liveness gate: Google's businessStatus, read from the same
//                 Basics call — a place reported CLOSED_PERMANENTLY is REFUSED
//                 at the door, before any row exists. Don't seed corpses.
//   3 details   → the Google spine persisted (fetchGoogleBasics fields,
//                 category='undefined' and family_keys=['undefined'] until
//                 the Intaker infers Super Category + Category)
//                 PLUS the first Google photo mirrored into place-images so a
//                 Created place can show a thumb before Enrich Images runs.
//   4 semantic  → Name vector + Summary vector, awaited in this same function
//
// Pulse, Details and Semantic are SHARED with the ENRICH queue — create
// AWAITS the four subfunctions; enrich runs each as its own tick with no nested
// await. Create STAMPS what it ran (pulse, details, semantic) so a fresh place
// reads 2/10 immediately (Enrich high-water: pulse=1, details=2; 3–9 still a
// gap even if semantic stamps as 10) and state accumulates across create and
// every later run under one rule.
//
// queueEnrich (MESITA-1364): consumer and admin Create mint the ugly
// profile and do NOT seed Intaker. Enriched is `places.enriched_at`, not
// content_status. Guests vote on the Enrich tab; the Intake threshold
// seeds the queue. Business create still queues. Admin Enrich /
// Create+Enrich is a second call.
//
// Callers: admin-web-create-project, business-web-create-project,
// consumer-web-create-place (+ its consumer-web-schedule-project-creation
// compat alias). All create IMMEDIATELY (MESITA-127/128 dropped the staggered
// queue); only auth, dedupe copy, and response shaping differ per EF.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  loadEnrichmentTriggers,
  seedPlaceResearch,
  subprocessesFor,
} from "./enrich-pipeline.ts";
import { fetchGoogleBasics } from "./enrich-google-basics.ts";
import { storeFirstPlaceImage } from "./store-place-images.ts";
import { savePlaceData } from "./save-place.ts";
import { runPlaceEmbeddingsOnUpdate } from "./place-embeddings.ts";
import { pieceDone, reportPulsePieces } from "./pulse-report.ts";
import { applyGeneralCategoryCap, loadDiscoveryConfig } from "./discovery-config.ts";
import { evaluatePlaceForMap } from "./map-engine.ts";

const CHANNEL_KEYS = [
  "website_url", "instagram_url", "facebook_url", "x_url", "threads_url",
  "reddit_url", "whatsapp_url", "opentable_url", "resy_url", "uber_eats_url",
  "didi_food_url", "google_maps_url",
];

export type CreatedPlace = { id: string; slug: string; name: string; status: string };

// The `enrichment` block every create response carries (response-contract
// compatibility from the days enrichment was synchronous — now always async).
export type EnrichmentSummary = {
  google: boolean;
  enrichmentTriggered: boolean;
  enrichmentAsync: true;
  enrichmentError: string | null;
  photoCount: number;
  photoCandidates: 0;
  photoRanked: false;
  firecrawl: false;
  perplexity: false;
  openai: false;
  openaiError: null;
  channelCount: number;
  googleRating: number | null;
  googleReviewCount: number | null;
  instagramFollowers: number | null;
};

export type CreatePlaceOutcome =
  | { ok: true; place: CreatedPlace; enrichment: EnrichmentSummary }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function createMinimalPlace(opts: {
  admin: SupabaseClient;
  // The product caller's EF name — recorded as place_research.created_by.
  callerName: string;
  googlePlaceId: string;
  // Caller-specific copy for the 409 (e.g. the business app adds claim advice).
  dedupeError?: string;
  // true (default): seed Intaker from the on_create row. false: mint the
  // ugly profile and stop — votes (or admin Enrich) start the queue.
  queueEnrich?: boolean;
}): Promise<CreatePlaceOutcome> {
  const { admin, callerName, googlePlaceId } = opts;
  const queueEnrich = opts.queueEnrich !== false;

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
  // places BEFORE spending any budget. savePlaceData dedupes again as a race
  // guard; gating here keeps a duplicate click cheap. ──
  const { data: existing } = await admin
    .from("profiles")
    .select("id, slug, name, status, listing_type")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      status: 409,
      body: {
        ok: false,
        code: "place_already_exists",
        error: opts.dedupeError ?? "This place is already on Mesita.",
        existing,
      },
    };
  }

  // ── 1) Minimal seed — Google basics only. fetchGoogleBasics builds the
  // identity spine directly (no EF hop); category stays 'undefined' and
  // family_keys ['undefined'] until the Intaker pipeline's contents stage infers
  // Super Category + Category. No
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

  // ── CREATE step 2 — PULSE. Is this place still active? ──────────────────
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
  const map = applyGeneralCategoryCap(await loadDiscoveryConfig(admin)).map;
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

  // category 'undefined' until the Intaker resolves it; the category-label
  // trigger fills category_label from the 'undefined' catalog row.
  const place: Record<string, unknown> = {
    ...basicsRes.basics,
    category: "undefined",
    category_label: null,
    family_keys: ["undefined"],
    // Operating (MESITA-1239). businessStatus rides the envelope, not `basics`,
    // so the spread above does not carry it. Stored verbatim: reaching here
    // means it is not CLOSED_PERMANENTLY (refused above), but OPERATIONAL,
    // CLOSED_TEMPORARILY and null are three different facts and the box says
    // which. Stamped with the observation time so a stale claim cannot read as
    // current.
    business_status: basicsRes.businessStatus ?? null,
    business_status_at: basicsRes.businessStatus ? new Date().toISOString() : null,
  };

  // ── 2) Persist the minimal rows (in-process). queueEnrich lands
  // content_status='generating' until contents flips it to ready. A cheap
  // mint lands 'ready' with enriched_at null — the ugly profile is
  // viewable; Enriched stays no until Intaker finishes. ──
  const saveRes = await savePlaceData(
    admin,
    place,
    queueEnrich ? "generating" : "ready",
  );
  if (!saveRes.ok) {
    return { ok: false, status: saveRes.status, body: saveRes.body };
  }
  const saved = saveRes.saved;

  // ── CREATE Details — first Google photo into storage ────────────────────
  // Enrich Images (function 6) later ranks and replaces the gallery. Created
  // but not-yet-Enriched places still need ONE thumb in the app. Awaited so
  // the row the caller just got already has a public URL. Mirror failure
  // keeps the Google URI on the row and never fails the create.
  const firstPhoto = Array.isArray(place.photos) ? place.photos[0] : null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  if (typeof firstPhoto === "string" && firstPhoto && supabaseUrl) {
    try {
      const stored = await storeFirstPlaceImage(
        admin,
        supabaseUrl,
        saved.project_id,
        firstPhoto,
      );
      place.photos = [stored.url];
    } catch (err) {
      console.error(`[${callerName}/on-create] first-photo:`, err);
    }
  }

  // ── CREATE stamps what it ran (MESITA-1253) ─────────────────────────────
  // pulse: the gate above passed — the listing resolves and is not permanently
  // closed. details: the spine the save just persisted IS the observed effect.
  // Both best-effort (a stamp failure never fails a create); the semantic stamp
  // lands where the vector write is observed (place-embeddings).
  // Result: a fresh, healthy place reads enriched 2/10 the moment it exists.
  await reportPulsePieces(admin, saved.project_id, {
    pulse: pieceDone(
      basicsRes.businessStatus
        ? `Google reports this listing ${basicsRes.businessStatus}.`
        : "Google states no business status; the listing resolves.",
      { businessStatus: basicsRes.businessStatus, via: "create" },
    ),
    details: pieceDone("Google spine persisted at create.", { via: "create" }),
  });

  // ── On-Create embeddings — the SEMANTIC subfunction, AWAITED by CREATE
  // (Docs › Intake §A): write Name + Summary together so the place is
  // searchable before the Intaker fills the deep profile. Best-effort — a
  // missing key or a write miss never fails the create; On-Update re-embeds
  // when the Intaker later changes profile fields. Tags never feed the source
  // text. ──
  try {
    await runPlaceEmbeddingsOnUpdate(
      admin,
      saved.project_id,
      Deno.env.get("OPENAI_KEY")?.trim(),
      `${callerName}/on-create`,
      "create",
    );
  } catch (err) {
    console.error(`[${callerName}/on-create] semantic:`, err);
  }

  // ── 3) Queue deep enrichment (async) only when the caller bought it.
  // Consumer/admin Create skip this — votes or a later Enrich call seed.
  const trigger = queueEnrich
    ? await queueOnCreateEnrichment(admin, saved.project_id, googlePlaceId, callerName)
    : { ok: false as const, error: null as string | null, skipped: true };

  const channelCount = CHANNEL_KEYS.filter((k) => !!place[k]).length;
  return {
    ok: true,
    place: { id: saved.project_id, slug: saved.slug, name: saved.name, status: saved.status },
    enrichment: {
      google: true,
      enrichmentTriggered: trigger.ok,
      enrichmentAsync: true,
      enrichmentError: trigger.ok ? null : trigger.error ?? null,
      photoCount: Array.isArray(place.photos) ? place.photos.length : 0,
      photoCandidates: 0,
      photoRanked: false,
      firecrawl: false,
      perplexity: false,
      openai: false,
      openaiError: null,
      channelCount,
      googleRating: (place.google_stars_overall as number | null) ?? null,
      googleReviewCount: (place.google_review_count as number | null) ?? null,
      instagramFollowers: (place.instagram_followers_count as number | null) ?? null,
    },
  };
}

async function queueOnCreateEnrichment(
  admin: SupabaseClient,
  projectId: string,
  googlePlaceId: string,
  callerName: string,
): Promise<{ ok: boolean; error: string | null }> {
  const triggers = await loadEnrichmentTriggers(admin);
  const subprocesses = subprocessesFor(triggers, "on_create");
  if (subprocesses.length === 0) {
    return { ok: false, error: "on_create disabled in the enrichment trigger matrix" };
  }
  const seeded = await seedPlaceResearch(
    admin,
    projectId,
    googlePlaceId,
    callerName,
    { trigger: "on_create", subprocesses, cooldownHours: 0 },
  );
  return { ok: seeded.ok, error: seeded.ok ? null : seeded.error ?? null };
}
