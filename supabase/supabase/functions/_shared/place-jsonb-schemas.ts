// _shared/place-jsonb-schemas.ts
import { array, num, object, str } from "./doc-schema.ts";

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

// The column's shape, one { day, range } per day (the guest card's Busiest
// line). Nothing writes it since MESITA-2420 retired the synthesis guess; a
// write that ever comes back is validated here.
export const PopularTimesEntrySchema = object({
  day: str(),
  range: str(),
});
export const PopularTimesSchema = array(PopularTimesEntrySchema);
