import { placePath } from "@/lib/consumer-route-contract";

// Every word that is (or was) a route segment, so a place slug can never mint
// a URL that collides with one. `swipe` and `catalog` stay after MESITA-1697
// renamed their segments — both are still live redirect sources, so a place
// slugged "swipe" would still land on a 308 rather than on itself.
const RESERVED_PLACE_SEGMENTS = new Set([
  "discover",
  "explore",
  "swipe",
  "scroll",
  "feed",
  "catalog",
  "chat",
  "favs",
  "map",
  "search",
  "add",
  "saved",
  "place",
  "places",
]);

export function toCanonicalPlaceHrefOrNull(idOrSlug: string): string | null {
  const normalized = idOrSlug.trim().toLowerCase();
  if (!normalized || RESERVED_PLACE_SEGMENTS.has(normalized)) return null;
  return placeHref(idOrSlug);
}

export function placeHref(idOrSlug: string): string {
  return placePath(idOrSlug);
}

// A Google-only card opens before Mesita holds the place (MESITA-2307): the
// route carries the Google Place ID under this prefix — the same prefix the
// catalog stub's id already wears — the screen builds the profile on the
// client and awaits the create, then replaces the URL with the real slug.
export const PENDING_PLACE_PREFIX = "g:";

export function pendingPlaceHref(googlePlaceId: string): string {
  return placeHref(`${PENDING_PLACE_PREFIX}${googlePlaceId}`);
}

/** The Google Place ID a pending place route carries, else null. */
export function pendingPlaceGid(idOrSlug: string): string | null {
  if (!idOrSlug.startsWith(PENDING_PLACE_PREFIX)) return null;
  const gid = idOrSlug.slice(PENDING_PLACE_PREFIX.length).trim();
  return gid ? gid : null;
}

// Fallback href for a place-detail route whose place resolved to null
// (consumer-web-get-place 404 — a deleted / reset-away row, a stale
// localStorage favorite, an old bookmark).
//
// The bounce itself is deliberate: there's no error boundary, so landing the
// guest somewhere real beats a 500. What was missing is the REASON — the
// `gone` param carries the dead id to <PlaceGoneNotice />, which states what
// happened and prunes the id so the same tile can't bounce us twice.
export function placeGoneHref(fallback: string, idOrSlug: string): string {
  return `${fallback}?gone=${encodeURIComponent(idOrSlug)}`;
}
