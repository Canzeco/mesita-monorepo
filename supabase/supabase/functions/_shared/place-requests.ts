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

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { normalizeEnrichmentConfig } from "./enrichment-config.ts";
import { startEnrichment } from "./enrich-start.ts";
import {
  isPlaceEnriched,
  isPlaceEnriching,
  isPlaceListed,
  isPlaceProfileReady,
  isPlaceRequested,
} from "./place-state.ts";

export const DEFAULT_REQUEST_THRESHOLD = 10; // MESITA-2653
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
  const { data, error } = await admin
    .from("app_config")
    .select("enrichment_config")
    .eq("id", 1)
    .maybeSingle();
  if (error) return DEFAULT_REQUEST_THRESHOLD;
  return normalizeEnrichmentConfig(
    (data as { enrichment_config?: unknown } | null)?.enrichment_config,
  ).enrichRequestThreshold;
}

export async function applyPlaceRequest(
  admin: SupabaseClient,
  opts: {
    consumerId: string;
    placeId: string;
    callerName: string;
  },
): Promise<
  | { ok: true; state: PlaceRequestState; enriching: boolean }
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

  const threshold = await loadRequestThreshold(admin);
  const contentState = (place as { content_state?: unknown }).content_state;
  const enrichedAt = (place as { enriched_at?: unknown }).enriched_at;
  const existingCount = Number((place as { request_count?: unknown }).request_count) || 0;

  if (isPlaceEnriched(enrichedAt)) {
    return {
      ok: true,
      state: placeRequestState({
        requestCount: existingCount,
        threshold,
        requested: true,
        contentState,
        enrichedAt,
        enrichmentTriggered: false,
      }),
      enriching: false,
    };
  }

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

  let enrichmentTriggered = false;
  // Another guest's run won the claim between our read and our start.
  let claimedElsewhere = false;
  if (shouldTriggerRequestEnrichment({
    requestCount: count,
    threshold,
    contentState,
    enrichedAt,
  })) {
    const googlePlaceId = String(
      (place as { google_place_id?: unknown }).google_place_id ?? "",
    ).trim();
    // The vote already counted, so nothing below fails the request. A missing
    // spine cannot be enriched (Admin adds the id later). The claim loses to a
    // run already in flight (another guest's vote). A refused start is logged
    // and the place goes back to ready or failed, so the next vote retries.
    if (googlePlaceId) {
      const started = await startEnrichment(admin, {
        placeIds: [opts.placeId],
        claim: true,
      });
      if (started.ok) {
        enrichmentTriggered = true;
      } else if (started.blocked === "enriching") {
        claimedElsewhere = true;
      } else {
        console.error(
          `[${opts.callerName}] the view did not start an Enrich run: ${started.error}`,
        );
      }
    }
  }

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
  };
}
