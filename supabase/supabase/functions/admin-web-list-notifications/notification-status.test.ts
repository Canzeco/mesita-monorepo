import { assertEquals } from "jsr:@std/assert";
import { PULSE_TOTAL } from "../_shared/pulse-pieces.ts";
import { placeStatusFacts } from "./notification-status.ts";

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
  assertEquals(facts.enriched, false);
  assertEquals(facts.enrichPulse, 2);
  assertEquals(facts.enrichPulseTotal, PULSE_TOTAL);
  assertEquals(facts.verified, false);
  assertEquals(facts.partner, false);
  assertEquals(facts.promoting, false);
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
