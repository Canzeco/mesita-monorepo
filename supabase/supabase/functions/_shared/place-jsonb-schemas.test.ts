import { assert } from "jsr:@std/assert@1";
import { GoogleReviewsSchema, PopularTimesSchema } from "./place-jsonb-schemas.ts";

Deno.test("GoogleReviewsSchema: accepts a valid review array and null", () => {
  assert(GoogleReviewsSchema.parse([{ author: "A", rating: 5, quote: "great", date: "2026-01-01" }]).ok);
  assert(GoogleReviewsSchema.parse([]).ok);
});

Deno.test("GoogleReviewsSchema: rejects a review missing a field", () => {
  const r = GoogleReviewsSchema.parse([{ author: "A", rating: 5, quote: "great" }]);
  assert(!r.ok);
});

Deno.test("PopularTimesSchema: accepts and rejects", () => {
  assert(PopularTimesSchema.parse([{ day: "Mon", range: "12:00-15:00" }]).ok);
  assert(!PopularTimesSchema.parse([{ day: "Mon" }]).ok); // missing range
});
