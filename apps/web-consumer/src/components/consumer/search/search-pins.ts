// The pin tone is the coloured point, on the results rows AND the map pins.
// THE LAW, two nested sets (Pato, 2026-09-05):
//
//   enriched  red    we wrote a profile
//   unlisted  gray   everything else — Google rows AND our own stubs
//
// These are the two sets the Filters sheet lists, not a separate palette:
// Google Places ⊃ Mesita Enriched Places. A set the guest can pick has to
// be the same set the colour promises.
//
// Red is EARNED. The bucket is named `enriched`, not "listed": listed means
// "we have a row", which a Created stub also satisfies, and a place with
// nothing to show must not wear the colour that promises a profile. The
// gray one is `unlisted` rather than `google`, because it holds our own
// stubs too.
//
// The SERVER states `enriched` (`_shared/place-family-keys.ts`). Nothing
// here re-derives it from raw columns except as a fallback for a payload
// that predates the field. Hexes live in lib/map-defaults.ts; a selected
// pin keeps its tone fill and gains a black ring.

import {
  MAP_ENRICHED_PIN_COLOR,
  MAP_GOOGLE_PIN_COLOR,
  MAP_PIN_STROKE_COLOR,
  MAP_SELECTED_PIN_COLOR,
} from "@/lib/map-defaults";

export type PinTone = "enriched" | "unlisted";

/**
 * Did we write a profile? The server's `enriched` is the answer. The column
 * pair is only a fallback for a payload minted before the field existed:
 * `content_state = 'ready'` OR a stamped `enriched_at`, never one alone —
 * 27% of the live catalog is ready with a null `enriched_at` (measured
 * 2026-08-29), so an `enriched_at`-only test would grey a quarter of it.
 */
export function isEnrichedPlace(place: {
  enriched?: boolean | null;
  content_state?: string | null;
  enriched_at?: string | null;
}): boolean {
  if (typeof place.enriched === "boolean") return place.enriched;
  return place.content_state === "ready" || Boolean(place.enriched_at);
}

/** On Mesita per EF — mesitaId/slug win over a stale not_in_mesita state. */
export function predictionOnMesita(item: {
  state?: string | null;
  mesitaId?: string | null;
  mesitaSlug?: string | null;
}): boolean {
  if (item.mesitaId || item.mesitaSlug) return true;
  return item.state !== "not_in_mesita";
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

const TONE_COLORS: Record<PinTone, string> = {
  enriched: MAP_ENRICHED_PIN_COLOR,
  unlisted: MAP_GOOGLE_PIN_COLOR,
};

/**
 * A Location row's accessible label names the ENTITY — "City", "State" —
 * never the absence of a profile: "No profile yet" is a place answer, and
 * a Location was never asked the profile question (MESITA-1404). The
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
export function predictionPinTone(item: {
  state?: string | null;
  enriched?: boolean | null;
  mesitaId?: string | null;
  mesitaSlug?: string | null;
}): PinTone {
  if (!predictionOnMesita(item)) return "unlisted";
  return item.enriched === true ? "enriched" : "unlisted";
}

export function pinToneColor(tone: PinTone): string {
  return TONE_COLORS[tone];
}

/** Selection never changes the fill — the ring says selected. */
export function pinFillColor(tone: PinTone): string {
  return pinToneColor(tone);
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
type OverlayPinAction =
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

/** Map/catalog rows: a Google stub is gray, and so is a Mesita row nobody
 *  has enriched yet. */
export function placePinTone(place: {
  googleOnly?: boolean;
  from_google?: boolean;
  enriched?: boolean | null;
  content_state?: string | null;
  enriched_at?: string | null;
}): PinTone {
  if (place.googleOnly || place.from_google) return "unlisted";
  return isEnrichedPlace(place) ? "enriched" : "unlisted";
}

/** Live-search overlay pins. Catalog is coords only — tone follows the EF row
 *  so the list dot and the map pin cannot disagree. Empty coords → null so
 *  the map keeps catalog markers instead of blanking. */
type SearchPinPrediction = {
  placeId: string;
  mainText: string;
  state?: string | null;
  /** The server's `enriched`. Required for the pin to reach red: a
   *  prediction without it stays gray. */
  enriched?: boolean | null;
  /** Word's second entity — a Location is a camera destination, never a pin. */
  kind?: "place" | "location";
  mesitaId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

type SearchPinPlace = {
  id: string;
  lat?: number | null;
  lng?: number | null;
};

type BuiltSearchPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  tone: PinTone;
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
      tone: predictionPinTone(prediction),
    });
  }
  return pins.length > 0 ? pins : null;
}
