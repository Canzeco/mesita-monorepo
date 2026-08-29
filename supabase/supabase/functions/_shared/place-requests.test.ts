import { assertEquals } from "jsr:@std/assert@1";
import {
  adminMayEnrichWithoutRequests,
  DEFAULT_REQUEST_THRESHOLD,
  isPlaceProfileReady,
  placeRequestLifecycle,
  placeRequestState,
  requestProgressLabel,
  shouldTriggerRequestEnrichment,
} from "./place-requests.ts";

Deno.test("zero requests: listed, no auto-enrich", () => {
  assertEquals(
    placeRequestLifecycle({ contentStatus: "queued", requestCount: 0 }),
    "listed",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 0,
      threshold: 3,
      contentStatus: "queued",
    }),
    false,
  );
  assertEquals(requestProgressLabel(0, 3), "0 of 3 votes");
});

Deno.test("below-threshold requests: Requested, no auto-enrich", () => {
  assertEquals(
    placeRequestLifecycle({ contentStatus: "failed", requestCount: 2 }),
    "requested",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 2,
      threshold: 3,
      contentStatus: "failed",
    }),
    false,
  );
  assertEquals(requestProgressLabel(2, 3), "2 of 3 votes");
});

Deno.test("threshold crossing: trigger when not ready and not already enriching", () => {
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 3,
      threshold: 3,
      contentStatus: "failed",
    }),
    true,
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 4,
      threshold: 3,
      contentStatus: "queued",
    }),
    false,
    "queued is already in-flight — do not re-seed",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 4,
      threshold: 3,
      contentStatus: "generating",
    }),
    false,
  );
});

Deno.test("duplicate requests: count is the stored number, not a second increment", () => {
  const first = placeRequestState({
    requestCount: 1,
    threshold: 3,
    requested: true,
    contentStatus: "failed",
  });
  const duplicate = placeRequestState({
    requestCount: 1,
    threshold: 3,
    requested: true,
    contentStatus: "failed",
  });
  assertEquals(first.request_count, duplicate.request_count);
  assertEquals(first.request_lifecycle, "requested");
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: duplicate.request_count,
      threshold: 3,
      contentStatus: "failed",
    }),
    false,
  );
});

Deno.test("Admin bypass: create/enrich does not consult the threshold", () => {
  assertEquals(adminMayEnrichWithoutRequests(), true);
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 0,
      threshold: 3,
      contentStatus: "failed",
    }),
    false,
    "consumer path still waits for the threshold; admin never calls this",
  );
});

Deno.test("successful transition to Enriched unlocks the profile", () => {
  assertEquals(isPlaceProfileReady("ready"), true);
  assertEquals(isPlaceProfileReady("queued"), false);
  assertEquals(isPlaceProfileReady("generating"), false);
  assertEquals(isPlaceProfileReady("failed"), false);
  assertEquals(
    placeRequestLifecycle({ contentStatus: "ready", requestCount: 7 }),
    "enriched",
    "Enriched wins over a leftover request count",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 7,
      threshold: 3,
      contentStatus: "ready",
    }),
    false,
  );
  const state = placeRequestState({
    requestCount: 7,
    threshold: 3,
    requested: true,
    contentStatus: "ready",
  });
  assertEquals(state.is_profile_ready, true);
  assertEquals(state.is_enriched, true);
  assertEquals(state.request_lifecycle, "enriched");
});

Deno.test("ugly Create profile: ready + no enriched_at still accepts votes", () => {
  assertEquals(
    placeRequestLifecycle({
      contentStatus: "ready",
      requestCount: 0,
      enrichedAt: null,
    }),
    "listed",
  );
  assertEquals(
    placeRequestLifecycle({
      contentStatus: "ready",
      requestCount: 2,
      enrichedAt: null,
    }),
    "requested",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 3,
      threshold: 3,
      contentStatus: "ready",
      enrichedAt: null,
    }),
    true,
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 3,
      threshold: 3,
      contentStatus: "ready",
      enrichedAt: "2026-08-28T00:00:00Z",
    }),
    false,
  );
  const ugly = placeRequestState({
    requestCount: 2,
    threshold: 3,
    requested: true,
    contentStatus: "ready",
    enrichedAt: null,
  });
  assertEquals(ugly.is_profile_ready, true);
  assertEquals(ugly.is_enriched, false);
  assertEquals(ugly.request_lifecycle, "requested");
});

Deno.test("default threshold is the Intake example (5)", () => {
  assertEquals(DEFAULT_REQUEST_THRESHOLD, 5);
});
