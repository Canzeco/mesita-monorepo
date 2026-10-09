// Unit tests for partner/lane derivation (MESITA-912).
//   deno test supabase/functions/_shared/partner-derivation.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  clearActivationStamps,
  clearForfeitStamps,
  deriveListingType,
} from "./partner-derivation.ts";

const CONSERVATIVE = {
  welcome_free_rate: 20,
  welcome_premium_rate: 30,
  free_rate: 10,
  premium_rate: 20,
};

const ZERO = {
  welcome_free_rate: null,
  welcome_premium_rate: null,
  free_rate: null,
  premium_rate: null,
};

Deno.test("deriveListingType: pro + non-zero strategy stays web (badge is Ultra-only)", () => {
  assertEquals(
    deriveListingType({ plan: "pro", rates: CONSERVATIVE, currentListingType: "web" }),
    undefined,
  );
});

Deno.test("deriveListingType: ultra on Zero → demote partner to web", () => {
  assertEquals(
    deriveListingType({ plan: "ultra", rates: ZERO, currentListingType: "partner" }),
    "web",
  );
});

Deno.test("deriveListingType: ultra on Zero, already web → unchanged", () => {
  assertEquals(
    deriveListingType({ plan: "ultra", rates: ZERO, currentListingType: "web" }),
    undefined,
  );
});

Deno.test("deriveListingType: free plan demotes partner → web", () => {
  assertEquals(
    deriveListingType({ plan: "free", rates: CONSERVATIVE, currentListingType: "partner" }),
    "web",
  );
});

Deno.test("deriveListingType: unclaimed left alone on demotion", () => {
  assertEquals(
    deriveListingType({ plan: "free", rates: CONSERVATIVE, currentListingType: "unclaimed" }),
    undefined,
  );
  assertEquals(
    deriveListingType({ plan: "pro", rates: ZERO, currentListingType: "unclaimed" }),
    undefined,
  );
});

Deno.test("deriveListingType: ultra plan counts as member", () => {
  assertEquals(
    deriveListingType({ plan: "ultra", rates: CONSERVATIVE, currentListingType: "web" }),
    "partner",
  );
});

// Every plan write (both plan doors, the Membership cascade, strike 3) puts
// these resets into the same patch as the plan change, so the exact key set
// is the contract: a missing key leaves a stale stamp on the place, an extra
// one clobbers a column the writer never meant to touch.
Deno.test("clearActivationStamps: nulls exactly the two activation stamps, keeps the rest", () => {
  const patch: Record<string, unknown> = { plan: "free" };
  clearActivationStamps(patch);
  assertEquals(patch, {
    plan: "free",
    plan_live_at: null,
    first_ticket_honored_at: null,
  });
});

Deno.test("clearForfeitStamps: wipes forfeit + strike state and restarts activation", () => {
  const patch: Record<string, unknown> = { plan: "pro" };
  clearForfeitStamps(patch);
  assertEquals(patch, {
    plan: "pro",
    plan_forfeited_at: null,
    strike_count: 0,
    promo_paused_until: null,
    plan_live_at: null,
    first_ticket_honored_at: null,
  });
});
