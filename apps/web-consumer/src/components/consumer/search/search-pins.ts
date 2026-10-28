// The pin tone is the coloured point, on the results rows AND the map pins.
// THE LAW, three nested sets (Pato, 2026-10-12, MESITA-2158):
//
//   official  red    Mesita Official — a paid tier, `boost_tier` 1..3
//   mesita    gray   our own place that is not Official
//   google    gray   a Google row Mesita does not hold
//
// THREE COLOURS ON THE MAP AND NO MORE (Pato, 2026-10-18, MESITA-2316): red
// is Official, blue is the guest's own location, gray is everything else.
// The `mesita` tone survives as a FACT, not a colour: its row says "Basic
// Mesita profile" and opens its own profile, while a Google-only row opens
// through the opening screen.
//
// RED IS OFFICIAL (Pato, MESITA-2925: "Kill Select and Boosted. Just
// Official"). It was the operator's Selected mark (MESITA-2707), and a paid
// Boost wore a ⚡ badge on top (MESITA-2789); now the paid tier alone paints
// red, one treatment. The SERVER states `boost_tier` on every place payload
// and name-lane row; an older payload without it stays gray (understating
// beats promising a mark that is not there). The Official mark after a name
// (OfficialBadge) reads the same `boost_tier`. Hexes live in
// lib/map-defaults.ts; a HELD pin (the tapped one) trades its tone for ink
// with a white ring (MESITA-2488).

import { isOfficialPlace } from "@mesita/place-profile";
import {
  MAP_GOOGLE_PIN_COLOR,
  MAP_OFFICIAL_PIN_COLOR,
  MAP_PIN_STROKE_COLOR,
  MAP_PIN_STROKE_WEIGHT,
  MAP_SELECTED_PIN_COLOR,
  MAP_SELECTED_PIN_STROKE_COLOR,
  MAP_SELECTED_PIN_STROKE_WEIGHT,
} from "@/lib/map-defaults";

/** The tone IS the narrowest ring; only `official` (a paid tier,
 *  MESITA-2925) draws red. */
export type PinTone = "official" | "mesita" | "google";

/** On Mesita per EF — mesitaId/slug win over a stale not_in_mesita state. */
export function predictionOnMesita(item: {
  state?: string | null;
  mesitaId?: string | null;
  mesitaSlug?: string | null;
}): boolean {
  if (item.mesitaId || item.mesitaSlug) return true;
  return item.state !== "not_in_mesita";
}

/** Google-only stub that was added — real Mesita id, not a g: prefix. */
export function catalogPlaceOnMesita(place: {
  id: string;
  googleOnly?: boolean;
  from_google?: boolean;
}): boolean {
  if (!place.googleOnly && !place.from_google) return true;
  return !place.id.startsWith("g:");
}

const TONE_COLORS: Record<PinTone, string> = {
  official: MAP_OFFICIAL_PIN_COLOR,
  // A Mesita place that is not Official is gray like a Google row.
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

/** Name-lane rows. The server's `boost_tier` (on the row, else on its
 *  card) alone reaches red: a Mesita row without it reads as `mesita`
 *  (gray), never red. Off Mesita is gray too. */
export function predictionPinTone(item: {
  state?: string | null;
  boost_tier?: number | null;
  card?: { boost_tier?: number | null } | null;
  mesitaId?: string | null;
  mesitaSlug?: string | null;
}): PinTone {
  if (!predictionOnMesita(item)) return "google";
  return isOfficialPlace({ boost_tier: item.boost_tier ?? item.card?.boost_tier })
    ? "official"
    : "mesita";
}

export function pinToneColor(tone: PinTone): string {
  return TONE_COLORS[tone];
}

/** Holding a pin (the tap, MESITA-2488) CHANGES the colour: the tone gives
 *  way to ink. `held` is the tapped pin. */
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

/** Map/catalog rows: a Google stub is gray, a Mesita row that is not
 *  Official is gray too (its own tone, `mesita`), an Official one red. */
export function placePinTone(place: {
  googleOnly?: boolean;
  from_google?: boolean;
  boost_tier?: number | null;
}): PinTone {
  if (place.googleOnly || place.from_google) return "google";
  return isOfficialPlace(place) ? "official" : "mesita";
}

/** Live-search overlay pins. Catalog is coords only — tone follows the EF row
 *  so the list dot and the map pin cannot disagree. Empty coords → null so
 *  the map keeps catalog markers instead of blanking. */
type SearchPinPrediction = {
  placeId: string;
  mainText: string;
  state?: string | null;
  /** The server's `boost_tier` (MESITA-2925); without it, on the row, its
   *  card or the catalog row it resolves to, a Mesita pin stays gray. */
  boost_tier?: number | null;
  card?: { boost_tier?: number | null } | null;
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
      // The row's own tier first, else the catalog row it resolves to.
      tone: predictionPinTone({
        ...prediction,
        boost_tier:
          prediction.boost_tier ?? prediction.card?.boost_tier ?? hit?.boost_tier,
      }),
    });
  }
  return pins.length > 0 ? pins : null;
}
