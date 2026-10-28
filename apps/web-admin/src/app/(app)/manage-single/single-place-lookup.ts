import { parseGooglePlaceIds } from "@/app/(app)/manage-multiple/google-place-ids";

// Single Place takes ONE box and reads it two ways: a Google Place ID token
// looks the place up by its identity spine (and, when it is not on Mesita,
// is what Create mints from); anything else is a name Google searches
// (MESITA-2896: never the Mesita name, MESITA-2907). The bulk page's parser decides what counts as a Place ID, so the
// two pages can never disagree on a token.

export type Lookup =
  | { kind: "empty" }
  | { kind: "google_place_id"; id: string }
  | { kind: "name"; query: string };

export function classifyLookup(raw: string): Lookup {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  const ids = parseGooglePlaceIds(text, 1);
  // A lone token that parses as a Place ID is one; "Café ChIJ…" is a name.
  if (ids.length === 1 && !/\s/.test(text)) return { kind: "google_place_id", id: ids[0] };
  return { kind: "name", query: text };
}

/** One Google Text Search page — what a name in Find asks Google for
 *  (MESITA-2094). The bulk page's default is 50; one page
 *  is enough to find one place. */
export const GOOGLE_NAME_RESULTS = 20;

export function googleMapsPlaceHref(googlePlaceId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(googlePlaceId)}`;
}
