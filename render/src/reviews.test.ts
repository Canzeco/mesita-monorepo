import assert from "node:assert/strict";
import test from "node:test";
import { fetchApifyGoogleReviews, GOOGLE_REVIEWS_MAX, reviewsFromApifyPlace } from "./reviews.ts";

test("a place's reviews become the stored shape, newest first, one hundred at most", () => {
  const reviews = Array.from({ length: 120 }, (_, i) => ({
    name: i === 0 ? "" : `Guest ${i}`,
    stars: i === 3 ? "4" : 5,
    text: i === 2 ? "  " : `Review ${i}`,
    publishedAtDate: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
  }));
  reviews[4] = { name: "Ana", stars: 5, text: "Excelente", publishedAtDate: "2026-10-01" };
  const mapped = reviewsFromApifyPlace({ reviews });
  assert.equal(mapped.length, GOOGLE_REVIEWS_MAX);
  assert.deepEqual(mapped[0], {
    author: "Google reviewer",
    rating: 5,
    quote: "Review 0",
    date: "2026-10-01",
  });
  assert.equal(mapped.some((review) => review.quote === "Review 2"), false);
  assert.equal(mapped[2].rating, 4);
  assert.equal(mapped[3].author, "Ana");
  assert.equal(mapped[3].quote, "Excelente");
});

test("text and published aliases still count", () => {
  assert.deepEqual(reviewsFromApifyPlace({
    reviews: [{ reviewerName: "Luis", rating: 9, reviewText: "Bien", publishAt: "ayer" }],
  }), [{ author: "Luis", rating: 5, quote: "Bien", date: "ayer" }]);
  assert.deepEqual(reviewsFromApifyPlace({ reviews: [{ text: "" }] }), []);
  assert.deepEqual(reviewsFromApifyPlace({}), []);
});

test("the scrape asks Apify for one hundred newest reviews and no images", async () => {
  let sent: Record<string, unknown> = {};
  const listed = await fetchApifyGoogleReviews({
    googlePlaceId: "ChIJ-test",
    apifyKey: "apify-test",
    fetchImpl: async (input, init) => {
      assert.match(String(input), /compass~crawler-google-places/);
      sent = JSON.parse(String(init?.body ?? "{}"));
      return Response.json([{
        reviews: [{ name: "Carlos", stars: 5, text: "Muy bueno", publishedAtDate: "2026-10-14" }],
      }]);
    },
  });
  assert.deepEqual(sent, {
    placeIds: ["ChIJ-test"],
    maxReviews: 100,
    maxImages: 0,
    language: "es",
    reviewsSort: "newest",
    reviewsPersonalData: true,
  });
  assert.deepEqual(listed, [{
    author: "Carlos",
    rating: 5,
    quote: "Muy bueno",
    date: "2026-10-14",
  }]);
});

test("a failed scrape throws and does not invent a list", async () => {
  await assert.rejects(
    () => fetchApifyGoogleReviews({ googlePlaceId: "ChIJ-test", apifyKey: "" }),
    /APIFY_KEY/,
  );
  await assert.rejects(
    () => fetchApifyGoogleReviews({
      googlePlaceId: "ChIJ-test",
      apifyKey: "apify-test",
      fetchImpl: async () => new Response("outstanding invoices", { status: 403 }),
    }),
    /403/,
  );
});
