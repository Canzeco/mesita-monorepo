import { placePath, type PlaceSurface } from "@/lib/consumer-route-contract";

const RESERVED_PLACE_SEGMENTS = new Set([
  "discover",
  "explore",
  "swipe",
  "map",
  "search",
  "add",
  "saved",
  "place",
  "places",
  "place",
]);

export function toCanonicalPlaceHrefOrNull(
  idOrSlug: string,
  surface: PlaceSurface = "place",
): string | null {
  const normalized = idOrSlug.trim().toLowerCase();
  if (!normalized || RESERVED_PLACE_SEGMENTS.has(normalized)) return null;
  return placeHref(idOrSlug, surface);
}

export function placeHref(
  idOrSlug: string,
  surface: PlaceSurface = "place",
): string {
  return placePath(idOrSlug, surface);
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
