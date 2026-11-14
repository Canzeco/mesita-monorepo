// Views — consumer demand for an Enrich run on a Created profile.
//
// Create mints a viewable profile (content_state ready, enriched_at null).
// Enriched is `place_profiles.enriched_at`. Every signed-in guest's view of a
// place counts once (apply_place_request; consumer-web-track-activity on
// `viewed`, MESITA-2642 — it replaced the guest vote). When request_count
// reaches the enrichment config's "Enrich after N views"
// (enrichRequestThreshold) this door starts the same Render run admin Enrich
// starts (_shared/enrich-start.ts): there is one Enrich. Admin Enrich never
// calls this door — that is the bypass.
//
// `enriching` tells the guest the place is mid-run after this view
// (MESITA-2952): the page loaded before the run began, so the guest whose
// view started it would otherwise never see the Enriching tag.
//
// THREE LEVELS ON ONE COUNT (MESITA-3934), each "first after N views, then
// every M views" (`viewCycleDue`): Fast Update (Google facts, `updateDue`),
// Deep Update (reviews and followers, `reviewsUpdateDue`) on every place, and
// Deep Enrich on a place with no owner. Deep Enrich's first run keeps the
// catch-up rule (any count at or past N while never enriched); its repeats,
// like both Updates, fire only on the NEW view that lands on N + kM. An
// Update never fires on the view that just started Enrich, nor mid-run.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { loadEnrichmentConfig } from "./enrichment-config.ts";
import { startEnrichment } from "./enrich-start.ts";
import {
  isPlaceEnriched,
  isPlaceEnriching,
  isPlaceListed,
  isPlaceProfileReady,
  isPlaceRequested,
} from "./place-state.ts";

export const REQUEST_THRESHOLD_MIN = 1;
export const REQUEST_THRESHOLD_MAX = 100;

export type PlaceRequestLifecycle = "listed" | "requested" | "enriched";

export type PlaceRequestState = {
  request_count: number;
  request_threshold: number;
  requested: boolean;
  is_profile_ready: boolean;
  is_enriched: boolean;
  request_lifecycle: PlaceRequestLifecycle;
  enrichment_triggered: boolean;
};

/**
 * Enriched is enriched_at alone (an Enrich run completed). Create is ready +
 * no stamp — still listed/requested. `enrichedAt` is required; `ready` never
 * stands in for it (MESITA-2154).
 */
export function placeRequestLifecycle(input: {
  requestCount: number;
  enrichedAt: unknown;
}): PlaceRequestLifecycle {
  if (isPlaceEnriched(input.enrichedAt)) return "enriched";
  if (
    isPlaceRequested({
      requestCount: input.requestCount,
      enrichedAt: input.enrichedAt,
    })
  ) {
    return "requested";
  }
  return "listed";
}

/** Consumer-driven auto-enrich. Admin Run-now never consults this. */
export function shouldTriggerRequestEnrichment(input: {
  requestCount: number;
  threshold: number;
  contentState: unknown;
  enrichedAt: unknown;
}): boolean {
  if (isPlaceEnriched(input.enrichedAt)) return false;
  if (isPlaceEnriching(input.contentState)) return false;
  if (input.threshold < REQUEST_THRESHOLD_MIN) return false;
  return input.requestCount >= input.threshold;
}

/**
 * "First after N views, then every M views" (MESITA-3934): due at N, N+M,
 * N+2M… N = 0 turns the level off; M = 0 runs it once, at N.
 */
export function viewCycleDue(input: { count: number; firstAfter: number; every: number }): boolean {
  const { count, firstAfter, every } = input;
  if (firstAfter < 1 || count < firstAfter) return false;
  if (count === firstAfter) return true;
  return every >= 1 && (count - firstAfter) % every === 0;
}

/** Cyclical Update on a NEW view, enriched or not. */
export function shouldTriggerViewUpdate(input: {
  inserted: boolean;
  requestCount: number;
  firstAfter: number;
  everyViews: number;
  contentState: unknown;
  enrichmentTriggered: boolean;
}): boolean {
  if (!input.inserted || input.enrichmentTriggered) return false;
  if (isPlaceEnriching(input.contentState)) return false;
  return viewCycleDue({ count: input.requestCount, firstAfter: input.firstAfter, every: input.everyViews });
}

/** Deep Enrich again on an enriched place (MESITA-3934): a NEW view landing
 *  on first-after + k × every. The first run is shouldTriggerRequestEnrichment. */
export function shouldTriggerRepeatEnrichment(input: {
  inserted: boolean;
  requestCount: number;
  threshold: number;
  everyViews: number;
  contentState: unknown;
  enrichedAt: unknown;
}): boolean {
  if (!input.inserted || !isPlaceEnriched(input.enrichedAt)) return false;
  if (isPlaceEnriching(input.contentState)) return false;
  if (input.everyViews < 1 || input.requestCount <= input.threshold) return false;
  return viewCycleDue({ count: input.requestCount, firstAfter: input.threshold, every: input.everyViews });
}

