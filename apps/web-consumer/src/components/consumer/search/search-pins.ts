// The pin tone is the coloured point, on the results rows AND the map pins.
// THE LAW, three nested sets (Pato, 2026-10-12, MESITA-2158):
//
//   enriched  red    an Enrich run completed (`enriched_at` set): Mesita Selected
//   mesita    gray   our own place, not enriched yet (a Created place)
//   google    gray   a Google row Mesita does not hold
//
// THREE COLOURS ON THE MAP AND NO MORE (Pato, 2026-10-18, MESITA-2316): red
// is Mesita Selected, blue is the guest's own location, gray is everything
// else — a Created profile wears Google's gray until an Enrich run
// completes; the brand-ink middle tone is gone. The `mesita` tone survives
// as a FACT, not a colour: its row says "Basic Mesita profile" and opens its
// own profile, while a Google-only row opens through the opening screen.
//
// The sets still nest — Google Places ⊃ Mesita Places ⊃ Mesita Enriched
// Places — and each tone is the NARROWEST ring the place sits in. The
// Filters sheet names only two of them (Google Places · Mesita Selected,
// MESITA-2298): a tone is the colour's promise about the row, the scope is
// the set the guest asked for (`placeSearchScope`).
//
// Red is EARNED. The bucket is named `enriched`, not "listed": listed means
// "we have a row", which a Created place also satisfies, and a basic
// Created profile must not wear the colour that promises an enriched one.
//
// The SERVER states `enriched` (`_shared/place-family-keys.ts`): an Enrich
// run completed, i.e. `places.enriched_at` is set (MESITA-2154). Nothing
// here re-derives it from raw columns except `enriched_at` as a fallback for
// a payload that predates the field — never `content_state`, which a
// Created place carries as 'ready'. The one client reader is
// lib/place-enriched.ts. Hexes live in lib/map-defaults.ts; a selected pin
// trades its tone for ink with a white ring (MESITA-2488).

import {
  MAP_ENRICHED_PIN_COLOR,
  MAP_GOOGLE_PIN_COLOR,
  MAP_PIN_STROKE_COLOR,
  MAP_PIN_STROKE_WEIGHT,
  MAP_SELECTED_PIN_COLOR,
  MAP_SELECTED_PIN_STROKE_COLOR,
  MAP_SELECTED_PIN_STROKE_WEIGHT,
} from "@/lib/map-defaults";
import { isEnrichedPlace } from "@/lib/place-enriched";

/** The tone IS the narrowest ring; only `enriched` draws red. */
export type PinTone = "enriched" | "mesita" | "google";

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
  // A Created profile is gray like a Google row until it is enriched.
  mesita: MAP_GOOGLE_PIN_COLOR,
  google: MAP_GOOGLE_PIN_COLOR,
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

/** Name-lane rows. No column fallback on this wire, so a Mesita row
 *  without `enriched` reads as `mesita` (gray), never red: understating
 *  beats promising a profile that is not there. Off Mesita is gray too. */
export function predictionPinTone(item: {
  state?: string | null;
  enriched?: boolean | null;
  mesitaId?: string | null;
  mesitaSlug?: string | null;
}): PinTone {
  if (!predictionOnMesita(item)) return "google";
  return item.enriched === true ? "enriched" : "mesita";
}

export function pinToneColor(tone: PinTone): string {
  return TONE_COLORS[tone];
}

/** Selection CHANGES the colour (MESITA-2488): the tone gives way to ink. */
export function pinFillColor(tone: PinTone, selected = false): string {
  return selected ? MAP_SELECTED_PIN_COLOR : pinToneColor(tone);
}

export function pinStrokeColor(selected: boolean): string {
  return selected ? MAP_SELECTED_PIN_STROKE_COLOR : MAP_PIN_STROKE_COLOR;
}

/** Selected draws its (white) ring thicker; the disk never grows. */
export function pinStrokeWeight(selected: boolean): number {
  return selected ? MAP_SELECTED_PIN_STROKE_WEIGHT : MAP_PIN_STROKE_WEIGHT;
}

export type PinGesture = "select" | "fly" | "open";

/**
 * THREE TAPS ON A PIN (Pato, MESITA-2488): the first selects (the pin turns
 * ink), the second flies the camera there (an animated pan that sets the
 * place under the sight, zoom untouched), the third opens it. A second tap
 * that finds the place already under the sight opens at once — a fly that
 * would not move is a dead tap. Counted taps, never a timed dblclick.
 */
export function pinGesture(
  selectedId: string | null,
  pinId: string,
  stage: { arrivedId: string | null; atSight: boolean },
): PinGesture {
  if (selectedId !== pinId) return "select";
  if (stage.arrivedId === pinId || stage.atSight) return "open";
  return "fly";
}

/** Overlay map-pin tap. First tap holds (ink pin); second flies; third opens.
 *  Overlay-only Mesita (not in the catalog snapshot) never opens on select —
 *  stash the prediction and keep the overlay. Google stash is the same hold. */
type OverlayPinAction =
  | "fly"
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
  arrivedId: string | null;
  atSight: boolean;
}): OverlayPinAction {
  const known = input.googleOnly || input.inCatalog || input.hasOverlay;
  const gesture = pinGesture(input.selectedId, input.pinId, input);
  if (gesture === "fly") return known ? "fly" : "noop";
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

/** Map/catalog rows: a Google stub is gray, a Mesita row nobody has
 *  enriched yet is gray too (its own tone, `mesita`), an enriched one red.
 *  Same rule as the ring counts (`placeSearchScope`), so a dot and its ring
 *  cannot disagree. */
export function placePinTone(place: {
  googleOnly?: boolean;
  from_google?: boolean;
  enriched?: boolean | null;
  enriched_at?: string | null;
}): PinTone {
  if (place.googleOnly || place.from_google) return "google";
  return isEnrichedPlace(place) ? "enriched" : "mesita";
}

/** Live-search overlay pins. Catalog is coords only — tone follows the EF row
 *  so the list dot and the map pin cannot disagree. Empty coords → null so
 *  the map keeps catalog markers instead of blanking. */
type SearchPinPrediction = {
  placeId: string;
  mainText: string;
  state?: string | null;
  /** The server's `enriched`. Required for the pin to reach red: a Mesita
   *  prediction without it stays ink. */
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
