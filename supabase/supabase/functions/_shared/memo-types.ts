// memo-types.ts — the public place-card contract shared across Memo's engine.
//
// Extracted here (from consumer-web-ask-memo/memo-google-text-search.ts) so both
// the consumer concierge EF and the admin playground EF share ONE definition of
// the Prediction card. memo-google-text-search.ts re-exports these for its own
// local importers, so nothing downstream had to change.

export type PredictionStatus =
  | "not_in_mesita"
  | "web_listed"
  | "verified_partner_other"
  | "verified_partner_self";

// Mirrors the consumer PlacePrediction contract (see consumer-web-suggest-
// places) so the same PredictionRow renders these with no client changes.
// `rating`/`ratingCount` are Memo extras the client may ignore.
export type Prediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  status: PredictionStatus;
  mesitaId?: string;
  mesitaSlug?: string;
  // Memo extra: Google's live open/closed state, used to demote closed spots
  // at the current local hour (null = unknown, don't penalise).
  rating?: number | null;
  ratingCount?: number | null;
  openNow?: boolean | null;
};
