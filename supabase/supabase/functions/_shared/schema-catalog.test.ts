// Guard tests for the sub-schema catalog (MESITA-1247).
//
// Two of the seven guard tests the issue names are testable today, against
// what already exists, without waiting for the six aggregate validators:
// closed-key-sets, and the derived-index discipline pulse-pieces.ts already
// enforces for its own array. The other five — validator accept/reject,
// deletion-law visibility, create-quota concurrency, review->rollup math,
// place-card size budget — need the aggregate validators or a materialized
// place-card projection that do not exist yet; they belong to the PRs that
// build those.
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
import { PULSE_EXTRAS, PULSE_PIECES, type PulseStep } from "./pulse-pieces.ts";
import {
  EnrichmentMapSchema,
  FUNCTION_STATE_KEYS,
  FunctionStateMapSchema,
  foldFunctionStateMap,
  isBillingState,
  isFunctionState,
  isMoney,
  operatorFunctionStates,
  pulseBlockedAtFromMap,
  pulseHighWaterFromMap,
  toFunctionStatus,
  type BillingState,
  type ChannelSet,
  type ChannelSetKey,
  type FunctionState,
  type FunctionStateMap,
  type Money,
} from "./schema-catalog.ts";
import type { ChannelKey, Channels } from "./channels.ts";

// ── Closed-key-sets: FunctionState is indexed by PulseStep, and nothing else ──

Deno.test("FUNCTION_STATE_KEYS is exactly PULSE_PIECES + PULSE_EXTRAS, in that order", () => {
  const expected: readonly PulseStep[] = [...PULSE_PIECES, ...PULSE_EXTRAS];
  assertEquals(FUNCTION_STATE_KEYS, expected);
});

Deno.test("FUNCTION_STATE_KEYS has 10 members — Pulse through Semantics", () => {
  assertEquals(PULSE_PIECES.length, 10);
  assertEquals(PULSE_EXTRAS.length, 0);
  assertEquals(FUNCTION_STATE_KEYS.length, 10);
});

Deno.test("FUNCTION_STATE_KEYS carries no duplicate — the two arrays never overlap", () => {
  const seen = new Set(FUNCTION_STATE_KEYS);
  assertEquals(seen.size, FUNCTION_STATE_KEYS.length);
});