export function placeRequestState(input: {
  requestCount: number;
  threshold: number;
  requested: boolean;
  contentState: unknown;
  enrichedAt: unknown;
  enrichmentTriggered?: boolean;
}): PlaceRequestState {
  const request_count = Math.max(0, Math.trunc(input.requestCount));
  const request_threshold = Math.min(
    REQUEST_THRESHOLD_MAX,
    Math.max(REQUEST_THRESHOLD_MIN, Math.trunc(input.threshold)),
  );
  return {
    request_count,
    request_threshold,
    requested: input.requested,
    is_profile_ready: isPlaceProfileReady(input.contentState),
    is_enriched: isPlaceEnriched(input.enrichedAt),
    request_lifecycle: placeRequestLifecycle({
      requestCount: request_count,
      enrichedAt: input.enrichedAt,
    }),
    enrichment_triggered: input.enrichmentTriggered === true,
  };
}

export async function loadRequestThreshold(
  admin: SupabaseClient,
): Promise<number> {
  return (await loadEnrichmentConfig(admin)).enrichRequestThreshold;
}

export async function applyPlaceRequest(
  admin: SupabaseClient,
  opts: {
    consumerId: string;
    placeId: string;
    callerName: string;
  },
): Promise<
  | { ok: true; state: PlaceRequestState; enriching: boolean; updateDue: boolean; reviewsUpdateDue: boolean }
  | { ok: false; status: number; error: string; code?: string }
> {
  const { data: place, error: placeErr } = await admin
    .from("profiles")
    .select("id, state, content_state, google_place_id, request_count, enriched_at")
    .eq("id", opts.placeId)
    .maybeSingle();
  if (placeErr) {
    return { ok: false, status: 500, error: placeErr.message };
  }
  if (!place) {
    return { ok: false, status: 404, error: "Place not found", code: "place_not_found" };
  }
  if (!isPlaceListed((place as { state?: unknown }).state)) {
    return {
      ok: false,
      status: 404,
      error: "Place not found",
      code: "place_not_found",
    };
  }

  const config = await loadEnrichmentConfig(admin);
  const threshold = config.enrichRequestThreshold;
  const contentState = (place as { content_state?: unknown }).content_state;
  const enrichedAt = (place as { enriched_at?: unknown }).enriched_at;
  const existingCount = Number((place as { request_count?: unknown }).request_count) || 0;
  const googlePlaceId = String(
    (place as { google_place_id?: unknown }).google_place_id ?? "",
  ).trim();

  // Every view counts, Enriched or not: the count drives Update after Enrich.
  const { data: applied, error: rpcErr } = await admin.rpc("apply_place_request", {
    p_consumer_id: opts.consumerId,
    p_place_id: opts.placeId,
  });
  if (rpcErr) {
    return { ok: false, status: 500, error: rpcErr.message };
  }
  const row = Array.isArray(applied) ? applied[0] : applied;
  const requestCount = Number((row as { request_count?: unknown } | null)?.request_count);
  const count = Number.isFinite(requestCount) ? requestCount : existingCount;
  const inserted = (row as { inserted?: unknown } | null)?.inserted === true;

  let enrichmentTriggered = false;
  // Another guest's run won the claim between our read and our start.
  let claimedElsewhere = false;
  const enrichDue = shouldTriggerRequestEnrichment({
    requestCount: count,
    threshold,
    contentState,
    enrichedAt,
  }) || shouldTriggerRepeatEnrichment({
    inserted,
    requestCount: count,
    threshold,
    everyViews: config.enrichEveryViews,
    contentState,
    enrichedAt,
  });
  if (enrichDue) {
    // The vote already counted, so nothing below fails the request. A missing
    // spine cannot be enriched (Admin adds the id later). The claim loses to a
    // run already in flight (another guest's vote). A refused start is logged
    // and the place goes back to ready or failed, so the next vote retries.
    if (googlePlaceId) {
      const started = await startEnrichment(admin, { placeIds: [opts.placeId] });
      if (started.ok) {
        enrichmentTriggered = true;
      } else if (started.blocked === "enriching") {
        claimedElsewhere = true;
      } else if (started.blocked === "owned") {
        // A place with an owner is never enriched (MESITA-3934): no log.
      } else {
        console.error(
          `[${opts.callerName}] the view did not start an Enrich run: ${started.error}`,
        );
      }
    }
  }

  const updateDue = googlePlaceId !== "" && !claimedElsewhere && shouldTriggerViewUpdate({
    inserted,
    requestCount: count,
    firstAfter: config.updateFirstAfterViews,
    everyViews: config.updateEveryViews,
    contentState,
    enrichmentTriggered,
  });

  const reviewsUpdateDue = !claimedElsewhere && shouldTriggerViewUpdate({
    inserted,
    requestCount: count,
    firstAfter: config.reviewsUpdateFirstAfterViews,
    everyViews: config.reviewsUpdateEveryViews,
    contentState,
    enrichmentTriggered,
  });

  return {
    ok: true,
    state: placeRequestState({
      requestCount: count,
      threshold,
      requested: true,
      contentState,
      enrichedAt,
      enrichmentTriggered,
    }),
    enriching: enrichmentTriggered || claimedElsewhere || isPlaceEnriching(contentState),
    updateDue,
    reviewsUpdateDue,
  };
}
