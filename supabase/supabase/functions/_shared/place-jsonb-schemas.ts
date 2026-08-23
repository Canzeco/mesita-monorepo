// _shared/place-jsonb-schemas.ts
import { array, bool, nullable, num, object, str, type Infer } from "./doc-schema.ts";

// Mirrors PROFILE_SCHEMA.properties.details, _shared/enrich-synthesis.ts
// verbatim — do not add or rename a field without updating that JSON-Schema
// too, or the LLM and the validator will disagree about what's legal.
//
// Every field is nullable(), including the array ones — MATCHING
// PROFILE_SCHEMA, which names no `required` list. Confirmed necessary, not
// just cautious: enrich-synthesis.test.ts's pre-existing "happy path"
// fixture pins `details: { dress_code: "casual" }` — an 11-of-13-keys-absent
// object — as a value the system accepts TODAY. array(str()) alone (no
// nullable) rejects an absent key, which would have silently dropped that
// exact currently-accepted shape the first time this schema went live — a
// real behaviour change caught by running the existing suite before wiring
// this in, not a hypothetical. nullable() only tolerates absence/null; a
// PRESENT wrong-typed value (a string where an array belongs — a real LLM
// failure mode) is still rejected exactly as before.
export const PlaceDetailsSchema = object({
  dining_style: nullable(str()),
  dress_code: nullable(str()),
  service_options: nullable(array(str())),
  reservations: nullable(str()),
  payment_methods: nullable(array(str())),
  parking: nullable(str()),
  amenities: nullable(array(str())),
  accessibility: nullable(array(str())),
  dietary_options: nullable(array(str())),
  good_for: nullable(array(str())),
  languages: nullable(array(str())),
  kid_friendly: nullable(bool()),
  pet_friendly: nullable(bool()),
});
export type PlaceDetails = Infer<typeof PlaceDetailsSchema>;

// Mirrors enrich-google-basics.ts's GoogleBasics.google_reviews field type
// exactly — non-nullable fields, the write site (mapGoogleReviews,
// enrich-google-review-snippets.ts) never emits a partial review object.
export const GoogleReviewSchema = object({
  author: str(),
  rating: num(),
  quote: str(),
  date: str(),
});
export const GoogleReviewsSchema = array(GoogleReviewSchema);
export type GoogleReviews = Infer<typeof GoogleReviewsSchema>;

// Mirrors PROFILE_SCHEMA.properties.popular_times, enrich-synthesis.ts.
export const PopularTimesEntrySchema = object({
  day: str(),
  range: str(),
});
export const PopularTimesSchema = array(PopularTimesEntrySchema);
export type PopularTimes = Infer<typeof PopularTimesSchema>;
