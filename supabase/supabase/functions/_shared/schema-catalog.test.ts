// Guard tests for the sub-schema catalog (MESITA-1247).
//
// Two of the seven guard tests the issue names were testable before the
// aggregate validators existed:
// closed-key-sets, and the derived-index discipline crenup-ladder.ts already
// enforces for its own array. The place-card size budget (guard test 7)
// lives in place-columns.test.ts, next to the PLACE_CARD_COLUMNS projection
// it measures. The other four — validator accept/reject, deletion-law
// visibility, create-quota concurrency, review->rollup math — were left to
// the PRs that build the aggregate validators.
//
// Guard test 2 names three closed key sets — "class, function, channel".
// Function lives here (FunctionStateMap below); channel is channels.test.ts's
// tiktok/tripadvisor/yelp retirement coverage. There is no class set left to
// close: a consumer carries no class.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { CRENUP_LADDER } from "./crenup-ladder.ts";
import {
  EnrichmentMapSchema,
  FUNCTION_STATE_KEYS,
  FunctionStateMapSchema,
  foldFunctionStateMap,
  operatorFunctionStates,
  crenupBlockedAtFromMap,
  crenupHighWaterFromMap,
  toFunctionState,
  type FunctionState,
  type FunctionStateMap,
} from "./schema-catalog.ts";

// ── Closed-key-sets: FunctionState is indexed by CrenupStep, and nothing else ──

// The compile-time belt — TypeScript rejects a key outside CrenupStep —
// actually holds (MESITA-1247 guard test 2, function leg).
Deno.test("FunctionStateMap rejects a key outside CrenupStep at compile time", () => {
  const map: FunctionStateMap = { details: { state: "pending", at: null, detail: null } };
  // @ts-expect-error — "bogus" is not a CrenupStep; FunctionStateMap must reject it
  map.bogus = { state: "pending", at: null, detail: null };
  // @ts-expect-error — `pulse` is a RETIRED rung (MESITA-2027), not a CrenupStep
  map.pulse = { state: "pending", at: null, detail: null };
  assertEquals(map.details?.state, "pending");
});

// ── The materialized enrichment state map (MESITA-1249) ────────────────────

Deno.test("FunctionStateMapSchema: accepts a genuinely partial map — absent keys stay absent", () => {
  const r = FunctionStateMapSchema.parse({
    details: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
  });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(Object.keys(r.value), ["details"]);
  assert(!("serp" in r.value), "an unset piece must not round-trip as a fabricated pending entry");
});

Deno.test("FunctionStateMapSchema: accepts an empty map (a brand-new place)", () => {
  const r = FunctionStateMapSchema.parse({});
  assert(r.ok);
  if (r.ok) assertEquals(r.value, {});
});

Deno.test("FunctionStateMapSchema: rejects a key outside the PulseSteps", () => {
  const r = FunctionStateMapSchema.parse({ seed: { state: "completed", at: null, detail: null } });
  assert(!r.ok);
});

Deno.test("FunctionStateMapSchema: rejects a malformed FunctionState value", () => {
  const r = FunctionStateMapSchema.parse({ pulse: { state: "skipped", at: null, detail: null } });
  assert(!r.ok);
});

Deno.test("EnrichmentMapSchema: accepts the SEED-floor default", () => {
  const r = EnrichmentMapSchema.parse({ functions: {}, highWater: 0, blockedAt: null });
  assert(r.ok);
});

