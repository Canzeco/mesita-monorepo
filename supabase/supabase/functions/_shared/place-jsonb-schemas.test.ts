import { assert } from "jsr:@std/assert@1";
import { GoogleReviewsSchema, PlaceDetailsSchema, PopularTimesSchema } from "./place-jsonb-schemas.ts";

Deno.test("PlaceDetailsSchema: accepts a full valid details blob", () => {
  const r = PlaceDetailsSchema.parse({
    dining_style: "casual", dress_code: null, service_options: ["dine_in", "takeout"],
    reservations: "recommended", payment_methods: ["cash", "card"], parking: "street",
    amenities: ["wifi"], accessibility: ["wheelchair"], dietary_options: ["vegan"],
    good_for: ["groups"], languages: ["es", "en"], kid_friendly: true, pet_friendly: false,
  });
  assert(r.ok);
});

Deno.test("PlaceDetailsSchema: rejects an unknown key (e.g. a future LLM-invented field)", () => {
  const r = PlaceDetailsSchema.parse({
    dining_style: "casual", dress_code: null, service_options: [], reservations: null,
    payment_methods: [], parking: null, amenities: [], accessibility: [], dietary_options: [],
    good_for: [], languages: [], kid_friendly: null, pet_friendly: null,
    made_up_field: "the LLM hallucinated this",
  });
  assert(!r.ok);
});

Deno.test("PlaceDetailsSchema: accepts a partial object — every field may be absent (matches PROFILE_SCHEMA's lack of a `required` list)", () => {
  // Regression pin: enrich-synthesis.test.ts's pre-existing "happy path"
  // fixture pins exactly this shape (`{ dress_code: "casual" }`) as
  // currently-accepted behaviour this schema must not break.
  const r = PlaceDetailsSchema.parse({ dress_code: "casual" });
  assert(r.ok);
});

Deno.test("PlaceDetailsSchema: rejects a wrong-typed array field", () => {
  const base = {
    dining_style: null, dress_code: null, reservations: null, parking: null,
    kid_friendly: null, pet_friendly: null,
  };
  const r = PlaceDetailsSchema.parse({
    ...base, service_options: "casual, dine-in", // string instead of array — a real LLM failure mode
    payment_methods: [], amenities: [], accessibility: [], dietary_options: [], good_for: [], languages: [],
  });
  assert(!r.ok);
});

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
