// memo-types.ts — the public place-card contract shared across Memo's engine.
//
// Extracted here so the consumer concierge EF and the admin playground EF
// share ONE definition of the Prediction card. The old local re-export in
// consumer-web-ask-memo/memo-google-text-search.ts is gone; nothing imported it.

export type PredictionState =
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
  state: PredictionState;
  mesitaId?: string;
  mesitaSlug?: string;
  // Memo extra: Google's live open/closed state, used to demote closed spots
  // at the current local hour (null = unknown, don't penalise).
  rating?: number | null;
  ratingCount?: number | null;
  openNow?: boolean | null;
};
