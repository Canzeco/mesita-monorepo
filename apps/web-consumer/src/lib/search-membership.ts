// Membership is the colored point, on the results rows AND the map pins.
// THE LAW, checked in this order (Pato, 2026-08-29):
//
//   partner   yellow   the place PAYS
//   enriched  red      we wrote a profile
//   unlisted  gray     everything else — Google rows AND our own stubs
//
// Red is EARNED. "listed" used to name the red bucket and that word is
// exactly how it drifted: listed means "we have a row", which a Created
// stub also satisfies, so a place with nothing to show wore the colour
// that promises a profile. The bucket is named `enriched` now, and the
// gray one is `unlisted` rather than `google`, because it holds our own
// stubs too.
//
// The SERVER states `enriched` (`_shared/place-family-keys.ts`), the same
// way it already states `partner` and `promoting`. Nothing here re-derives
// it from raw columns except as a fallback for a payload that predates the
// field. Hexes live in lib/map-defaults.ts; a selected pin keeps the
// membership fill and gains a black ring.

import {
  MAP_ENRICHED_PIN_COLOR,
  MAP_GOOGLE_PIN_COLOR,
  MAP_PARTNER_PIN_COLOR,
  MAP_PIN_STROKE_COLOR,
  MAP_SELECTED_PIN_COLOR,
} from "@/lib/map-defaults";

export type MembershipTone = "partner" | "enriched" | "unlisted";

/**
 * Did we write a profile? The server's `enriched` is the answer. The column
 * pair is only a fallback for a payload minted before the field existed:
 * `content_status = 'ready'` OR a stamped `enriched_at`, never one alone —
 * 27% of the live catalog is ready with a null `enriched_at` (measured
 * 2026-08-29), so an `enriched_at`-only test would grey a quarter of it.
 */
export function isEnrichedPlace(place: {
  enriched?: boolean | null;
  content_status?: string | null;
  enriched_at?: string | null;
}): boolean {
  if (typeof place.enriched === "boolean") return place.enriched;
  return place.content_status === "ready" || Boolean(place.enriched_at);
}

/** On Mesita per EF — mesitaId/slug win over a stale not_in_mesita status. */
export function predictionOnMesita(item: {
  status?: string | null;
  mesitaId?: string | null;
  mesitaSlug?: string | null;
}): boolean {
  if (item.mesitaId || item.mesitaSlug) return true;
  return item.status !== "not_in_mesita";
}

/** Google Nearby stub that was added — real Mesita id, not a g: prefix. */
export function catalogPlaceOnMesita(place: {
  id: string;
  googleOnly?: boolean;
  from_google?: boolean;
}): boolean {
  if (!place.googleOnly && !place.from_google) return true;
  return !place.id.startsWith("g:");
}

const MEMBERSHIP_COLORS: Record<MembershipTone, string> = {
  partner: MAP_PARTNER_PIN_COLOR,
  enriched: MAP_ENRICHED_PIN_COLOR,
  unlisted: MAP_GOOGLE_PIN_COLOR,
};

/**
 * A Location row's accessible label names the ENTITY — "City", "State" —
 * never the absence of a profile: "No profile yet" is a venue answer, and
 * a Location was never asked the membership question (MESITA-1404). The
 * visible mark is the location icon; this is its spoken half.
 */
export function locationTypeLabel(locationType?: string | null): string {
  switch (locationType) {
    case "locality":
      return "City";
    case "administrative_area_level_1":
      return "State";
    case "administrative_area_level_2":
      return "Region";
    case "country":
      return "Country";
    case "postal_code":
      return "Postal code";
    case "neighborhood":
    case "sublocality":
    case "sublocality_level_1":
      return "Neighborhood";
    default:
      return "Location";
  }
}

/** Name-lane rows. No column fallback on this wire, so a payload without
 *  `enriched` reads as gray: understating beats promising a profile that
 *  is not there. */
export function membershipTone(item: {
  status?: string | null;
  partner?: boolean | null;
  enriched?: boolean | null;
  mesitaId?: string | null;
  mesitaSlug?: string | null;
}): MembershipTone {
  if (!predictionOnMesita(item)) return "unlisted";
  if (item.partner) return "partner";
  return item.enriched === true ? "enriched" : "unlisted";
}

