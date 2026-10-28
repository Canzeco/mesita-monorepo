import { assert, assertEquals } from "jsr:@std/assert@1";
import { omitReviewsTileColumns } from "./reviews-state.ts";

Deno.test("omitReviewsTileColumns drops the four tile facts and nothing else", () => {
  const out = omitReviewsTileColumns({
    google_stars_overall: 4.2,
    google_review_count: 10,
    instagram_followers_count: 5,
    facebook_followers: 7,
    google_reviews: [{ text: "kept" }],
    phone: "+52",
  });
  assertEquals(out.phone, "+52");
  assertEquals(out.google_reviews, [{ text: "kept" }]);
  assert(!("google_stars_overall" in out));
  assert(!("google_review_count" in out));
  assert(!("instagram_followers_count" in out));
  assert(!("facebook_followers" in out));
});