// The runtime tests above only prove the key LIST is right; this proves the
// compile-time belt — TypeScript rejects a key outside PulseStep — actually
// holds (MESITA-1247 guard test 2, function leg, compile-time half).
Deno.test("FunctionStateMap rejects a key outside PulseStep at compile time", () => {
  const map: FunctionStateMap = { pulse: { status: "pending", at: null, detail: null } };
  // @ts-expect-error — "bogus" is not a PulseStep; FunctionStateMap must reject it
  map.bogus = { status: "pending", at: null, detail: null };
  assertEquals(map.pulse?.status, "pending");
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

Deno.test("isFunctionState: accepts all three statuses, rejects a fourth", () => {
  const pending: FunctionState = { status: "pending", at: null, detail: null };
  const completed: FunctionState = {
    status: "completed",
    at: "2026-08-23T00:00:00Z",
    detail: "6 photos saved",
  };
  const failed: FunctionState = {
    status: "failed",
    at: "2026-08-23T00:00:00Z",
    detail: "timeout",
  };
  assert(isFunctionState(pending));
  assert(isFunctionState(completed));
  assert(isFunctionState(failed));
  assert(!isFunctionState({ status: "skipped", at: null, detail: null }));
});

// ── The materialized enrichment state map (MESITA-1249) ────────────────────

Deno.test("FunctionStateMapSchema: accepts a genuinely partial map — absent keys stay absent", () => {
  const r = FunctionStateMapSchema.parse({
    pulse: { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
  });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(Object.keys(r.value), ["pulse"]);
  assert(!("details" in r.value), "an unset piece must not round-trip as a fabricated pending entry");
});

Deno.test("FunctionStateMapSchema: accepts an empty map (a brand-new place)", () => {
  const r = FunctionStateMapSchema.parse({});
  assert(r.ok);
  if (r.ok) assertEquals(r.value, {});
});

Deno.test("FunctionStateMapSchema: rejects a key outside the PulseSteps", () => {
  const r = FunctionStateMapSchema.parse({ seed: { status: "completed", at: null, detail: null } });
  assert(!r.ok);
});

Deno.test("FunctionStateMapSchema: rejects a malformed FunctionState value", () => {
  const r = FunctionStateMapSchema.parse({ pulse: { status: "skipped", at: null, detail: null } });
  assert(!r.ok);
});

Deno.test("EnrichmentMapSchema: accepts the CREATED-floor default", () => {
  const r = EnrichmentMapSchema.parse({ functions: {}, highWater: 0, blockedAt: null });
  assert(r.ok);
});

Deno.test("EnrichmentMapSchema: accepts a fully-enriched map with blockedAt null", () => {
  const full: Record<string, unknown> = {};
  for (const key of FUNCTION_STATE_KEYS) {
    full[key] = { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" };
  }
  const r = EnrichmentMapSchema.parse({ functions: full, highWater: 10, blockedAt: null });
  assert(r.ok);
});

Deno.test("EnrichmentMapSchema: accepts a blocked map with a real PulseBlock", () => {
  const r = EnrichmentMapSchema.parse({
    functions: { pulse: { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" } },
    highWater: 1,
    blockedAt: { key: "details", index: 2, status: "missing" },
  });
  assert(r.ok);
});

Deno.test("EnrichmentMapSchema: rejects highWater out of 0-10 range, a non-integer, and a bad blockedAt.status", () => {
  assert(!EnrichmentMapSchema.parse({ functions: {}, highWater: 11, blockedAt: null }).ok, "11 is over PULSE_TOTAL");
  assert(!EnrichmentMapSchema.parse({ functions: {}, highWater: -1, blockedAt: null }).ok, "negative");
  assert(!EnrichmentMapSchema.parse({ functions: {}, highWater: 3.5, blockedAt: null }).ok, "non-integer");
  assert(
    !EnrichmentMapSchema.parse({
      functions: {},
      highWater: 0,
      blockedAt: { key: "pulse", index: 1, status: "completed" },
    }).ok,
    "blockedAt.status must be failed|missing, never completed",
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

// pulseHighWaterFromMap/pulseBlockedAtFromMap mirror pulse-pieces.ts's own
// event-based walk (converting the map back to its event shape, not a
// second implementation) — a few of that file's own pinned invariants,
// re-run over the map path so the two can never silently diverge.

function stamped(...pieces: string[]): FunctionStateMap {
  const map: Record<string, FunctionState> = {};
  for (const p of pieces) map[p] = { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" };
  return map as FunctionStateMap;
}

Deno.test("pulseHighWaterFromMap: empty map -> 0, full map -> 10", () => {
  assertEquals(pulseHighWaterFromMap({}), 0);
  assertEquals(pulseHighWaterFromMap(stamped(...PULSE_PIECES)), 10);
});

Deno.test("pulseHighWaterFromMap: a gap stops the count even if a later piece completed", () => {
  // links (4) missing, social (5) completed anyway.
  const map = stamped("pulse", "details", "serp", "social");
  assertEquals(pulseHighWaterFromMap(map), 3);
});

Deno.test("pulseHighWaterFromMap: Embedding at 10 cannot skip a gap", () => {
  const map: FunctionStateMap = {
    ...stamped("pulse", "details"),
    embedding: { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
  };
  assertEquals(pulseHighWaterFromMap(map), 2, "function 10 cannot skip 3–9");
});

Deno.test("pulseBlockedAtFromMap: missing vs failed, and null when the queue finished", () => {
  assertEquals(pulseBlockedAtFromMap({}), { key: "pulse", index: 1, status: "missing" });
  const failedAtLinks: FunctionStateMap = {
    ...stamped("pulse", "details", "serp"),
    links: { status: "failed", at: "2026-08-23T00:00:00Z", detail: "timeout" },
  };
  assertEquals(pulseBlockedAtFromMap(failedAtLinks), { key: "links", index: 4, status: "failed" });
  assertEquals(pulseBlockedAtFromMap(stamped(...PULSE_PIECES)), null);
});

Deno.test("pulseBlockedAtFromMap: a pending (in-flight) piece reads as failed, same as pulse-pieces.ts's own skipped rule", () => {
  const map: FunctionStateMap = {
    ...stamped("pulse"),
    details: { status: "pending", at: "2026-08-23T00:00:00Z", detail: null },
  };
  assertEquals(pulseBlockedAtFromMap(map), { key: "details", index: 2, status: "failed" });
});

Deno.test("toFunctionStatus: completed stays completed, started becomes pending, everything else becomes failed", () => {
  assertEquals(toFunctionStatus("completed"), "completed");
  assertEquals(toFunctionStatus("started"), "pending");
  assertEquals(toFunctionStatus("failed"), "failed");
  assertEquals(toFunctionStatus("skipped"), "failed");
  assertEquals(toFunctionStatus("some-future-unknown-status"), "failed");
});

Deno.test("FunctionStateMapSchema: folds legacy name+summary into embedding", () => {
  const r = FunctionStateMapSchema.parse({
    pulse: { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
    name: { status: "completed", at: "2026-08-23T00:01:00Z", detail: "name ok" },
    summary: { status: "completed", at: "2026-08-23T00:02:00Z", detail: "summary ok" },
  });
  assert(r.ok);
  if (!r.ok) return;
  assertEquals(r.value.embedding?.status, "completed");
  assertEquals("name" in r.value, false);
  assertEquals("summary" in r.value, false);
});

Deno.test("foldFunctionStateMap: the RENAMED semantic folds into embedding", () => {
  // §8.4 v3: function 10 renamed Semantic → Embedding. A stored map stamped
  // under the old key keeps reading as function 10 — including the merge
  // path (mergeEnrichmentMap folds before recomputing the high-water).
  const folded = foldFunctionStateMap({
    semantic: { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
  });
  assertEquals(folded.embedding?.status, "completed");
  assertEquals("semantic" in folded, false);
  // A real embedding stamp wins over the legacy key.
  const both = foldFunctionStateMap({
    semantic: { status: "failed", at: "a", detail: "old" },
    embedding: { status: "completed", at: "b", detail: "new" },
  });
  assertEquals(both.embedding?.status, "completed");
});

Deno.test("operatorFunctionStates: ten keys, Embedding pending when never run", () => {
  const out = operatorFunctionStates({
    pulse: { status: "completed", at: "2026-08-23T00:00:00Z", detail: "ok" },
  });
  assertEquals(Object.keys(out).length, 10);
  assertEquals(out.pulse.status, "completed");
  assertEquals(out.embedding.status, "pending");
  assertEquals(out.description.status, "pending");
});

Deno.test("foldFunctionStateMap: either failed alias fails Embedding", () => {
  const folded = foldFunctionStateMap({
    name: { status: "completed", at: "a", detail: "n" },
    summary: { status: "failed", at: "b", detail: "s" },
  });
  assertEquals(folded.embedding?.status, "failed");
});
