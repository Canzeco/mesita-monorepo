// Enriched — an Enrich run completed on this place (MESITA-2154).
//
// The SERVER states it: every consumer place payload carries `enriched`,
// set by `_shared/place-family-keys.ts` from `places.enriched_at`. This is
// the client's one reader of that fact — the map pins, the result dots and
// the Filters ring counts all ask here, so they cannot drift apart.
//
// The fallback for a payload without the boolean is `enriched_at` alone,
// never `content_state`: Create saves `content_state = 'ready'` because the
// profile can be shown, and a Created place is NOT enriched.

export function isEnrichedPlace(place: {
  enriched?: boolean | null;
  enriched_at?: string | null;
}): boolean {
  if (typeof place.enriched === "boolean") return place.enriched;
  return typeof place.enriched_at === "string" && place.enriched_at.trim() !== "";
}
