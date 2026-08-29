import { assertEquals } from "jsr:@std/assert";
import { PULSE_TOTAL } from "../_shared/pulse-pieces.ts";
import { completedFunctions, placeStatusFacts } from "./notification-status.ts";

const BASE = {
  googlePlaceId: "ChIJxxxx",
  status: "active",
  businessStatus: "OPERATIONAL",
  plan: "free",
  highWater: 2,
  verified: false,
  promotingRow: { plan: "free" },
};

Deno.test("catalog default: seeded · active · listed, not verified/partner/promoting", () => {
  const facts = placeStatusFacts(BASE);
  assertEquals(facts.seeded, true);
  assertEquals(facts.active, true);
  assertEquals(facts.listed, true);
  assertEquals(facts.requested, false);
  assertEquals(facts.enriching, false);
  assertEquals(facts.enriched, false);
  assertEquals(facts.enrichPulse, 2);
  assertEquals(facts.enrichPulseTotal, PULSE_TOTAL);
  assertEquals(facts.verified, false);
  assertEquals(facts.partner, false);
  assertEquals(facts.promoting, false);
});

Deno.test("Requested is guest demand, not a projects.status label", () => {
  assertEquals(placeStatusFacts({ ...BASE, requestCount: 2, contentStatus: "queued" }).requested, true);
  assertEquals(placeStatusFacts({ ...BASE, requestCount: 2, contentStatus: "ready" }).requested, false);
  assertEquals(placeStatusFacts({ ...BASE, status: "pending_verification" }).requested, false);
  assertEquals(placeStatusFacts({ ...BASE, status: "pending_verification" }).listed, false);
});

Deno.test("listing_type is not a fact — paused is Unlisted even if unclaimed", () => {
  const facts = placeStatusFacts({ ...BASE, status: "paused" });
  assertEquals(facts.listed, false);
});

Deno.test("Active is OPERATIONAL only", () => {
  assertEquals(
    placeStatusFacts({ ...BASE, businessStatus: "CLOSED_TEMPORARILY" }).active,
    false,
  );
  assertEquals(placeStatusFacts({ ...BASE, businessStatus: null }).active, false);
});

Deno.test("Enriched is complete PULSE, not a boolean from enriched_at", () => {
  assertEquals(placeStatusFacts({ ...BASE, highWater: 0 }).enriched, false);
  assertEquals(placeStatusFacts({ ...BASE, highWater: PULSE_TOTAL }).enriched, true);
});

Deno.test("Verified is the approved-proof flag, never an owner row", () => {
  assertEquals(placeStatusFacts({ ...BASE, verified: true }).verified, true);
});

Deno.test("functions map only completed Intake keys", () => {
  const facts = placeStatusFacts({
    ...BASE,
    functions: {
      pulse: { status: "completed", at: "2026-08-25T00:00:00.000Z", detail: null },
      details: { status: "failed", at: "2026-08-25T00:00:00.000Z", detail: "x" },
      serp: { status: "pending", at: null, detail: null },
    },
  });
  assertEquals(facts.functions.pulse, true);
  assertEquals(facts.functions.details, undefined);
  assertEquals(facts.functions.serp, undefined);
  assertEquals(completedFunctions(undefined), {});
});

Deno.test("Enriching is content_status generating/queued, independent of Enriched", () => {
  const idle = placeStatusFacts({ ...BASE, highWater: PULSE_TOTAL });
  assertEquals(idle.enriching, false);
  assertEquals(idle.enriched, true);
  const rerun = placeStatusFacts({
    ...BASE,
    contentStatus: "generating",
    highWater: PULSE_TOTAL,
  });
  assertEquals(rerun.enriching, true);
  assertEquals(rerun.enriched, true);
  const queued = placeStatusFacts({ ...BASE, contentStatus: "queued" });
  assertEquals(queued.enriching, true);
});
