// Enriched — an Enrich run completed on this place (MESITA-2154).
//
// The server states it: admin-web-search-places and admin-web-get-overview
// ship `enriched` from `_shared/place-state.ts` `isPlaceEnriched`, which reads
// `places.enriched_at`. This is the console's one reader — Status on the
// Admin tab and the Multiple Places "Enriched" fact both ask here.
//
// NOT the Crenup high-water: "N of 8, stopped at …" is the completeness
// meter, never the yes/no. And NOT `content_state`: Create saves 'ready'
// because the profile can be shown; a Created place is not enriched.
// The fallback for a payload without the boolean is `enriched_at` alone.

export function isEnrichedPlace(place: {
  enriched?: unknown;
  enriched_at?: unknown;
}): boolean {
  if (typeof place.enriched === "boolean") return place.enriched;
  return typeof place.enriched_at === "string" && place.enriched_at.trim() !== "";
}

/** The two enrichment states. A live run is enriching, and not enriched,
 *  until the one finished write lands. */
export function enrichmentView(place: {
  content_state?: unknown;
  enriched?: unknown;
  enriched_at?: unknown;
}): { enriching: boolean; enriched: boolean } {
  const enriching = place.content_state === "generating";
  return { enriching, enriched: enriching ? false : isEnrichedPlace(place) };
}
