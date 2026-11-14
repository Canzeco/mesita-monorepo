import { assertEquals } from "jsr:@std/assert@1";
import {
  placeRequestLifecycle,
  placeRequestState,
  shouldTriggerRequestEnrichment,
  shouldTriggerRepeatEnrichment,
  shouldTriggerViewUpdate,
  viewCycleDue,
} from "./place-requests.ts";

const STAMP = "2026-08-28T00:00:00Z";

Deno.test("zero requests: listed, no auto-enrich", () => {
  assertEquals(
    placeRequestLifecycle({ requestCount: 0, enrichedAt: null }),
    "listed",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 0,
      threshold: 3,
      contentState: "generating",
      enrichedAt: null,
    }),
    false,
  );
});

Deno.test("below-threshold requests: Requested, no auto-enrich", () => {
  assertEquals(
    placeRequestLifecycle({ requestCount: 2, enrichedAt: null }),
    "requested",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 2,
      threshold: 3,
      contentState: "failed",
      enrichedAt: null,
    }),
    false,
  );
});

Deno.test("threshold crossing: trigger when not enriched and not already enriching", () => {
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 3,
      threshold: 3,
      contentState: "failed",
      enrichedAt: null,
    }),
    true,
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 4,
      threshold: 3,
      contentState: "generating",
      enrichedAt: null,
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
    enrichedAt: null,
  });
  const duplicate = placeRequestState({
    requestCount: 1,
    threshold: 3,
    requested: true,
    contentState: "failed",
    enrichedAt: null,
  });
  assertEquals(first.request_count, duplicate.request_count);
  assertEquals(first.request_lifecycle, "requested");
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: duplicate.request_count,
      threshold: 3,
      contentState: "failed",
      enrichedAt: null,
    }),
    false,
  );
});

Deno.test("enriched_at set: Enriched wins over a leftover request count", () => {
  assertEquals(
    placeRequestLifecycle({ requestCount: 7, enrichedAt: STAMP }),
    "enriched",
  );
  assertEquals(
    shouldTriggerRequestEnrichment({
      requestCount: 7,
      threshold: 3,
      contentState: "ready",
      enrichedAt: STAMP,
    }),
    false,
  );
  const state = placeRequestState({
    requestCount: 7,
    threshold: 3,
    requested: true,
    contentState: "ready",
    enrichedAt: STAMP,
  });
  assertEquals(state.is_profile_ready, true);
  assertEquals(state.is_enriched, true);
  assertEquals(state.request_lifecycle, "enriched");
});

Deno.test("Created place: ready + no enriched_at is NOT enriched and still accepts votes", () => {
  assertEquals(
    placeRequestLifecycle({ requestCount: 0, enrichedAt: null }),
    "listed",
  );
  assertEquals(
    placeRequestLifecycle({ requestCount: 2, enrichedAt: null }),
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
  const created = placeRequestState({
    requestCount: 2,
    threshold: 3,
    requested: true,
    contentState: "ready",
    enrichedAt: null,
  });
  assertEquals(created.is_profile_ready, true);
  assertEquals(created.is_enriched, false);
  assertEquals(created.request_lifecycle, "requested");
});

Deno.test("a missing enrichedAt never lets ready read as Enriched (MESITA-2154)", () => {
  // The deleted fallback treated `enrichedAt === undefined && ready` as
  // enriched; two admin EFs that forgot the column shipped requested=false.
  const state = placeRequestState({
    requestCount: 2,
    threshold: 3,
    requested: true,
    contentState: "ready",
    enrichedAt: undefined,
  });
  assertEquals(state.is_enriched, false);
  assertEquals(state.request_lifecycle, "requested");
});

Deno.test("Update every N views: each new view on a multiple of N, never a repeat view or mid-run (MESITA-2997)", () => {
  const base = { inserted: true, firstAfter: 10, everyViews: 10, contentState: "ready", enrichmentTriggered: false };
  assertEquals([9, 10, 11, 20, 30].map((n) => shouldTriggerViewUpdate({ ...base, requestCount: n })), [
    false,
    true,
    false,
    true,
    true,
  ]);
  assertEquals(shouldTriggerViewUpdate({ ...base, requestCount: 10, inserted: false }), false);
  assertEquals(shouldTriggerViewUpdate({ ...base, requestCount: 10, enrichmentTriggered: true }), false);
  assertEquals(shouldTriggerViewUpdate({ ...base, requestCount: 10, contentState: "generating" }), false);
  assertEquals(shouldTriggerViewUpdate({ ...base, requestCount: 10, firstAfter: 0 }), false);
});

Deno.test("first after N, then every M (MESITA-3934)", () => {
  const due = (count: number, firstAfter: number, every: number) => viewCycleDue({ count, firstAfter, every });
  // Pato's example: first at 5, then every 50.
  assertEquals([4, 5, 6, 54, 55, 105].map((n) => due(n, 5, 50)), [false, true, false, false, true, true]);
  // Every 0 runs once; first 0 is off.
  assertEquals([5, 55].map((n) => due(n, 5, 0)), [true, false]);
  assertEquals(due(10, 0, 10), false);
});

Deno.test("Deep Enrich repeats only on an enriched place, on a new view at N + kM (MESITA-3934)", () => {
  const base = {
    inserted: true,
    threshold: 5,
    everyViews: 50,
    contentState: "ready",
    enrichedAt: "2026-11-01T00:00:00Z",
  };
  assertEquals([5, 54, 55, 105].map((n) => shouldTriggerRepeatEnrichment({ ...base, requestCount: n })), [
    false,
    false,
    true,
    true,
  ]);
  assertEquals(shouldTriggerRepeatEnrichment({ ...base, requestCount: 55, enrichedAt: null }), false);
  assertEquals(shouldTriggerRepeatEnrichment({ ...base, requestCount: 55, inserted: false }), false);
  assertEquals(shouldTriggerRepeatEnrichment({ ...base, requestCount: 55, everyViews: 0 }), false);
  assertEquals(shouldTriggerRepeatEnrichment({ ...base, requestCount: 55, contentState: "generating" }), false);
});
