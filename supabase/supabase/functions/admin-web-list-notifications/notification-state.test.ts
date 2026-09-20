import { assertEquals } from "jsr:@std/assert";
import { CRENUP_TOTAL } from "../_shared/crenup-ladder.ts";
import { completedFunctions, placeStateFacts } from "./notification-state.ts";

const BASE = {
  googlePlaceId: "ChIJxxxx",
  state: "active",
  businessStatus: "OPERATIONAL",
  plan: "free",
  highWater: 2,
  verified: false,
  promotingRow: { plan: "free" },
};

Deno.test("catalog default: seeded · active · listed, not verified/partner/promoting", () => {
  const facts = placeStateFacts(BASE);
  assertEquals(facts.seeded, true);
  assertEquals(facts.active, true);
  assertEquals(facts.listed, true);
  assertEquals(facts.requested, false);
  assertEquals(facts.enriching, false);
  assertEquals(facts.enriched, false);
  assertEquals(facts.enrichCrenup, 2);
  assertEquals(facts.enrichCrenupTotal, CRENUP_TOTAL);
  assertEquals(facts.verified, false);
  assertEquals(facts.partner, false);
  assertEquals(facts.promoting, false);
});

Deno.test("Requested is guest demand, not a projects.state label", () => {
  assertEquals(placeStateFacts({ ...BASE, requestCount: 2, contentState: "queued" }).requested, true);
  assertEquals(placeStateFacts({ ...BASE, requestCount: 2, contentState: "ready" }).requested, false);
  assertEquals(placeStateFacts({ ...BASE, state: "pending_verification" }).requested, false);
  assertEquals(placeStateFacts({ ...BASE, state: "pending_verification" }).listed, false);
});

Deno.test("listing_type is not a fact — paused is Unlisted even if unclaimed", () => {
  const facts = placeStateFacts({ ...BASE, state: "paused" });
  assertEquals(facts.listed, false);
});

Deno.test("Active is OPERATIONAL only", () => {
  assertEquals(
    placeStateFacts({ ...BASE, businessStatus: "CLOSED_TEMPORARILY" }).active,
    false,
  );
  assertEquals(placeStateFacts({ ...BASE, businessStatus: null }).active, false);
});

Deno.test("Enriched is a complete CRENUP ladder, not a boolean from enriched_at", () => {
  assertEquals(placeStateFacts({ ...BASE, highWater: 0 }).enriched, false);
  assertEquals(placeStateFacts({ ...BASE, highWater: CRENUP_TOTAL }).enriched, true);
});

Deno.test("Verified is the approved-proof flag, never an owner row", () => {
  assertEquals(placeStateFacts({ ...BASE, verified: true }).verified, true);
});

Deno.test("functions map only completed Crenup keys", () => {
  const facts = placeStateFacts({
    ...BASE,
    functions: {
      details: { state: "completed", at: "2026-08-25T00:00:00.000Z", detail: null },
      serp: { state: "failed", at: "2026-08-25T00:00:00.000Z", detail: "x" },
      links: { state: "pending", at: null, detail: null },
    },
  });
  assertEquals(facts.functions.details, true);
  assertEquals(facts.functions.serp, undefined);
  assertEquals(facts.functions.links, undefined);
  assertEquals(completedFunctions(undefined), {});
});

Deno.test("Enriching is content_state generating/queued, independent of Enriched", () => {
  const idle = placeStateFacts({ ...BASE, highWater: CRENUP_TOTAL });
  assertEquals(idle.enriching, false);
  assertEquals(idle.enriched, true);
  const rerun = placeStateFacts({
    ...BASE,
    contentState: "generating",
    highWater: CRENUP_TOTAL,
  });
  assertEquals(rerun.enriching, true);
  assertEquals(rerun.enriched, true);
  const queued = placeStateFacts({ ...BASE, contentState: "queued" });
  assertEquals(queued.enriching, true);
});
