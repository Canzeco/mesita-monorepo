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
// REVIEW FINDING (MESITA-1247): the issue names guard test 2 as THREE legs —
// "closed-key-sets (class, function, channel)". This file covers function
// (FUNCTION_STATE_KEYS below) and channel (ChannelSet alias test below,
// plus channels.test.ts's tiktok/tripadvisor/yelp retirement coverage). The
// CLASS leg — a closed set for consumers.class_key — is NOT covered here,
// and not because it's cheap to add correctly: consumer-doc.ts (PR #1157,
// the canonical, already-shipped consumer door) validates class_key as
// "any non-empty string", not a closed enum — per repo law (class bronze <
// silver < gold < diamond are EARNED labels, but the DB column stores
// LEGACY keys, never the metal names themselves), the actual legal set
// lives in the classes-v2 bridge, not in consumer-doc.ts. Writing a
// closed-key-set test here would either (a) test a property consumer-doc.ts
// itself doesn't enforce — asserting something false about the shipped
// validator — or (b) require changing consumer-doc.ts's own validation,
// which is out of scope for this PR to do correctly without the product
// clarity on the exact legal set that a dedicated pass needs. Left
// undone and flagged rather than guessed at; see MESITA-1247's follow-up
// issue for the class-key closed-set leg.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { PULSE_EXTRAS, PULSE_PIECES, type PulseStep } from "./pulse-pieces.ts";
import {
  FUNCTION_STATE_KEYS,
  isBillingState,
  isFunctionState,
  isMoney,
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

Deno.test("FUNCTION_STATE_KEYS has 11 members — 9 enrich functions + 2 semantic", () => {
  assertEquals(PULSE_PIECES.length, 9);
  assertEquals(PULSE_EXTRAS.length, 2);
  assertEquals(FUNCTION_STATE_KEYS.length, 11);
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
