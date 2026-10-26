// The pin tone is the coloured point, on the results rows AND the map pins.
// THE LAW, three nested sets (Pato, 2026-10-12, MESITA-2158):
//
//   selected  red    Mesita Selected — the operator's own mark, `places.selected`
//   mesita    gray   our own place without the mark
//   google    gray   a Google row Mesita does not hold
//
// THREE COLOURS ON THE MAP AND NO MORE (Pato, 2026-10-18, MESITA-2316): red
// is Mesita Selected, blue is the guest's own location, gray is everything
// else; the brand-ink middle tone is gone. The `mesita` tone survives as a
// FACT, not a colour: its row says "Basic Mesita profile" and opens its own
// profile, while a Google-only row opens through the opening screen.
//
// The sets still nest — Google Places ⊃ Mesita Places ⊃ Mesita Selected
// Places — and each tone is the NARROWEST ring the place sits in. The
// Filters sheet names only two of them (Google Places · Mesita Selected,
// MESITA-2298): a tone is the colour's promise about the row, the scope is
// the set the guest asked for (`placeSearchScope`).
//
// RED IS THE OPERATOR'S (MESITA-2707; Pato: "selected is the manual thing …
// independent of enrichment"). Until MESITA-2707 red was earned by an Enrich
// run (`enriched`, MESITA-2154); enrichment now paints nothing here. The
// SERVER states `selected` on every place payload and on every name-lane
// row, read off `places.selected`; nothing here re-derives it from any
// other column, so an older payload without it stays gray (understating
// beats promising a mark that is not there). The Enriched mark after a
// name (the sparkle seal) is a different fact and keeps its own reader,
// lib/place-enriched.ts. Hexes live in lib/map-defaults.ts; a HELD pin (the
// tapped one) trades its tone for ink with a white ring (MESITA-2488).

import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_MESITA_SELECTED_PIN_COLOR,
  MAP_PIN_STROKE_COLOR,
  MAP_PIN_STROKE_WEIGHT,
  MAP_SELECTED_PIN_COLOR,
  MAP_SELECTED_PIN_STROKE_COLOR,
  MAP_SELECTED_PIN_STROKE_WEIGHT,
} from "@/lib/map-defaults";

/** The tone IS the narrowest ring; only `selected` (Mesita Selected, the
 *  operator's mark) draws red. */
export type PinTone = "selected" | "mesita" | "google";

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
  selected: MAP_MESITA_SELECTED_PIN_COLOR,
  // A Mesita place without the operator's mark is gray like a Google row.
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

/** Name-lane rows. The server's `selected` alone reaches red: a Mesita row
 *  without it reads as `mesita` (gray), never red — understating beats
 *  promising a mark that is not there. Off Mesita is gray too. */
export function predictionPinTone(item: {
  state?: string | null;
  selected?: boolean | null;
  mesitaId?: string | null;
  mesitaSlug?: string | null;
}): PinTone {
  if (!predictionOnMesita(item)) return "google";
  return item.selected === true ? "selected" : "mesita";
}

export function pinToneColor(tone: PinTone): string {
  return TONE_COLORS[tone];
}

/** Holding a pin (the tap, MESITA-2488) CHANGES the colour: the tone gives
 *  way to ink. `held` is the tapped pin, not the Selected tone. */
export function pinFillColor(tone: PinTone, held = false): string {
  return held ? MAP_SELECTED_PIN_COLOR : pinToneColor(tone);
}

export function pinStrokeColor(held: boolean): string {
  return held ? MAP_SELECTED_PIN_STROKE_COLOR : MAP_PIN_STROKE_COLOR;
}

/** A held pin draws its (white) ring thicker; the disk never grows. */
export function pinStrokeWeight(held: boolean): number {
  return held ? MAP_SELECTED_PIN_STROKE_WEIGHT : MAP_PIN_STROKE_WEIGHT;
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

/** Map/catalog rows: a Google stub is gray, a Mesita row without the
 *  operator's mark is gray too (its own tone, `mesita`), a Selected one red.
 *  Same rule as the ring counts (`placeSearchScope`), so a dot and its ring
 *  cannot disagree. */
export function placePinTone(place: {
  googleOnly?: boolean;
  from_google?: boolean;
  selected?: boolean | null;
}): PinTone {
  if (place.googleOnly || place.from_google) return "google";
  return place.selected === true ? "selected" : "mesita";
}

/** Live-search overlay pins. Catalog is coords only — tone follows the EF row
 *  so the list dot and the map pin cannot disagree. Empty coords → null so
 *  the map keeps catalog markers instead of blanking. */
type SearchPinPrediction = {
  placeId: string;
  mainText: string;
  state?: string | null;
  /** The server's `selected`. Required for the pin to reach red: a Mesita
   *  prediction without it stays gray. */
  selected?: boolean | null;
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
  boost_tier?: number | null;
};

type BuiltSearchPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  tone: PinTone;
  boosted?: boolean;
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
      // Boost's ⚡ (MESITA-2789) follows the catalog row the pick resolves
      // to; absent when not boosted, so an unboosted pin is unchanged.
      ...(typeof hit?.boost_tier === "number" && hit.boost_tier > 0 ? { boosted: true } : {}),
    });
  }
  return pins.length > 0 ? pins : null;
}
