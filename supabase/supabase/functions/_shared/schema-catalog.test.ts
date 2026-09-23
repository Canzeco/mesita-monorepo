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
// Guard test 2's THREE legs — "closed-key-sets (class, function, channel)" —
// are now all covered, split across two files. Function (FUNCTION_STATE_KEYS
// below) and channel (ChannelSet alias test below, plus channels.test.ts's
// tiktok/tripadvisor/yelp retirement coverage) live here. The CLASS leg
// (MESITA-1282) lives in consumer-doc.test.ts instead, next to the
// validator it tests — consumer-doc.ts's class_key/invitation_class_key
// validation is now the real closed set Postgres already enforces via FK
// (consumers_tier_key_fkey -> classes(key)), not the "any non-empty string"
// this file used to flag as an open gap.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { CRENUP_EXTRAS, CRENUP_LADDER, type CrenupStep } from "./crenup-ladder.ts";
import {
  EnrichmentMapSchema,
  FUNCTION_STATE_KEYS,
  FunctionStateMapSchema,
  foldFunctionStateMap,
  isBillingState,
  isFunctionState,
  isMoney,
  operatorFunctionStates,
  crenupBlockedAtFromMap,
  crenupHighWaterFromMap,
  toFunctionState,
  type BillingState,
  type ChannelSet,
  type ChannelSetKey,
  type FunctionState,
  type FunctionStateMap,
  type Money,
} from "./schema-catalog.ts";
import type { ChannelKey, Channels } from "./channels.ts";

// ── Closed-key-sets: FunctionState is indexed by CrenupStep, and nothing else ──

Deno.test("FUNCTION_STATE_KEYS is exactly CRENUP_LADDER + CRENUP_EXTRAS, in that order", () => {
  const expected: readonly CrenupStep[] = [...CRENUP_LADDER, ...CRENUP_EXTRAS];
  assertEquals(FUNCTION_STATE_KEYS, expected);
});

Deno.test("FUNCTION_STATE_KEYS has 8 members — Details through Embedding", () => {
  assertEquals(CRENUP_LADDER.length, 8);
  assertEquals(CRENUP_EXTRAS.length, 0);
  assertEquals(FUNCTION_STATE_KEYS.length, 8);
});

Deno.test("FUNCTION_STATE_KEYS carries no duplicate — the two arrays never overlap", () => {
  const seen = new Set(FUNCTION_STATE_KEYS);
  assertEquals(seen.size, FUNCTION_STATE_KEYS.length);
});

// The runtime tests above only prove the key LIST is right; this proves the
// compile-time belt — TypeScript rejects a key outside CrenupStep — actually
// holds (MESITA-1247 guard test 2, function leg, compile-time half).
Deno.test("FunctionStateMap rejects a key outside CrenupStep at compile time", () => {
  const map: FunctionStateMap = { details: { state: "pending", at: null, detail: null } };
  // @ts-expect-error — "bogus" is not a CrenupStep; FunctionStateMap must reject it
  map.bogus = { state: "pending", at: null, detail: null };
  // @ts-expect-error — `pulse` is a RETIRED rung (MESITA-2027), not a CrenupStep
  map.pulse = { state: "pending", at: null, detail: null };
  assertEquals(map.details?.state, "pending");
});

// ChannelSet is a straight alias, not a copy — assert the two types accept
// the identical value shape rather than merely having identical field names.
Deno.test("ChannelSet accepts exactly what Channels accepts (alias, not a copy)", () => {
  const real: Channels = {
    website_url: "https://example.com",
    instagram_url: null,
    facebook_url: null,
    x_url: null,
    threads_url: null,
    reddit_url: null,
    whatsapp_url: null,
    opentable_url: null,
    resy_url: null,
    uber_eats_url: null,
    didi_food_url: null,
    google_maps_url: null,
  };
  const viaCatalog: ChannelSet = real;
  assertEquals(viaCatalog, real);

  const key: ChannelSetKey = "instagram_url";
  const sameKey: ChannelKey = key;
  assertEquals(sameKey, "instagram_url");
});

// ── Money ────────────────────────────────────────────────────────────────

Deno.test("isMoney: accepts integer cents + non-empty currency", () => {
  const m: Money = { cents: 100000, currency: "MXN" };
  assert(isMoney(m));
});

Deno.test("isMoney: rejects a float, a missing currency, and a non-object", () => {
  assert(!isMoney({ cents: 100.5, currency: "MXN" }), "float cents");
  assert(!isMoney({ cents: 100000, currency: "" }), "empty currency");
  assert(!isMoney({ cents: 100000 }), "missing currency");
  assert(!isMoney(null));
  assert(!isMoney("MX$1,000"));
});

// ── BillingState — the shape stripe-billing.ts's private PlanRow already is ──

Deno.test("isBillingState: accepts the project_plans / consumer_plans row shape", () => {
  const projectPlanRow: BillingState = {
    price_cents: 100000,
    currency: "MXN",
    stripe_price_id: "price_abc123",
  };
  assert(isBillingState(projectPlanRow));

  const consumerPlanRow: BillingState = {
    price_cents: 5000,
    currency: "MXN",
    stripe_price_id: null, // not yet self-provisioned
  };
  assert(isBillingState(consumerPlanRow));
});

Deno.test("isBillingState: rejects a wrong-typed stripe_price_id", () => {
  assert(
    !isBillingState({ price_cents: 100000, currency: "MXN", stripe_price_id: 123 }),
  );
});

// ── FunctionState ────────────────────────────────────────────────────────

Deno.test("isFunctionState: accepts all three states, rejects a fourth", () => {
  const pending: FunctionState = { state: "pending", at: null, detail: null };
  const completed: FunctionState = {
    state: "completed",
    at: "2026-08-23T00:00:00Z",
    detail: "6 photos saved",
  };
  const failed: FunctionState = {
    state: "failed",
    at: "2026-08-23T00:00:00Z",
    detail: "timeout",
  };
  assert(isFunctionState(pending));
  assert(isFunctionState(completed));
  assert(isFunctionState(failed));
  assert(!isFunctionState({ state: "skipped", at: null, detail: null }));
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
    everyDays: 30, // MESITA-1249 deliberately did not fold the schedule in
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
