import type { PlaceHit } from "@/app/(app)/manage-multiple/actions";
import { parseGooglePlaceIds } from "@/app/(app)/manage-multiple/google-place-ids";

// Single Place takes ONE box and reads it two ways: a Google Place ID token
// looks the place up by its identity spine (and, when it is not on Mesita,
// is what Create mints from); anything else is a name search over the
// catalog. The bulk page's parser decides what counts as a Place ID, so the
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

/** Case- and accent-insensitive substring match over the names and the
 *  address, so "cafe" finds "Café" and a street finds the place on it. */
export function matchesPlace(hit: PlaceHit, query: string): boolean {
  const q = fold(query);
  if (!q) return false;
  return [hit.name, hit.google_name, hit.address, hit.slug].some(
    (v) => typeof v === "string" && fold(v).includes(q),
  );
}

export const MAX_NAME_MATCHES = 20;

export function filterCatalog(places: PlaceHit[], query: string): PlaceHit[] {
  const out: PlaceHit[] = [];
  for (const hit of places) {
    if (matchesPlace(hit, query)) {
      out.push(hit);
      if (out.length >= MAX_NAME_MATCHES) break;
    }
  }
  return out;
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** The business console's editor for this place — a super-admin opens any
 *  place there (business-web-get-overview's super-admin branch), which is
 *  why admin keeps no second editor. */
export function businessConsolePlaceHref(placeId: string): string {
  return `https://business.mesita.ai/places/${encodeURIComponent(placeId)}`;
}

export function googleMapsPlaceHref(googlePlaceId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(googlePlaceId)}`;
}
