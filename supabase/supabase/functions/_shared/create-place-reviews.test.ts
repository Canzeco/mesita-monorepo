import { assertEquals } from "jsr:@std/assert@1";
import { googleReviewsAtCreate } from "./create-place.ts";
import { omitReviewsTileColumns } from "./reviews-state.ts";

// A new profile reads its Google stars and review count at once: the
// Details call that minted the row is the first Reviews verification
// (MESITA-2306). Instagram and Facebook counts stay the verifier's.

Deno.test("create stores Google's stars and review count under a true found flag", () => {
  assertEquals(
    googleReviewsAtCreate({ google_stars_overall: 4.5, google_review_count: 120 }),
    { google_found: true, google_stars_overall: 4.5, google_review_count: 120 },
  );
});

Deno.test("a listing Google rates nothing stores nulls, still found", () => {
  assertEquals(
    googleReviewsAtCreate({ google_stars_overall: null, google_review_count: null }),
    { google_found: true, google_stars_overall: null, google_review_count: null },
  );
  // Out-of-range or non-integer numbers never reach the row (the CHECKs).
  assertEquals(
    googleReviewsAtCreate({ google_stars_overall: 7, google_review_count: 1.5 }),
    { google_found: true, google_stars_overall: null, google_review_count: null },
  );
});

Deno.test("the create payload keeps Google's numbers and no social count", () => {
  const basics = {
    google_stars_overall: 4.2,
    google_review_count: 31,
    instagram_followers_count: 9,
    facebook_followers: 3,
    phone: "+52",
  };
  const payload: Record<string, unknown> = {
    ...omitReviewsTileColumns({ ...basics }),
    ...googleReviewsAtCreate(basics),
  };
  assertEquals(payload.google_stars_overall, 4.2);
  assertEquals(payload.google_review_count, 31);
  assertEquals(payload.google_found, true);
  assertEquals(payload.phone, "+52");
  assertEquals("instagram_followers_count" in payload, false);
  assertEquals("facebook_followers" in payload, false);
});

Deno.test("createMinimalPlace spreads the Google numbers back after the strip", async () => {
  const src = await Deno.readTextFile(new URL("./create-place.ts", import.meta.url));
  const strip = src.indexOf("...omitReviewsTileColumns({ ...basicsRes.basics })");
  const restore = src.indexOf("...googleReviewsAtCreate(basicsRes.basics)");
  assertEquals(strip > 0 && restore > strip, true);
});
