import { placeRowToDetail } from "@/lib/adapters/place-to-detail";
import type { PlaceDetail } from "@/lib/mock/place";
import { isMockPlace, scrollMockPlaces } from "@/lib/mock/scroll-places";

// A SAMPLE PLACE HAS A PROFILE (Pato, MESITA-2142: "also bring the profile
// modal"). While SCROLL_USES_MOCK feeds Swipe and Scroll the twelve sample
// places, tapping one opens the same slide-over profile a real place does,
// built from the same row the card shows. Nothing is fetched: a `mock-` id
// never reaches consumer-web-get-place. Reserve, Save and Share on a sample
// stay inert (the card's toast, the place page's own guards).

export function mockPlaceDetail(idOrSlug: string): PlaceDetail | null {
  const key = idOrSlug.trim().toLowerCase();
  const row = scrollMockPlaces().find(
    (p) => p.id === key || (isMockPlace({ id: key }) && p.slug === key),
  );
  if (!row) return null;
  const detail = placeRowToDetail({
    ...row,
    // The sample is a finished profile, so it shows Overview, not Enrich.
    is_enriched: true,
    enriched_at: row.created_at,
    content_state: "ready",
    long_description: row.pitch,
    // The profile reads the place_profiles column names; the card reads the
    // lean Place's. Same numbers, two spellings.
    google_stars_overall: row.google_rating,
    google_review_count: row.google_count,
  } as unknown as Record<string, unknown>);
  // The sample states its open state outright; it has no hours to derive it.
  return {
    ...detail,
    open_now: row.open_now ?? false,
    opens_at: row.opens_at ?? "",
    closes_at: row.closes_at ?? detail.closes_at,
  };
}
