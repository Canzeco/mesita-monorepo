import type { PlaceHit } from "@/app/(app)/manage-multiple/actions";
import { parseGooglePlaceIds } from "@/app/(app)/manage-multiple/google-place-ids";
import type { PlaceLite } from "@/lib/places-types";

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

/** One Google Text Search page — what a name in Find asks Google for, beside
 *  the catalog match (MESITA-2094). The bulk page's default is 50; one page
 *  is enough to find one place. */
export const GOOGLE_NAME_RESULTS = 20;

/** Whether Mesita already holds a Google result. Three witnesses, any one
 *  is enough: the discover EF's own google_place_id join, the catalog this
 *  page read, and the Adds this page made since — the EF's flag goes stale
 *  the moment Add succeeds, and is all-false when its Mesita lookup failed. */
export function googleOnMesita(
  place: PlaceLite,
  catalogGoogleIds: ReadonlySet<string>,
  added: { has(googleId: string): boolean },
): boolean {
  return place.existsInMesita || catalogGoogleIds.has(place.id) || added.has(place.id);
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function googleMapsPlaceHref(googlePlaceId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(googlePlaceId)}`;
}