export function membershipColor(tone: MembershipTone): string {
  return MEMBERSHIP_COLORS[tone];
}

export function pinFillColor(tone: MembershipTone, _selected = false): string {
  return membershipColor(tone);
}

export function pinStrokeColor(selected: boolean): string {
  return selected ? MAP_SELECTED_PIN_COLOR : MAP_PIN_STROKE_COLOR;
}

/** First tap selects; a later tap on the same pin opens. Not a timed dblclick. */
export function pinGesture(
  selectedId: string | null,
  pinId: string,
): "select" | "open" {
  return selectedId === pinId ? "open" : "select";
}

/** Overlay map-pin tap. First tap holds (black ring); later tap opens.
 *  Overlay-only Mesita (not in the catalog snapshot) never opens on select —
 *  stash the prediction and keep the overlay. Google stash is the same hold. */
export type OverlayPinAction =
  | "select-google"
  | "select-mesita-catalog"
  | "select-mesita-overlay"
  | "open-google"
  | "open-catalog"
  | "open-mesita-slug"
  | "noop";

export function overlayPinDecision(input: {
  selectedId: string | null;
  pinId: string;
  googleOnly: boolean;
  inCatalog: boolean;
  hasOverlay: boolean;
}): OverlayPinAction {
  const gesture = pinGesture(input.selectedId, input.pinId);
  if (gesture === "open") {
    if (input.googleOnly) return "open-google";
    if (input.inCatalog) return "open-catalog";
    if (input.hasOverlay) return "open-mesita-slug";
    return "noop";
  }
  if (input.googleOnly) return "select-google";
  if (input.inCatalog) return "select-mesita-catalog";
  if (input.hasOverlay) return "select-mesita-overlay";
  return "noop";
}

/** Map/catalog rows. The `plan` fallback that used to live here was dead:
 *  `plan` is in BUSINESS_PRIVATE_PLACE_KEYS and deleted before the wire, so
 *  a consumer payload never carries it. `partner` is the server's boolean. */
export function placeMembershipTone(place: {
  partner?: boolean | null;
  googleOnly?: boolean;
  from_google?: boolean;
  enriched?: boolean | null;
  content_status?: string | null;
  enriched_at?: string | null;
}): MembershipTone {
  if (place.googleOnly || place.from_google) return "unlisted";
  if (place.partner === true) return "partner";
  return isEnrichedPlace(place) ? "enriched" : "unlisted";
}

/** Live-search overlay pins. Catalog is coords only — tone follows the EF row
 *  so the list dot and the map pin cannot disagree. Empty coords → null so
 *  the map keeps catalog markers instead of blanking. */
export type SearchPinPrediction = {
  placeId: string;
  mainText: string;
  status?: string | null;
  partner?: boolean | null;
  /** Word's second entity — a Location is a camera destination, never a pin. */
  kind?: "place" | "location";
  mesitaId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type SearchPinPlace = {
  id: string;
  lat?: number | null;
  lng?: number | null;
};

export type BuiltSearchPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  tone: MembershipTone;
};

export function buildSearchMapPins(
  predictions: SearchPinPrediction[],
  catalog: SearchPinPlace[],
): BuiltSearchPin[] | null {
  if (predictions.length === 0) return null;
  const byId = new Map(catalog.map((place) => [place.id, place]));
  const pins: BuiltSearchPin[] = [];
  for (const prediction of predictions) {
    // A Location is a camera destination, never a pin (MESITA-1404) — a
    // marker would claim a point for an entity that IS an area.
    if (prediction.kind === "location") continue;
    const hit = prediction.mesitaId ? byId.get(prediction.mesitaId) : undefined;
    const lat = prediction.lat ?? hit?.lat ?? null;
    const lng = prediction.lng ?? hit?.lng ?? null;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    pins.push({
      id: prediction.mesitaId ?? prediction.placeId,
      lat,
      lng,
      title: prediction.mainText,
      tone: membershipTone(prediction),
    });
  }
  return pins.length > 0 ? pins : null;
}
