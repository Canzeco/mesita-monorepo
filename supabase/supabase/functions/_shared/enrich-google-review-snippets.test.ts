import { assertEquals } from "jsr:@std/assert@1";
import { googleReviewListFromScrape, persistGoogleReviews } from "./enrich-google-review-snippets.ts";

Deno.test("persistGoogleReviews slims the Apify scrape onto the write-door shape", () => {
  assertEquals(
    persistGoogleReviews([
      { author: "Ana", rating: 5, text: "great", published: "2026-01-01" },
    ]),
    [{ author: "Ana", rating: 5, quote: "great", date: "2026-01-01" }],
  );
});

Deno.test("persistGoogleReviews keeps an already-slender snippet", () => {
  const row = { author: "Bo", rating: 4, quote: "ok", date: "a week ago" };
  assertEquals(persistGoogleReviews([row]), [row]);
});

Deno.test("persistGoogleReviews drops a review with no quote", () => {
  assertEquals(persistGoogleReviews([{ author: "X", rating: 5, text: "  " }]), null);
});

Deno.test("a failed scrape does not become an empty review list", () => {
  assertEquals(googleReviewListFromScrape([], "client timeout"), {
    ok: false,
    error: "client timeout",
  });
  assertEquals(
    googleReviewListFromScrape(
      [{ author: "Ana", rating: 5, text: "great", published: "2026-01-01" }],
      null,
    ),
    { ok: true, list: [{ author: "Ana", rating: 5, quote: "great", date: "2026-01-01" }] },
  );
});
