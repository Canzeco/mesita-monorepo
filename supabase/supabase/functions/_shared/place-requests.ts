// Votes — consumer demand for Intaker on an already-created ugly profile.
//
// Create mints a viewable profile (content_status ready, enriched_at null).
// Enriched is `places.enriched_at`. Guests vote on the Enrich tab. When
// request_count reaches Intake atlasRequestThreshold, seed Intaker.
// Admin Enrich / Create+Enrich never calls this door — that is the bypass.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { normalizeEnrichmentConfig } from "./enrichment-config.ts";
import { seedPlaceResearch } from "./enrich-pipeline.ts";
import {
  isPlaceEnriched,
  isPlaceEnriching,
  isPlaceListed,
  isPlaceProfileReady,
  isPlaceRequested,
} from "./place-status.ts";

export { isPlaceProfileReady };

export const DEFAULT_REQUEST_THRESHOLD = 5;
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
 * Enriched is enriched_at (Intaker finished). Create-without-enrich is
 * ready + no stamp — still listed/requested. When enrichedAt is omitted,
 * ready still means enriched (legacy callers / tests).
 */
export function placeRequestLifecycle(input: {
  contentStatus: unknown;
  requestCount: number;
  enrichedAt?: unknown;
}): PlaceRequestLifecycle {
  if (isPlaceEnriched(input.enrichedAt)) return "enriched";
  if (input.enrichedAt === undefined && isPlaceProfileReady(input.contentStatus)) {
    return "enriched";
  }
  if (
    isPlaceRequested({
      requestCount: input.requestCount,
      contentStatus: input.contentStatus,
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
  contentStatus: unknown;
  enrichedAt?: unknown;
}): boolean {
  if (isPlaceEnriched(input.enrichedAt)) return false;
  if (input.enrichedAt === undefined && isPlaceProfileReady(input.contentStatus)) {
    return false;
  }
  if (isPlaceEnriching(input.contentStatus)) return false;
  if (input.threshold < REQUEST_THRESHOLD_MIN) return false;
  return input.requestCount >= input.threshold;
}

export function requestProgressLabel(count: number, threshold: number): string {
  const n = Math.max(0, Math.trunc(count));
  const t = Math.max(REQUEST_THRESHOLD_MIN, Math.trunc(threshold));
  return `${n} of ${t} votes`;
}

/** Admin create/enrich does not read request_count or the threshold. */
export function adminMayEnrichWithoutRequests(): boolean {
  return true;
}

export function placeRequestState(input: {
  requestCount: number;
  threshold: number;
  requested: boolean;
  contentStatus: unknown;
  enrichedAt?: unknown;
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
    is_profile_ready: isPlaceProfileReady(input.contentStatus),
    is_enriched: isPlaceEnriched(input.enrichedAt) ||
      (input.enrichedAt === undefined && isPlaceProfileReady(input.contentStatus)),
    request_lifecycle: placeRequestLifecycle({
      contentStatus: input.contentStatus,
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
  ).atlasRequestThreshold;
}

export async function applyPlaceRequest(
  admin: SupabaseClient,
  opts: {
    consumerId: string;
    placeId: string;
    callerName: string;
  },
): Promise<
  | { ok: true; state: PlaceRequestState }
  | { ok: false; status: number; error: string; code?: string }
> {
  const { data: place, error: placeErr } = await admin
    .from("profiles")
    .select("id, status, content_status, google_place_id, request_count, enriched_at")
    .eq("id", opts.placeId)
    .maybeSingle();
  if (placeErr) {
    return { ok: false, status: 500, error: placeErr.message };
  }
  if (!place) {
    return { ok: false, status: 404, error: "Place not found", code: "place_not_found" };
  }
  if (!isPlaceListed((place as { status?: unknown }).status)) {
    return {
      ok: false,
      status: 404,
      error: "Place not found",
      code: "place_not_found",
    };
  }

  const threshold = await loadRequestThreshold(admin);
  const contentStatus = (place as { content_status?: unknown }).content_status;
  const enrichedAt = (place as { enriched_at?: unknown }).enriched_at;
  const existingCount = Number((place as { request_count?: unknown }).request_count) || 0;

  if (isPlaceEnriched(enrichedAt)) {
    return {
      ok: true,
      state: placeRequestState({
        requestCount: existingCount,
        threshold,
        requested: true,
        contentStatus,
        enrichedAt,
        enrichmentTriggered: false,
      }),
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
  if (shouldTriggerRequestEnrichment({
    requestCount: count,
    threshold,
    contentStatus,
    enrichedAt,
  })) {
    const googlePlaceId = String(
      (place as { google_place_id?: unknown }).google_place_id ?? "",
    ).trim();
    // The vote already counted. A missing spine cannot seed Intake; Admin
    // adds the id later. Do not fail the request after incrementing.
    if (googlePlaceId) {
      const seed = await seedPlaceResearch(
        admin,
        opts.placeId,
        googlePlaceId,
        opts.callerName,
        {
          trigger: "manual",
          subprocesses: null,
          cooldownHours: 0,
          actorUserId: opts.consumerId,
          meta: { source: "consumer_request" },
        },
      );
      if (seed.ok) {
        enrichmentTriggered = true;
      } else if (seed.blocked === "already_open") {
        enrichmentTriggered = false;
      } else {
        return {
          ok: false,
          status: 500,
          error: seed.error ?? "Failed to queue enrichment",
        };
      }
    }
  }

  return {
    ok: true,
    state: placeRequestState({
      requestCount: count,
      threshold,
      requested: true,
      contentStatus,
      enrichedAt,
      enrichmentTriggered,
    }),
  };
}
