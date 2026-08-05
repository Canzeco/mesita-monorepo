// Unit tests for partner/lane derivation (MESITA-912).
//   deno test supabase/functions/_shared/partner-derivation.test.ts

import { assertEquals } from "jsr:@std/assert@1";
import { deriveListingType } from "./partner-derivation.ts";

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

Deno.test("deriveListingType: member + non-zero strategy → partner", () => {
  assertEquals(
    deriveListingType({ plan: "pro", rates: CONSERVATIVE, currentListingType: "web" }),
    "partner",
  );
});

Deno.test("deriveListingType: member on Zero → demote partner to web", () => {
  assertEquals(
    deriveListingType({ plan: "pro", rates: ZERO, currentListingType: "partner" }),
    "web",
  );
});

Deno.test("deriveListingType: member on Zero, already web → unchanged", () => {
  assertEquals(
    deriveListingType({ plan: "pro", rates: ZERO, currentListingType: "web" }),
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
