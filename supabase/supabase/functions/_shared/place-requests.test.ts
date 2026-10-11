import { assertEquals } from "jsr:@std/assert@1";
import {
  placeRequestLifecycle,
  placeRequestState,
  shouldTriggerRequestEnrichment,
} from "./place-requests.ts";

Deno.test("zero requests: listed, no auto-enrich", () => {
  assertEquals(
    placeRequestLifecycle({ contentState: "generating", requestCount: 0 }),
    "listed",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 0,
      threshold: 3,
      contentState: "generating",
    }),
    false,
  );
});

Deno.test("below-threshold requests: Requested, no auto-enrich", () => {
  assertEquals(
    placeRequestLifecycle({ contentState: "failed", requestCount: 2 }),
    "requested",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 2,
      threshold: 3,
      contentState: "failed",
    }),
    false,
  );
});

Deno.test("threshold crossing: trigger when not ready and not already enriching", () => {
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 3,
      threshold: 3,
      contentState: "failed",
    }),
    true,
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 4,
      threshold: 3,
      contentState: "generating",
    }),
    false,
  );
});

Deno.test("duplicate requests: count is the stored number, not a second increment", () => {
  const first = placeRequestState({
    requestCount: 1,
    threshold: 3,
    requested: true,
    contentState: "failed",
  });
  const duplicate = placeRequestState({
    requestCount: 1,
    threshold: 3,
    requested: true,
    contentState: "failed",
  });
  assertEquals(first.request_count, duplicate.request_count);
  assertEquals(first.request_lifecycle, "requested");
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: duplicate.request_count,
      threshold: 3,
      contentState: "failed",
    }),
    false,
  );
});

Deno.test("successful transition to Enriched unlocks the profile", () => {
  assertEquals(
    placeRequestLifecycle({ contentState: "ready", requestCount: 7 }),
    "enriched",
    "Enriched wins over a leftover request count",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 7,
      threshold: 3,
      contentState: "ready",
    }),
    false,
  );
  const state = placeRequestState({
    requestCount: 7,
    threshold: 3,
    requested: true,
    contentState: "ready",
  });
  assertEquals(state.is_profile_ready, true);
  assertEquals(state.is_enriched, true);
  assertEquals(state.request_lifecycle, "enriched");
});

Deno.test("ugly Create profile: ready + no enriched_at still accepts votes", () => {
  assertEquals(
    placeRequestLifecycle({
      contentState: "ready",
      requestCount: 0,
      enrichedAt: null,
    }),
    "listed",
  );
  assertEquals(
    placeRequestLifecycle({
      contentState: "ready",
      requestCount: 2,
      enrichedAt: null,
    }),
    "requested",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 3,
      threshold: 3,
      contentState: "ready",
      enrichedAt: null,
    }),
    true,
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 3,
      threshold: 3,
      contentState: "ready",
      enrichedAt: "2026-08-28T00:00:00Z",
    }),
    false,
  );
  const ugly = placeRequestState({
    requestCount: 2,
    threshold: 3,
    requested: true,
    contentState: "ready",
    enrichedAt: null,
  });
  assertEquals(ugly.is_profile_ready, true);
  assertEquals(ugly.is_enriched, false);
  assertEquals(ugly.request_lifecycle, "requested");
});
