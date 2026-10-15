import { assertEquals } from "jsr:@std/assert@1";
import { emptyReviewFound, reviewFoundFromRow } from "./review-found.ts";

Deno.test("emptyReviewFound is all false", () => {
  assertEquals(emptyReviewFound(), {
    google_found: false,
    instagram_found: false,
    facebook_found: false,
  });
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
