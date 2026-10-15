import { assertEquals } from "jsr:@std/assert@1";
import {
  emptyReviewFound,
  mergeReviewFoundFlags,
  reviewFoundFromRow,
} from "./review-found.ts";

Deno.test("emptyReviewFound is all false", () => {
  assertEquals(emptyReviewFound(), {
    google_found: false,
    instagram_found: false,
    facebook_found: false,
  });
});

Deno.test("mergeReviewFoundFlags keeps prev unless patch sends a boolean", () => {
  assertEquals(
    mergeReviewFoundFlags(
      { google_found: true, instagram_found: false, facebook_found: true },
      { instagram_found: true, google_found: "yes" },
    ),
    { google_found: true, instagram_found: true, facebook_found: true },
  );
});

Deno.test("reviewFoundFromRow only treats true as found", () => {
  assertEquals(
    reviewFoundFromRow({
      google_found: true,
      instagram_found: "yes",
      facebook_found: null,
    }),
    { google_found: true, instagram_found: false, facebook_found: false },
  );
});