Deno.test("EnrichmentMapSchema: accepts a fully-enriched map with blockedAt null", () => {
  const full: Record<string, unknown> = {};
  for (const key of FUNCTION_STATE_KEYS) {
    full[key] = { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" };
  }
  const r = EnrichmentMapSchema.parse({ functions: full, highWater: 8, blockedAt: null });
  assert(r.ok);
});

Deno.test("EnrichmentMapSchema: accepts a blocked map with a real CrenupBlock", () => {
  const r = EnrichmentMapSchema.parse({
    functions: { details: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" } },
    highWater: 1,
    blockedAt: { key: "serp", index: 2, state: "missing" },
  });
  assert(r.ok);
});

Deno.test("EnrichmentMapSchema: rejects highWater out of 0-8 range, a non-integer, and a bad blockedAt.state", () => {
  assert(!EnrichmentMapSchema.parse({ functions: {}, highWater: 9, blockedAt: null }).ok, "9 is over CRENUP_TOTAL");
  assert(!EnrichmentMapSchema.parse({ functions: {}, highWater: -1, blockedAt: null }).ok, "negative");
  assert(!EnrichmentMapSchema.parse({ functions: {}, highWater: 3.5, blockedAt: null }).ok, "non-integer");
  assert(
    !EnrichmentMapSchema.parse({
      functions: {},
      highWater: 0,
      blockedAt: { key: "details", index: 1, state: "completed" },
    }).ok,
    "blockedAt.state must be failed|missing, never completed",
  );
});

Deno.test("EnrichmentMapSchema: rejects an unknown top-level key", () => {
  const r = EnrichmentMapSchema.parse({
    functions: {},
    highWater: 0,
    blockedAt: null,
    everyDays: 30, // the schedule was never folded in, and is retired (MESITA-2144)
  });
  assert(!r.ok);
});

// crenupHighWaterFromMap/crenupBlockedAtFromMap mirror crenup-ladder.ts's own
// event-based walk (converting the map back to its event shape, not a
// second implementation) — a few of that file's own pinned invariants,
// re-run over the map path so the two can never silently diverge.

function stamped(...pieces: string[]): FunctionStateMap {
  const map: Record<string, FunctionState> = {};
  for (const p of pieces) map[p] = { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" };
  return map as FunctionStateMap;
}

Deno.test("crenupHighWaterFromMap: empty map -> 0, full map -> 8", () => {
  assertEquals(crenupHighWaterFromMap({}), 0);
  assertEquals(crenupHighWaterFromMap(stamped(...CRENUP_LADDER)), 8);
});

Deno.test("crenupHighWaterFromMap: a gap stops the count even if a later piece completed", () => {
  // links (3) missing, social (4) completed anyway.
  const map = stamped("details", "serp", "social");
  assertEquals(crenupHighWaterFromMap(map), 2);
});

Deno.test("crenupHighWaterFromMap: Embedding at 8 cannot skip a gap", () => {
  const map: FunctionStateMap = {
    ...stamped("details", "serp"),
    embedding: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
  };
  assertEquals(crenupHighWaterFromMap(map), 2, "function 8 cannot skip 3–7");
});

Deno.test("crenupBlockedAtFromMap: missing vs failed, and null when the queue finished", () => {
  assertEquals(crenupBlockedAtFromMap({}), { key: "details", index: 1, state: "missing" });
  const failedAtLinks: FunctionStateMap = {
    ...stamped("details", "serp"),
    links: { state: "failed", at: "2026-08-23T00:00:00Z", detail: "timeout" },
  };
  assertEquals(crenupBlockedAtFromMap(failedAtLinks), { key: "links", index: 3, state: "failed" });
  assertEquals(crenupBlockedAtFromMap(stamped(...CRENUP_LADDER)), null);
});

Deno.test("crenupBlockedAtFromMap: a pending (in-flight) piece reads as failed, same as crenup-ladder.ts's own skipped rule", () => {
  const map: FunctionStateMap = {
    ...stamped("details"),
    serp: { state: "pending", at: "2026-08-23T00:00:00Z", detail: null },
  };
  assertEquals(crenupBlockedAtFromMap(map), { key: "serp", index: 2, state: "failed" });
});

Deno.test("toFunctionState: completed stays completed, started becomes pending, everything else becomes failed", () => {
  assertEquals(toFunctionState("completed"), "completed");
  assertEquals(toFunctionState("started"), "pending");
  assertEquals(toFunctionState("failed"), "failed");
  assertEquals(toFunctionState("skipped"), "failed");
  assertEquals(toFunctionState("some-future-unknown-state"), "failed");
});

Deno.test("FunctionStateMapSchema: folds legacy name+summary into embedding", () => {
  const r = FunctionStateMapSchema.parse({
    details: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
    name: { state: "completed", at: "2026-08-23T00:01:00Z", detail: "name ok" },
    summary: { state: "completed", at: "2026-08-23T00:02:00Z", detail: "summary ok" },
  });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.value.embedding?.state, "completed");
  assertEquals("name" in r.value, false);
  assertEquals("summary" in r.value, false);
});

Deno.test("foldFunctionStateMap: the RENAMED semantic folds into embedding", () => {
  // §8.4 v3: the last function renamed Semantic → Embedding. A stored map
  // stamped under the old key keeps reading as that function — including the
  // merge path (mergeEnrichmentMap folds before recomputing the high-water).
  const folded = foldFunctionStateMap({
    semantic: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
  });
  assertEquals(folded.embedding?.state, "completed");
  assertEquals("semantic" in folded, false);
  // A real embedding stamp wins over the legacy key.
  const both = foldFunctionStateMap({
    semantic: { state: "failed", at: "a", detail: "old" },
    embedding: { state: "completed", at: "b", detail: "new" },
  });
  assertEquals(both.embedding?.state, "completed");
});

Deno.test("foldFunctionStateMap: legacy `status`-spelled records fold to `state`", () => {
  // MESITA-1542 renamed the identifier; stored `places.enrichment` JSONB was
  // not rewritten, so a pre-rename map still spells the per-function field
  // `status`. The fold absorbs it on read — the next write re-materializes.
  const legacy = {
    details: { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
  } as unknown as Parameters<typeof foldFunctionStateMap>[0];
  const folded = foldFunctionStateMap(legacy);
  assertEquals(folded.details?.state, "completed");
  const parsed = FunctionStateMapSchema.parse(legacy);
  assert(parsed.ok);
  if (parsed.ok) assertEquals(parsed.value.details?.state, "completed");
});

Deno.test("operatorFunctionStates: eight keys, Embedding pending when never run", () => {
  const out = operatorFunctionStates({
    details: { state: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
  });
  assertEquals(Object.keys(out).length, 8);
  assertEquals(out.details.state, "completed");
  assertEquals(out.embedding.state, "pending");
  assertEquals(out.description.state, "pending");
});

Deno.test("foldFunctionStateMap: either failed alias fails Embedding", () => {
  const folded = foldFunctionStateMap({
    name: { state: "completed", at: "a", detail: "n" },
    summary: { state: "failed", at: "b", detail: "s" },
  });
  assertEquals(folded.embedding?.state, "failed");
});
